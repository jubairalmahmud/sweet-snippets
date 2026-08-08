<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * SK Love — Games Controller
 * Solo rounds. Coin balance lives on users.diamonds (recharge/top-up balance).
 * Games: casino (roulette 0-36), ferry_wheel (8 slots), teen_patti (3 hands).
 *
 * Routes (add to routes/api.php inside auth:sanctum group):
 *   Route::get   ('games/config',                [GameController::class, 'config']);
 *   Route::get   ('games/balance',               [GameController::class, 'balance']);
 *   Route::post  ('games/{game}/round',          [GameController::class, 'play']);
 *   Route::get   ('games/{game}/history',        [GameController::class, 'history']);
 */
class GameController extends Controller
{
    /* =====================================================================
     *  GAME CONFIG
     * ===================================================================== */

    private const CHIPS = [
        'casino'      => [100, 200, 300, 500],
        'ferry_wheel' => [100, 200, 300, 400],
        'teen_patti'  => [100, 200, 500, 1000],
    ];

    private const TIMERS = [
        'casino'      => 10,
        'ferry_wheel' => 20,
        'teen_patti'  => 20,
    ];

    private const MAX_BET_PER_ROUND = 100000;

    // Ferry wheel 8 slots with fixed multipliers (matches reference video)
    private const FERRY_SLOTS = [
        ['key' => 'burger',   'label' => '🍔 Burger',   'mult' => 5],
        ['key' => 'pizza',    'label' => '🍕 Pizza',    'mult' => 10],
        ['key' => 'hotdog',   'label' => '🌭 Hot Dog',  'mult' => 15],
        ['key' => 'sushi',    'label' => '🍣 Sushi',    'mult' => 20],
        ['key' => 'donut',    'label' => '🍩 Donut',    'mult' => 25],
        ['key' => 'icecream', 'label' => '🍦 Ice',      'mult' => 30],
        ['key' => 'cake',     'label' => '🎂 Cake',     'mult' => 40],
        ['key' => 'crown',    'label' => '👑 Crown',    'mult' => 45],
    ];

    // Ferry wheel weight distribution (higher mult = rarer)
    private const FERRY_WEIGHTS = [40, 25, 15, 8, 5, 4, 2, 1];

