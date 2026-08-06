<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Public rankings endpoint used by the Star Rankings screen.
 *
 * GET /api/rankings?type=hosts|gifters|agencies|resellers&period=daily|weekly|monthly&limit=50
 *
 * Response: { items: [ { id, name, username, avatar, diamonds, coins, meta } ] }
 * All rows are sorted DESC by (diamonds + coins) so the UI can render either metric.
 */
class RankingsController extends Controller
{
    public function index(Request $request)
    {
        $type   = (string) $request->query('type', 'hosts');
        $period = (string) $request->query('period', 'weekly');
        $limit  = (int) $request->query('limit', 50);
        $limit  = max(5, min(100, $limit));

        [$from, $to] = $this->periodRange($period);

        $items = match ($type) {
            'gifters'   => $this->topGifters($from, $to, $limit),
            'agencies'  => $this->topAgencies($from, $to, $limit),
            'resellers' => $this->topResellers($from, $to, $limit),
            default     => $this->topHosts($from, $to, $limit),
        };

        return response()->json([
            'type'   => $type,
            'period' => $period,
            'from'   => $from,
            'to'     => $to,
            'items'  => $items,
        ]);
    }

    // ---------- helpers ----------

    protected function periodRange(string $period): array
    {
        return match ($period) {
            'daily'   => [now()->startOfDay()->toDateTimeString(),  now()->endOfDay()->toDateTimeString()],
            'monthly' => [now()->startOfMonth()->toDateTimeString(), now()->endOfMonth()->toDateTimeString()],
            default   => [now()->startOfWeek()->toDateTimeString(),  now()->endOfWeek()->toDateTimeString()],
        };
    }

    protected function userCols(): array
    {
        $cols = ['id', 'name'];
        foreach (['username', 'avatar', 'avatar_url', 'gender'] as $c) {
            if (Schema::hasColumn('users', $c)) $cols[] = $c;
        }
        return $cols;
    }

    protected function shapeUser($u, int $diamonds, int $coins, array $extra = []): array
    {
        return array_merge([
            'id'       => (int) ($u->id ?? 0),
            'name'     => (string) ($u->name ?? 'Unknown'),
            'username' => (string) ($u->username ?? ('user' . ($u->id ?? 0))),
            'avatar'   => $u->avatar_url ?? $u->avatar ?? null,
            'gender'   => $u->gender ?? null,
            'diamonds' => $diamonds,
            'coins'    => $coins,
        ], $extra);
    }

    // ---------- Top Hosts (received gifts) ----------
    protected function topHosts(string $from, string $to, int $limit): array
    {
        if (!Schema::hasTable('gift_transactions')) return [];

        $rows = DB::table('gift_transactions')
            ->select('receiver_id',
                DB::raw('SUM(diamonds) as diamonds'),
                DB::raw('SUM(r_coins) as coins'))
            ->whereNotNull('receiver_id')
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('receiver_id')
            ->orderByDesc(DB::raw('SUM(diamonds) + SUM(r_coins)'))
            ->limit($limit)
            ->get();

        $ids = $rows->pluck('receiver_id')->all();
        $users = $ids ? DB::table('users')->whereIn('id', $ids)->get($this->userCols())->keyBy('id') : collect();

        return $rows->map(function ($r) use ($users) {
            $u = $users->get($r->receiver_id);
            return $u ? $this->shapeUser($u, (int) $r->diamonds, (int) $r->coins) : null;
        })->filter()->values()->all();
    }

    // ---------- Top Gifters (sent gifts) ----------
    protected function topGifters(string $from, string $to, int $limit): array
    {
        if (!Schema::hasTable('gift_transactions')) return [];

        $rows = DB::table('gift_transactions')
            ->select('sender_id',
                DB::raw('SUM(diamonds) as diamonds'),
                DB::raw('SUM(r_coins) as coins'))
            ->whereBetween('created_at', [$from, $to])
            ->groupBy('sender_id')
            ->orderByDesc(DB::raw('SUM(diamonds) + SUM(r_coins)'))
            ->limit($limit)
            ->get();

        $ids = $rows->pluck('sender_id')->all();
        $users = $ids ? DB::table('users')->whereIn('id', $ids)->get($this->userCols())->keyBy('id') : collect();

        return $rows->map(function ($r) use ($users) {
            $u = $users->get($r->sender_id);
            return $u ? $this->shapeUser($u, (int) $r->diamonds, (int) $r->coins) : null;
        })->filter()->values()->all();
    }

