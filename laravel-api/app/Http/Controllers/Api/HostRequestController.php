<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * User-side Host Registration (simple agency-code flow).
 *
 *  POST /api/host-requests               body: { agency_user_id }
 *  GET  /api/host-requests/mine
 *  POST /api/host-requests/mine/cancel
 *  POST /api/host-requests/mine/change   body: { new_agency_user_id, reason? }
 *
 *  Uses existing `hosts` table (user_id, agency_id, status, joined_at, notes).
 *  agency_id references agency_applications.id (approved).
 */
class HostRequestController extends Controller
{
    protected function approvedStatus($status): bool
    {
        $s = strtolower(trim((string) $status));
        return $s === '' || in_array($s, ['approved', 'active', 'enabled'], true);
    }

    protected function tableColumn(string $table, array $columns): ?string
    {
        foreach ($columns as $column) {
            if (Schema::hasColumn($table, $column)) return $column;
        }
        return null;
    }

    protected function normalizeAgency(object $agency, string $source = 'applications'): object
    {
        return (object) [
            'id'          => (int) ($agency->id ?? 0),
            'user_id'     => (int) ($agency->user_id ?? $agency->owner_id ?? 0),
            'agency_name' => $agency->agency_name ?? $agency->name ?? ('Agency #' . ($agency->id ?? '')),
            'status'      => $agency->status ?? 'approved',
            '_source'     => $source,
        ];
    }

