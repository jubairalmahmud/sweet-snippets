<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExchangeController extends Controller
{
    // Column names in `users` table — adjust if your schema differs
    private string $coinCol = 'rCoins';
    private string $diamondCol = 'diamonds';
    private string $earningsCol = 'host_earnings'; // Host R-Coin earnings

    /** GET /api/exchange/rates — public */
    public function rates()
    {
        $rows = DB::table('exchange_rates')->where('enabled', 1)->get();
        $out = [];
        foreach ($rows as $r) {
            $out[$r->code] = [
                'rate' => (float) $r->rate,
                'min_amount' => (float) $r->min_amount,
            ];
        }
        return response()->json(['success' => true, 'rates' => $out]);
    }

    /** POST /api/exchange/coin-to-diamond — auth */
    public function coinToDiamond(Request $request)
    {
        return $this->convert($request, 'coin_to_diamond', $this->coinCol, $this->diamondCol, true);
    }

    /** POST /api/exchange/diamond-to-coin — auth */
    public function diamondToCoin(Request $request)
    {
        return $this->convert($request, 'diamond_to_coin', $this->diamondCol, $this->coinCol, false);
    }

    /** POST /api/exchange/rcoin-to-diamond — auth (host earnings → diamonds) */
    public function rcoinToDiamond(Request $request)
    {
        return $this->convert($request, 'rcoin_to_diamond', $this->earningsCol, $this->diamondCol, true);
    }

    /**
     * Generic converter.
     * $divide = true  →  target = floor(amount / rate)   (e.g. coins→diamonds)
     * $divide = false →  target = floor(amount * rate)   (e.g. diamonds→coins)
     */
    private function convert(Request $request, string $code, string $fromCol, string $toCol, bool $divide)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
        }

        $amount = (int) $request->input('amount', 0);
        if ($amount <= 0) {
            return response()->json(['success' => false, 'message' => 'Invalid amount'], 422);
        }

        $rateRow = DB::table('exchange_rates')->where('code', $code)->where('enabled', 1)->first();
        if (!$rateRow) {
            return response()->json(['success' => false, 'message' => 'Exchange not enabled'], 400);
        }
        $rate = (float) $rateRow->rate;
        $min = (float) $rateRow->min_amount;
        if ($rate <= 0) {
            return response()->json(['success' => false, 'message' => 'Invalid rate'], 400);
        }
        if ($amount < $min) {
            return response()->json(['success' => false, 'message' => "Minimum amount is {$min}"], 422);
        }

        $gained = $divide ? intdiv($amount, (int) $rate) : (int) floor($amount * $rate);
        if ($gained <= 0) {
            return response()->json(['success' => false, 'message' => 'Amount too small to convert'], 422);
        }
        // For divide mode, only consume whole multiples (no partial coin loss)
        $consumed = $divide ? $gained * (int) $rate : $amount;

        try {
            $wallet = DB::transaction(function () use ($user, $fromCol, $toCol, $consumed, $gained, $code, $amount, $rate) {
                $row = DB::table('users')->where('id', $user->id)->lockForUpdate()->first();
                if (!$row) throw new \Exception('User not found');

                $fromBal = (int) ($row->{$fromCol} ?? 0);
                if ($fromBal < $consumed) throw new \Exception('Insufficient balance');

                DB::table('users')->where('id', $user->id)->update([
                    $fromCol => $fromBal - $consumed,
                    $toCol => (int) ($row->{$toCol} ?? 0) + $gained,
                    'updated_at' => now(),
                ]);

                DB::table('exchange_logs')->insert([
                    'user_id' => $user->id,
                    'code' => $code,
                    'amount' => $amount,
                    'rate' => $rate,
                    'consumed' => $consumed,
                    'gained' => $gained,
                    'created_at' => now(),
                ]);

                $updated = DB::table('users')->where('id', $user->id)->first();
                return [
                    'diamonds' => (int) ($updated->{$this->diamondCol} ?? 0),
                    'rCoins' => (int) ($updated->{$this->coinCol} ?? 0),
                    'earnings' => (int) ($updated->{$this->earningsCol} ?? 0),
                ];
            });
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }

        return response()->json([
            'success' => true,
            'message' => "✓ Converted {$consumed} → {$gained}",
            'result' => [
                'consumed' => $consumed,
                'gained' => $gained,
                'wallet' => $wallet,
            ],
        ]);
    }
}
