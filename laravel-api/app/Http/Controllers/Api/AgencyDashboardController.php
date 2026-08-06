<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Agency owner-facing endpoints.
 * Read-only for target; hosts/requests are managed by the agency owner.
 */
class AgencyDashboardController extends Controller
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

    protected function syncLegacyAgencyToApplication(object $legacyAgency): ?int
    {
        if (!Schema::hasTable('agency_applications')) return null;

        $ownerId = (int) ($legacyAgency->owner_id ?? $legacyAgency->user_id ?? 0);
        if (!$ownerId) return null;

        $existing = DB::table('agency_applications')
            ->where('user_id', $ownerId)
            ->where('status', 'approved')
            ->orderByDesc('id')
            ->first();
        if ($existing) return (int) $existing->id;

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
            return (int) DB::table('agency_applications')->insertGetId($row);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /** Resolve the agency owned by the authenticated user (new applications first, legacy agencies fallback). */
    protected function currentAgencyId(): ?int
    {
        $user = Auth::user();
        if (!$user) return null;

        if (Schema::hasTable('agency_applications')) {
            $row = DB::table('agency_applications')
                ->where('user_id', $user->id)
                ->where('status', 'approved')
                ->orderByDesc('id')
                ->first();
            if ($row) return (int) $row->id;
        }

        if (Schema::hasTable('agencies')) {
            $ownerColumn = $this->tableColumn('agencies', ['owner_id', 'user_id']);
            if ($ownerColumn) {
                $legacy = DB::table('agencies')->where($ownerColumn, $user->id)->orderByDesc('id')->first();
                if ($legacy && $this->approvedStatus($legacy->status ?? ($legacy->state ?? 'approved'))) {
                    return $this->syncLegacyAgencyToApplication($legacy) ?: (int) $legacy->id;
                }
            }
        }

        return null;
    }

    protected function userColumns(): array
    {
        $cols = ['id', 'name'];
        foreach (['username', 'email', 'avatar', 'avatar_url', 'gender', 'wallet'] as $c) {
            if (Schema::hasColumn('users', $c)) $cols[] = $c;
        }
        return $cols;
    }

    protected function shapeUser($u): array
    {
        if (!$u) return [];
        $avatar = $u->avatar_url ?? $u->avatar ?? null;
        return [
            'id' => (int) $u->id,
            'name' => $u->name ?? '',
            'username' => $u->username ?? null,
            'email' => $u->email ?? null,
            'avatar' => $avatar,
            'gender' => $u->gender ?? null,
        ];
    }

    /** GET /api/agency/hosts — approved hosts under this agency + progress. */
    public function hosts(Request $request)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $hosts = DB::table('hosts')
            ->where('agency_id', $agencyId)
            ->where('status', 'approved')
            ->get();

        $userIds = $hosts->pluck('user_id')->all();
        $users = empty($userIds) ? collect()
            : DB::table('users')->whereIn('id', $userIds)->get($this->userColumns())->keyBy('id');

        $target = $this->activeTarget();
        [$start, $end] = $this->currentPeriod($target);

        $totals = DB::table('host_reports')
            ->whereIn('host_user_id', $userIds ?: [0])
            ->whereBetween('report_date', [$start, $end])
            ->select(
                'host_user_id',
                DB::raw('SUM(coins_earned) as coins'),
                DB::raw('SUM(live_hours) as hours'),
                DB::raw('SUM(diamonds_earned) as diamonds')
            )
            ->groupBy('host_user_id')
            ->get()
            ->keyBy('host_user_id');

        $data = $hosts->map(function ($h) use ($users, $totals, $target) {
            $u = $users->get($h->user_id);
            $t = $totals->get($h->user_id);
            $coins = (int) ($t->coins ?? 0);
            $hours = (float) ($t->hours ?? 0);
            $dias = (int) ($t->diamonds ?? 0);
            return [
                'host_id' => (int) $h->id,
                'user' => $this->shapeUser($u),
                'joined_at' => $h->joined_at,
                'progress' => [
                    'coins_earned' => $coins,
                    'live_hours' => $hours,
                    'diamonds_earned' => $dias,
                    'coins_pct' => $target && $target->coins_target ? min(100, round($coins / $target->coins_target * 100, 1)) : null,
                    'hours_pct' => $target && $target->live_hours_target ? min(100, round($hours / $target->live_hours_target * 100, 1)) : null,
                    'diamonds_pct' => $target && $target->diamonds_target ? min(100, round($dias / $target->diamonds_target * 100, 1)) : null,
                ],
            ];
        })->values();

        return response()->json(['hosts' => $data]);
    }

    /** GET /api/agency/host-requests — pending join requests. */
    public function hostRequests(Request $request)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $rows = DB::table('hosts')
            ->where('agency_id', $agencyId)
            ->where('status', 'pending')
            ->orderByDesc('id')
            ->get();
        $userIds = $rows->pluck('user_id')->all();
        $users = empty($userIds) ? collect()
            : DB::table('users')->whereIn('id', $userIds)->get($this->userColumns())->keyBy('id');

        return response()->json([
            'requests' => $rows->map(fn($r) => [
                'host_id' => (int) $r->id,
                'user' => $this->shapeUser($users->get($r->user_id)),
                'requested_at' => $r->created_at,
                'notes' => $r->notes,
            ])->values(),
        ]);
    }

    /** POST /api/agency/host-requests/{id}/approve */
    public function approveRequest($id)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $row = DB::table('hosts')->where('id', $id)->where('agency_id', $agencyId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);

        DB::table('hosts')->where('id', $id)->update([
            'status' => 'approved',
            'joined_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(['ok' => true]);
    }

    /** POST /api/agency/host-requests/{id}/reject */
    public function rejectRequest($id)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $row = DB::table('hosts')->where('id', $id)->where('agency_id', $agencyId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);

        DB::table('hosts')->where('id', $id)->update([
            'status' => 'rejected',
            'updated_at' => now(),
        ]);
        return response()->json(['ok' => true]);
    }

    /** POST /api/agency/hosts — agency owner manually adds a host by user_id. */
    public function addHost(Request $request)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $userId = (int) $request->input('user_id');
        if (!$userId) return response()->json(['message' => 'user_id required'], 422);

        $exists = DB::table('users')->where('id', $userId)->exists();
        if (!$exists) return response()->json(['message' => 'User not found'], 404);

        $dup = DB::table('hosts')->where('user_id', $userId)->where('agency_id', $agencyId)->first();
        if ($dup) return response()->json(['message' => 'Already added', 'status' => $dup->status], 409);

        DB::table('hosts')->insert([
            'user_id' => $userId,
            'agency_id' => $agencyId,
            'status' => 'approved',
            'joined_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(['ok' => true]);
    }

    /** DELETE /api/agency/hosts/{id} — remove host. */
    public function removeHost($id)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $row = DB::table('hosts')->where('id', $id)->where('agency_id', $agencyId)->first();
        if (!$row) return response()->json(['message' => 'Not found'], 404);

        DB::table('hosts')->where('id', $id)->update([
            'status' => 'removed',
            'removed_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(['ok' => true]);
    }

    /** GET /api/agency/target — active target (read-only for agency). */
    public function target()
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $t = $this->activeTarget();
        return response()->json(['target' => $t]);
    }

    /** GET /api/agency/reports?range=daily|weekly|monthly&host_id=? */
    public function reports(Request $request)
    {
        $agencyId = $this->currentAgencyId();
        if (!$agencyId) return response()->json(['message' => 'Not an approved agency'], 403);

        $range = $request->query('range', 'daily');
        $hostId = (int) $request->query('host_id', 0);
        [$start, $end] = $this->rangeDates($range);

        $userIds = DB::table('hosts')
            ->where('agency_id', $agencyId)
            ->where('status', 'approved')
            ->pluck('user_id')->all();

        if ($hostId && !in_array($hostId, $userIds, true)) {
            return response()->json(['rows' => []]);
        }
        $filter = $hostId ? [$hostId] : ($userIds ?: [0]);

        $rows = DB::table('host_reports')
            ->whereIn('host_user_id', $filter)
            ->whereBetween('report_date', [$start, $end])
            ->orderBy('report_date', 'desc')
            ->get();

        $users = DB::table('users')->whereIn('id', $filter)->get(['id', 'name'])->keyBy('id');

        return response()->json([
            'range' => $range,
            'from' => $start,
            'to' => $end,
            'rows' => $rows->map(fn($r) => [
                'date' => $r->report_date,
                'host_user_id' => (int) $r->host_user_id,
                'host_name' => optional($users->get($r->host_user_id))->name,
                'coins_earned' => (int) $r->coins_earned,
                'live_hours' => (float) $r->live_hours,
                'diamonds_earned' => (int) $r->diamonds_earned,
            ]),
        ]);
    }

    /** GET /api/agency/reports/export?range=... — CSV download. */
    public function exportReports(Request $request): StreamedResponse
    {
        $agencyId = $this->currentAgencyId();
        abort_if(!$agencyId, 403);

        $range = $request->query('range', 'monthly');
        [$start, $end] = $this->rangeDates($range);

        $userIds = DB::table('hosts')
            ->where('agency_id', $agencyId)->where('status', 'approved')->pluck('user_id')->all();

        $rows = DB::table('host_reports')
            ->whereIn('host_user_id', $userIds ?: [0])
            ->whereBetween('report_date', [$start, $end])
            ->orderBy('report_date', 'desc')
            ->get();

        $users = DB::table('users')->whereIn('id', $userIds ?: [0])->get(['id', 'name'])->keyBy('id');

        $filename = "agency_report_{$range}_{$start}_to_{$end}.csv";
        return response()->streamDownload(function () use ($rows, $users) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Date', 'Host ID', 'Host Name', 'Coins Earned', 'Live Hours', 'Diamonds']);
            foreach ($rows as $r) {
                fputcsv($out, [
                    $r->report_date,
                    $r->host_user_id,
                    optional($users->get($r->host_user_id))->name ?? '',
                    $r->coins_earned,
                    $r->live_hours,
                    $r->diamonds_earned,
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    // ----- helpers -----

    protected function activeTarget()
    {
        if (!Schema::hasTable('host_targets')) return null;
        return DB::table('host_targets')
            ->where('active', true)
            ->orderByDesc('id')
            ->first();
    }

    protected function currentPeriod($target): array
    {
        if ($target) return [$target->period_start, $target->period_end];
        return [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()];
    }

    protected function rangeDates(string $range): array
    {
        return match ($range) {
            'daily' => [now()->toDateString(), now()->toDateString()],
            'weekly' => [now()->startOfWeek()->toDateString(), now()->endOfWeek()->toDateString()],
            default => [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()],
        };
    }
}