    /** If an old `agencies` row exists, mirror it into agency_applications so the new flow can use it. */
    protected function syncLegacyAgencyToApplication(object $legacyAgency): ?object
    {
        if (!Schema::hasTable('agency_applications')) return null;

        $ownerId = (int) ($legacyAgency->owner_id ?? $legacyAgency->user_id ?? 0);
        if (!$ownerId) return null;

        $existing = DB::table('agency_applications')
            ->where('user_id', $ownerId)
            ->where('status', 'approved')
            ->orderByDesc('id')
            ->first();
        if ($existing) return $this->normalizeAgency($existing, 'applications');

        $owner = Schema::hasTable('users') ? DB::table('users')->where('id', $ownerId)->first(['id', 'name']) : null;
        $row = [];
        foreach ([
            'user_id' => $ownerId,
            'full_name' => $owner->name ?? null,
            'agency_name' => $legacyAgency->agency_name ?? $legacyAgency->name ?? ('Agency #' . ($legacyAgency->id ?? $ownerId)),
            'phone' => $legacyAgency->phone ?? null,
            'email' => $legacyAgency->email ?? null,
            'num_hosts' => $legacyAgency->num_hosts ?? null,
            'status' => 'approved',
            'created_at' => now(),
            'updated_at' => now(),
        ] as $column => $value) {
            if (Schema::hasColumn('agency_applications', $column)) $row[$column] = $value;
        }

        try {
            $id = DB::table('agency_applications')->insertGetId($row);
            return $this->normalizeAgency(DB::table('agency_applications')->where('id', $id)->first(), 'applications');
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Resolve an approved agency owned by given user_id. Supports both new and legacy tables. */
    protected function resolveAgencyByOwner(int $ownerUserId): ?object
    {
        if (Schema::hasTable('agency_applications')) {
            $agency = DB::table('agency_applications')
                ->where('user_id', $ownerUserId)
                ->where('status', 'approved')
                ->orderByDesc('id')
                ->first();
            if ($agency) return $this->normalizeAgency($agency, 'applications');
        }

        if (Schema::hasTable('agencies')) {
            $ownerColumn = $this->tableColumn('agencies', ['owner_id', 'user_id']);
            if ($ownerColumn) {
                $query = DB::table('agencies')->where($ownerColumn, $ownerUserId)->orderByDesc('id');
                $legacy = $query->first();
                if ($legacy && $this->approvedStatus($legacy->status ?? ($legacy->state ?? 'approved'))) {
                    return $this->syncLegacyAgencyToApplication($legacy) ?: $this->normalizeAgency($legacy, 'agencies');
                }
            }
        }

        return null;
    }

    protected function resolveAgencyByRecordId(int $agencyId): ?object
    {
        if (Schema::hasTable('agency_applications')) {
            $agency = DB::table('agency_applications')->where('id', $agencyId)->first();
            if ($agency) return $this->normalizeAgency($agency, 'applications');
        }
        if (Schema::hasTable('agencies')) {
            $legacy = DB::table('agencies')->where('id', $agencyId)->first();
            if ($legacy) return $this->normalizeAgency($legacy, 'agencies');
        }
        return null;
    }

    protected function activeTarget(): ?object
    {
        if (!Schema::hasTable('host_targets')) return null;
        return DB::table('host_targets')->where('active', true)->orderByDesc('id')->first();
    }

    protected function shapeMine(?object $row, ?object $agency): array
    {
        if (!$row) return ['status' => 'none'];

        $out = [
            'status'     => $row->status,
            'host_id'    => (int) $row->id,
            'agency_id'  => (int) $row->agency_id,
            'joined_at'  => $row->joined_at,
            'created_at' => $row->created_at,
            'notes'      => $row->notes,
        ];

        if ($agency) {
            $ownerCols = ['id', 'name'];
            foreach (['username', 'avatar', 'avatar_url'] as $c) {
                if (Schema::hasColumn('users', $c)) $ownerCols[] = $c;
            }
            $owner = DB::table('users')->where('id', $agency->user_id)->first($ownerCols);
            $out['agency'] = [
                'id'           => (int) $agency->id,
                'name'         => $agency->agency_name ?? '',
                'owner_user_id'=> (int) $agency->user_id,
                'owner_name'   => $owner->name ?? '',
                'owner_avatar' => $owner->avatar_url ?? $owner->avatar ?? null,
            ];
        }

        if ($row->status === 'approved') {
            $target = $this->activeTarget();
            $start  = $target->period_start ?? now()->startOfMonth()->toDateString();
            $end    = $target->period_end   ?? now()->endOfMonth()->toDateString();

            $agg = DB::table('host_reports')
                ->where('host_user_id', $row->user_id)
                ->whereBetween('report_date', [$start, $end])
                ->selectRaw('COALESCE(SUM(coins_earned),0) as coins, COALESCE(SUM(live_hours),0) as hours, COALESCE(SUM(diamonds_earned),0) as diamonds')
                ->first();

            $coins = (int) ($agg->coins ?? 0);
            $daysLeft = max(0, (int) round((strtotime($end) - time()) / 86400));

            $out['target'] = $target ? [
                'coins_target'      => (int) ($target->coins_target ?? 0),
                'live_hours_target' => (float) ($target->live_hours_target ?? 0),
                'diamonds_target'   => (int) ($target->diamonds_target ?? 0),
                'period_start'      => $start,
                'period_end'        => $end,
                'days_left'         => $daysLeft,
            ] : null;

            $out['progress'] = [
                'coins_earned'    => $coins,
                'live_hours'      => (float) ($agg->hours ?? 0),
                'diamonds_earned' => (int) ($agg->diamonds ?? 0),
                'coins_remaining' => $target && $target->coins_target
                    ? max(0, (int) $target->coins_target - $coins) : null,
                'coins_pct'       => $target && $target->coins_target
                    ? min(100, round($coins / $target->coins_target * 100, 1)) : null,
            ];

            // Total earnings (all-time) from user's wallet if column present
            if (Schema::hasColumn('users', 'host_earnings')) {
                $out['total_earnings'] = (int) DB::table('users')->where('id', $row->user_id)->value('host_earnings');
            } elseif (Schema::hasColumn('users', 'earnings')) {
                $out['total_earnings'] = (int) DB::table('users')->where('id', $row->user_id)->value('earnings');
            }
        }

        return $out;
    }

    /** POST /api/host-requests  body: { agency_user_id } */
    public function store(Request $request)
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);

        $data = $request->validate([
            'agency_user_id' => 'required|integer|min:1',
        ]);

        $ownerId = (int) $data['agency_user_id'];
        if ($ownerId === (int) $u->id) {
            return response()->json(['message' => 'নিজের এজেন্সিতে যুক্ত হওয়া যাবে না।'], 422);
        }

        $agency = $this->resolveAgencyByOwner($ownerId);
        if (!$agency) {
            return response()->json(['message' => 'এই ইউজার আইডির কোনো অনুমোদিত এজেন্সি পাওয়া যায়নি।'], 404);
        }

        if (!Schema::hasTable('hosts')) {
            return response()->json(['message' => 'Hosts table missing — run migration.'], 500);
        }

        // Block if already pending or approved anywhere
        $existing = DB::table('hosts')
            ->where('user_id', $u->id)
            ->whereIn('status', ['pending', 'approved'])
            ->orderByDesc('id')
            ->first();
        if ($existing) {
            return response()->json([
                'message' => $existing->status === 'approved'
                    ? 'আপনি ইতিমধ্যেই একটি এজেন্সিতে অনুমোদিত হোস্ট।'
                    : 'আপনার একটি রিকোয়েস্ট পেন্ডিং আছে।',
                'mine' => $this->shapeMine($existing, $this->resolveAgencyByRecordId((int) $existing->agency_id)),
            ], 409);
        }

        $id = DB::table('hosts')->insertGetId([
            'user_id'    => $u->id,
            'agency_id'  => $agency->id,
            'status'     => 'pending',
            'notes'      => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('hosts')->where('id', $id)->first();
        return response()->json(['ok' => true, 'mine' => $this->shapeMine($row, $agency)], 201);
    }

    /** GET /api/host-requests/mine */
    public function mine()
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);
        if (!Schema::hasTable('hosts')) return response()->json(['status' => 'none']);

        $row = DB::table('hosts')
            ->where('user_id', $u->id)
            ->whereIn('status', ['pending', 'approved'])
            ->orderByDesc('id')
            ->first();

        if (!$row) return response()->json(['status' => 'none']);

        $agency = $this->resolveAgencyByRecordId((int) $row->agency_id);
        return response()->json($this->shapeMine($row, $agency));
    }