    // ---------- Top Agencies ----------
    // agencies.code == agency_hosts.agency_code; gift_transactions link via receiver_id -> agency_hosts.user_id
    protected function topAgencies(string $from, string $to, int $limit): array
    {
        if (!Schema::hasTable('agencies') || !Schema::hasTable('agency_hosts')) return [];

        // Build per-agency totals from gift_transactions when possible; fallback to agency_hosts totals.
        $hasGifts = Schema::hasTable('gift_transactions');

        $agencies = DB::table('agencies')->get();
        if ($agencies->isEmpty()) return [];

        $totals = [];
        if ($hasGifts) {
            $rows = DB::table('gift_transactions as gt')
                ->join('agency_hosts as ah', 'ah.user_id', '=', 'gt.receiver_id')
                ->select('ah.agency_code',
                    DB::raw('SUM(gt.diamonds) as diamonds'),
                    DB::raw('SUM(gt.r_coins) as coins'))
                ->whereBetween('gt.created_at', [$from, $to])
                ->groupBy('ah.agency_code')
                ->get();
            foreach ($rows as $r) {
                $totals[$r->agency_code] = [
                    'diamonds' => (int) $r->diamonds,
                    'coins'    => (int) $r->coins,
                ];
            }
        }

        // Fallback: agency_hosts.diamonds_received per agency (all-time; used when no gift rows in the period)
        $fallback = DB::table('agency_hosts')
            ->select('agency_code',
                DB::raw('SUM(diamonds_received) as diamonds'),
                DB::raw('SUM(live_hours) as hours'),
                DB::raw('COUNT(*) as hosts_count'))
            ->groupBy('agency_code')
            ->get()
            ->keyBy('agency_code');

        $list = $agencies->map(function ($a) use ($totals, $fallback) {
            $code = $a->code;
            $t = $totals[$code] ?? null;
            $fb = $fallback->get($code);
            $diamonds = $t['diamonds'] ?? (int) ($fb->diamonds ?? 0);
            $coins    = $t['coins']    ?? 0;

            return [
                'id'         => (int) $a->id,
                'name'       => (string) $a->name,
                'username'   => (string) ($a->code ?? ''),
                'avatar'     => null,
                'diamonds'   => $diamonds,
                'coins'      => $coins,
                'hosts'      => (int) ($fb->hosts_count ?? $a->hosts_count ?? 0),
                'hours'      => (float) ($fb->hours ?? 0),
                'commission' => (int) ($a->commission ?? 0),
                'status'     => (string) ($a->status ?? 'active'),
            ];
        })
        ->sortByDesc(fn($x) => $x['diamonds'] + $x['coins'])
        ->values()
        ->take($limit)
        ->all();

        return $list;
    }

    // ---------- Top Resellers ----------
    // wallet_transfers rows where source='reseller' (or sender_role='reseller'), grouped by sender_id.
    protected function topResellers(string $from, string $to, int $limit): array
    {
        if (!Schema::hasTable('wallet_transfers')) return [];

        $q = DB::table('wallet_transfers')
            ->select('sender_id',
                DB::raw('SUM(diamonds) as diamonds'),
                DB::raw('SUM(r_coins) as coins'),
                DB::raw('COUNT(*) as tx_count'))
            ->whereNotNull('sender_id')
            ->whereBetween('created_at', [$from, $to]);

        // Prefer explicit reseller source/role when present.
        $q->where(function ($w) {
            $w->where('source', 'reseller')
              ->orWhere('sender_role', 'reseller');
        });

        $rows = $q->groupBy('sender_id')
            ->orderByDesc(DB::raw('SUM(diamonds) + SUM(r_coins)'))
            ->limit($limit)
            ->get();

        $ids = $rows->pluck('sender_id')->all();
        $users = $ids ? DB::table('users')->whereIn('id', $ids)->get($this->userCols())->keyBy('id') : collect();

        return $rows->map(function ($r) use ($users) {
            $u = $users->get($r->sender_id);
            if (!$u) return null;
            return $this->shapeUser($u, (int) $r->diamonds, (int) $r->coins, [
                'tx_count' => (int) $r->tx_count,
            ]);
        })->filter()->values()->all();
    }
}