    // Roulette red numbers (European style)
    private const ROULETTE_RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];

    /* =====================================================================
     *  PUBLIC ENDPOINTS
     * ===================================================================== */

    public function config(): JsonResponse
    {
        return response()->json([
            'ok'    => true,
            'games' => [
                'casino' => [
                    'name'    => 'Casino Roulette',
                    'chips'   => self::CHIPS['casino'],
                    'timer'   => self::TIMERS['casino'],
                    'targets' => $this->casinoTargets(),
                ],
                'ferry_wheel' => [
                    'name'    => 'Ferry Wheel',
                    'chips'   => self::CHIPS['ferry_wheel'],
                    'timer'   => self::TIMERS['ferry_wheel'],
                    'slots'   => self::FERRY_SLOTS,
                ],
                'teen_patti' => [
                    'name'    => 'Teen Patti',
                    'chips'   => self::CHIPS['teen_patti'],
                    'timer'   => self::TIMERS['teen_patti'],
                    'hands'   => [
                        ['key' => 'A', 'label' => 'Hand A', 'mult' => 2],
                        ['key' => 'B', 'label' => 'Hand B', 'mult' => 2],
                        ['key' => 'C', 'label' => 'Hand C', 'mult' => 2],
                    ],
                ],
            ],
        ]);
    }

    public function balance(): JsonResponse
    {
        $u = Auth::user();
        if (!$u) return response()->json(['ok' => false, 'message' => 'Unauthorized'], 401);
        return response()->json([
            'ok'    => true,
            'coins' => (int) ($u->diamonds ?? 0),
            'diamonds' => (int) ($u->diamonds ?? 0),
        ]);
    }

    public function topWinner(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'winner' => Cache::get('sklove.games.top_winner'),
        ]);
    }

    public function reportWin(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['ok' => false, 'message' => 'Unauthorized'], 401);

        $data = $request->validate([
            'amount' => 'required|integer|min:1',
            'game' => 'required|string|max:40',
        ]);
        $winner = [
            'user_id' => (string) $user->id,
            'name' => (string) ($user->name ?: 'Player'),
            'avatar' => $user->avatar ?? null,
            'amount' => (int) $data['amount'],
            'game' => (string) $data['game'],
            'ts' => now()->timestamp,
        ];
        $current = Cache::get('sklove.games.top_winner');
        if (!$current || (int) ($current['amount'] ?? 0) <= $winner['amount']) {
            Cache::put('sklove.games.top_winner', $winner, now()->addMinute());
        }

        return response()->json(['ok' => true, 'winner' => $winner]);
    }

    /**
     * POST /api/games/{game}/round
     * Body: { bets: [{ target: string, amount: int }, ...], client_seed?: string }
     * Deducts total bet, rolls result server-side, credits payout, returns full round.
     */
    public function play(Request $request, string $game): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['ok' => false, 'message' => 'Unauthorized'], 401);

        $game = match ($game) {
            'ferry'     => 'ferry_wheel',
            'teenpatti' => 'teen_patti',
            default     => $game,
        };

        if (!in_array($game, ['casino', 'ferry_wheel', 'teen_patti'], true)) {
            return response()->json(['ok' => false, 'message' => 'Unknown game'], 404);
        }

        $bets = $request->input('bets', []);
        if (!is_array($bets) || count($bets) === 0) {
            return response()->json(['ok' => false, 'message' => 'No bets provided'], 422);
        }
        // Mobile clients send either [{target, amount}] or {target: amount}.
        if (!array_is_list($bets)) {
            $bets = collect($bets)->map(
                fn ($amount, $target) => ['target' => (string) $target, 'amount' => $amount]
            )->values()->all();
        }

        // Normalize & validate bets
        $clean   = [];
        $betTotal = 0;
        foreach ($bets as $b) {
            $target = isset($b['target']) ? (string) $b['target'] : '';
            $amount = (int) ($b['amount'] ?? 0);
            if ($target === '' || $amount <= 0) continue;
            if ($game === 'ferry_wheel' && preg_match('/^slot_(\d+)$/', $target, $match)) {
                $slotIndex = (int) $match[1];
                $target = self::FERRY_SLOTS[$slotIndex]['key'] ?? $target;
            }
            if (!$this->isValidTarget($game, $target)) {
                return response()->json(['ok' => false, 'message' => "Invalid target: $target"], 422);
            }
            $clean[]   = ['target' => $target, 'amount' => $amount];
            $betTotal += $amount;
        }
        if ($betTotal <= 0) {
            return response()->json(['ok' => false, 'message' => 'Bet total must be > 0'], 422);
        }
        if ($betTotal > self::MAX_BET_PER_ROUND) {
            return response()->json(['ok' => false, 'message' => 'Bet exceeds per-round limit'], 422);
        }

        $serverSeed = bin2hex(random_bytes(16));
        $clientSeed = (string) $request->input('client_seed', Str::random(16));
        $nonce      = (int) round(microtime(true) * 1000);

        try {
            return DB::transaction(function () use ($user, $game, $clean, $betTotal, $serverSeed, $clientSeed, $nonce) {
                // Lock user row
                $row = DB::table('users')->where('id', $user->id)->lockForUpdate()->first();
                if (!$row) {
                    return response()->json(['ok' => false, 'message' => 'User not found'], 404);
                }
                $balanceBefore = (int) ($row->diamonds ?? 0);
                if ($balanceBefore < $betTotal) {
                    return response()->json(['ok' => false, 'message' => 'Insufficient coins'], 402);
                }

                // Roll result deterministically from seeds
                $result  = $this->roll($game, $serverSeed, $clientSeed, $nonce);
                $payout  = $this->settle($game, $clean, $result);
                $net     = $payout - $betTotal;

                $newBalance = $balanceBefore - $betTotal + $payout;
                DB::table('users')->where('id', $user->id)->update([
                    'diamonds'   => $newBalance,
                    'updated_at' => now(),
                ]);

                $roundId = DB::table('game_rounds')->insertGetId([
                    'user_id'         => $user->id,
                    'game'            => $game,
                    'bets_json'       => json_encode($clean),
                    'bet_total'       => $betTotal,
                    'payout_total'    => $payout,
                    'net'             => $net,
                    'result_json'     => json_encode($result),
                    'status'          => 'settled',
                    'server_seed'     => $serverSeed,
                    'client_seed'     => $clientSeed,
                    'nonce'           => $nonce,
                    'balance_before'  => $balanceBefore,
                    'balance_after'   => $newBalance,
                    'created_at'      => now(),
                    'settled_at'      => now(),
                ]);

                return response()->json([
                    'ok'      => true,
                    'round'   => [
                        'id'             => $roundId,
                        'game'           => $game,
                        'bets'           => $clean,
                        'bet_total'      => $betTotal,
                        'payout_total'   => $payout,
                        'net'            => $net,
                        'result'         => $result,
                        'balance_before' => $balanceBefore,
                        'balance_after'  => $newBalance,
                        'server_seed'    => $serverSeed,
                        'client_seed'    => $clientSeed,
                        'nonce'          => $nonce,
                    ],
                    'coins'   => $newBalance,
                    'diamonds'=> $newBalance,
                ]);
            });
        } catch (\Throwable $e) {
            return response()->json([
                'ok'      => false,
                'message' => 'Game round failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function history(Request $request, string $game): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['ok' => false, 'message' => 'Unauthorized'], 401);
        $game = match ($game) {
            'ferry'     => 'ferry_wheel',
            'teenpatti' => 'teen_patti',
            default     => $game,
        };
        if (!in_array($game, ['casino', 'ferry_wheel', 'teen_patti'], true)) {
            return response()->json(['ok' => false, 'message' => 'Unknown game'], 404);
        }

        $limit = min(50, max(1, (int) $request->input('limit', 20)));

        $rows = DB::table('game_rounds')
            ->where('user_id', $user->id)
            ->where('game', $game)
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(function ($r) {
                return [
                    'id'            => (int) $r->id,
                    'game'          => $r->game,
                    'bets'          => json_decode($r->bets_json, true) ?: [],
                    'bet_total'     => (int) $r->bet_total,
                    'payout_total'  => (int) $r->payout_total,
                    'net'           => (int) $r->net,
                    'result'        => $r->result_json ? json_decode($r->result_json, true) : null,
                    'balance_after' => (int) $r->balance_after,
                    'created_at'    => $r->created_at,
                ];
            });

        return response()->json(['ok' => true, 'rounds' => $rows]);
    }

    /* =====================================================================
     *  VALIDATION / ROLL / SETTLE
     * ===================================================================== */

    private function isValidTarget(string $game, string $target): bool
    {
        if ($game === 'casino') {
            if (in_array($target, ['red','black','odd','even','low','high','d1','d2','d3'], true)) return true;
            if (ctype_digit($target)) {
                $n = (int) $target;
                return $n >= 0 && $n <= 36;
            }
            return false;
        }
        if ($game === 'ferry_wheel') {
            foreach (self::FERRY_SLOTS as $s) if ($s['key'] === $target) return true;
            return false;
        }
        if ($game === 'teen_patti') {
            return in_array($target, ['A','B','C'], true);
        }
        return false;
    }

    private function casinoTargets(): array
    {
        $out = [
            ['key' => 'red',   'label' => 'Red',   'mult' => 2],
            ['key' => 'black', 'label' => 'Black', 'mult' => 2],
            ['key' => 'odd',   'label' => 'Odd',   'mult' => 2],
            ['key' => 'even',  'label' => 'Even',  'mult' => 2],
            ['key' => 'low',   'label' => '1-18',  'mult' => 2],
            ['key' => 'high',  'label' => '19-36', 'mult' => 2],
        ];
        for ($i = 0; $i <= 36; $i++) {
            $out[] = ['key' => (string) $i, 'label' => (string) $i, 'mult' => 36];
        }
        return $out;
    }

    /**
     * Deterministic roll from (server_seed, client_seed, nonce) — provably fair.
     */
    private function roll(string $game, string $serverSeed, string $clientSeed, int $nonce): array
    {
        $h    = hash('sha256', $serverSeed . ':' . $clientSeed . ':' . $nonce);
        $intA = hexdec(substr($h, 0, 8));
        $intB = hexdec(substr($h, 8, 8));
        $intC = hexdec(substr($h, 16, 8));

        if ($game === 'casino') {
            $n = $intA % 37; // 0..36
            $color = $n === 0 ? 'green' : (in_array($n, self::ROULETTE_RED, true) ? 'red' : 'black');
            return [
                'number' => $n,
                'color'  => $color,
                'parity' => $n === 0 ? null : ($n % 2 === 0 ? 'even' : 'odd'),
                'half'   => $n === 0 ? null : ($n <= 18 ? 'low' : 'high'),
            ];
        }

        if ($game === 'ferry_wheel') {
            $totalW = array_sum(self::FERRY_WEIGHTS);
            $pick   = ($intA % $totalW) + 1;
            $acc = 0;
            $idx = 0;
            foreach (self::FERRY_WEIGHTS as $i => $w) {
                $acc += $w;
                if ($pick <= $acc) { $idx = $i; break; }
            }
            $slot = self::FERRY_SLOTS[$idx];
            return ['slot' => $slot['key'], 'index' => $idx, 'label' => $slot['label'], 'mult' => $slot['mult']];
        }

        // teen_patti — simulate three 3-card hands, highest wins
        $deck = [];
        for ($s = 0; $s < 4; $s++) for ($r = 2; $r <= 14; $r++) $deck[] = ['s' => $s, 'r' => $r];
        // seeded shuffle using multiple hash draws
        $seedStream = $h . hash('sha256', 'shuffle:' . $h);
        for ($i = count($deck) - 1; $i > 0; $i--) {
            $chunk = substr($seedStream, ($i * 2) % (strlen($seedStream) - 8), 8);
            $j = hexdec($chunk) % ($i + 1);
            [$deck[$i], $deck[$j]] = [$deck[$j], $deck[$i]];
        }
        $hands = [
            'A' => array_slice($deck, 0, 3),
            'B' => array_slice($deck, 3, 3),
            'C' => array_slice($deck, 6, 3),
        ];
        $scores = [];
        foreach ($hands as $k => $h3) $scores[$k] = $this->teenPattiScore($h3);
        arsort($scores);
        $winner = array_key_first($scores);
        return [
            'winner' => $winner,
            'hands'  => $hands,
            'scores' => $scores,
        ];
    }

    private function teenPattiScore(array $cards): int
    {
        // Simple ranking: trail > pure seq > seq > flush > pair > high
        $ranks = array_map(fn($c) => $c['r'], $cards);
        $suits = array_map(fn($c) => $c['s'], $cards);
        sort($ranks);
        $flush = count(array_unique($suits)) === 1;
        $seq   = ($ranks[1] === $ranks[0] + 1 && $ranks[2] === $ranks[1] + 1);
        $counts = array_count_values($ranks);
        $max   = max($counts);
        $high  = $ranks[2] * 10000 + $ranks[1] * 100 + $ranks[0];
        if ($max === 3)                 return 6000000 + $high;
        if ($flush && $seq)             return 5000000 + $high;
        if ($seq)                       return 4000000 + $high;
        if ($flush)                     return 3000000 + $high;
        if ($max === 2)                 return 2000000 + $high;
        return 1000000 + $high;
    }

    /**
     * Given cleaned bets and result, compute total payout (includes stake on wins).
     */
    private function settle(string $game, array $bets, array $result): int
    {
        $payout = 0;

        if ($game === 'casino') {
            $n      = (int) $result['number'];
            $color  = $result['color'];
            $parity = $result['parity'];
            $half   = $result['half'];
            foreach ($bets as $b) {
                $t = $b['target']; $a = (int) $b['amount'];
                if (ctype_digit($t)) {
                    if ((int) $t === $n) $payout += $a * 36;
                    continue;
                }
                if ($n === 0) continue; // outside bets lose on green
                $win = match ($t) {
                    'red'   => $color === 'red',
                    'black' => $color === 'black',
                    'odd'   => $parity === 'odd',
                    'even'  => $parity === 'even',
                    'low'   => $half === 'low',
                    'high'  => $half === 'high',
                    'd1'    => $n >= 1 && $n <= 12,
                    'd2'    => $n >= 13 && $n <= 24,
                    'd3'    => $n >= 25 && $n <= 36,
                    default => false,
                };
                if ($win) $payout += $a * (str_starts_with($t, 'd') ? 3 : 2);
            }
            return $payout;
        }

        if ($game === 'ferry_wheel') {
            $winSlot = $result['slot'];
            $mult    = (int) $result['mult'];
            foreach ($bets as $b) {
                if ($b['target'] === $winSlot) $payout += (int) $b['amount'] * $mult;
            }
            return $payout;
        }

        if ($game === 'teen_patti') {
            $winner = $result['winner'];
            foreach ($bets as $b) {
                if ($b['target'] === $winner) $payout += (int) $b['amount'] * 2;
            }
            return $payout;
        }

        return 0;
    }
}