    /** POST /api/host-requests/mine/cancel */
    public function cancel()
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);
        if (!Schema::hasTable('hosts')) return response()->json(['ok' => true]);

        DB::table('hosts')
            ->where('user_id', $u->id)
            ->whereIn('status', ['pending', 'approved'])
            ->update([
                'status'      => 'removed',
                'removed_at'  => now(),
                'updated_at'  => now(),
            ]);

        return response()->json(['ok' => true, 'status' => 'none']);
    }

    /** POST /api/host-requests/mine/change  body: { new_agency_user_id, reason? } */
    public function change(Request $request)
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);

        $data = $request->validate([
            'new_agency_user_id' => 'required|integer|min:1',
            'reason'             => 'nullable|string|max:500',
        ]);

        $newAgency = $this->resolveAgencyByOwner((int) $data['new_agency_user_id']);
        if (!$newAgency) {
            return response()->json(['message' => 'নতুন এজেন্সি খুঁজে পাওয়া যায়নি।'], 404);
        }

        // Cancel current pending/approved
        DB::table('hosts')
            ->where('user_id', $u->id)
            ->whereIn('status', ['pending', 'approved'])
            ->update([
                'status'     => 'removed',
                'removed_at' => now(),
                'updated_at' => now(),
            ]);

        $id = DB::table('hosts')->insertGetId([
            'user_id'    => $u->id,
            'agency_id'  => $newAgency->id,
            'status'     => 'pending',
            'notes'      => 'Change request: ' . ($data['reason'] ?? ''),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('hosts')->where('id', $id)->first();
        return response()->json(['ok' => true, 'mine' => $this->shapeMine($row, $newAgency)], 201);
    }
}
