<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-only Approved Agencies monitoring.
 *
 * Primary data model (matches production DB):
 *  - agencies                (id, name, code, status, commission, hosts_count, ...)
 *  - agency_hosts            (agency_code, user_id, role, diamonds_received, live_hours, ...)
 *  - host_reports (optional) (host_user_id, report_date, coins_earned, live_hours, diamonds_earned)
 *  - host_targets (optional) (active, period_start, period_end, coins_target, ...)
 *
 * Also supports the newer `agency_applications` / `hosts` tables when present
 * so nothing gets hidden if both systems co-exist.
 */
class AdminAgencyController extends Controller
{
    protected function agencyCodeFor($app): string
    {
        return 'AG' . (int) ($app->user_id ?? 0);
    }

    protected function syncLegacyAgencyForApplication($app): void
    {
        if (!$app || empty($app->user_id)) return;

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'role')) {
            DB::table('users')
                ->where('id', $app->user_id)
                ->update([
                    'role' => 'agent',
                    'updated_at' => now(),
                ]);
        }

        if (!Schema::hasTable('agencies')) return;

        $code = $this->agencyCodeFor($app);
        $agencyId = null;
        $ownerColumns = ['user_id', 'owner_id', 'created_by', 'admin_id'];

        foreach ($ownerColumns as $column) {
            if (Schema::hasColumn('agencies', $column)) {
                $agencyId = DB::table('agencies')->where($column, $app->user_id)->value('id');
                if ($agencyId) break;
            }
        }

        if (!$agencyId && Schema::hasColumn('agencies', 'code')) {
            $agencyId = DB::table('agencies')->where('code', $code)->value('id');
        }

        $payload = [];
        $map = [
            'name' => $app->agency_name ?? 'Agency ' . $app->user_id,
            'agency_name' => $app->agency_name ?? 'Agency ' . $app->user_id,
            'code' => $code,
            'phone' => $app->phone ?? null,
            'email' => $app->email ?? null,
            'status' => 'active',
            'hosts_count' => is_numeric($app->num_hosts ?? null) ? (int) $app->num_hosts : 0,
            'commission' => 0,
        ];
        foreach ($map as $column => $value) {
            if (Schema::hasColumn('agencies', $column)) $payload[$column] = $value;
        }
        foreach ($ownerColumns as $column) {
            if (Schema::hasColumn('agencies', $column)) $payload[$column] = $app->user_id;
        }
        if (Schema::hasColumn('agencies', 'updated_at')) $payload['updated_at'] = now();

        if ($agencyId) {
            if (!empty($payload)) DB::table('agencies')->where('id', $agencyId)->update($payload);
        } else {
            if (Schema::hasColumn('agencies', 'created_at')) $payload['created_at'] = now();
            $agencyId = DB::table('agencies')->insertGetId($payload);
        }

        // NOTE: agency_hosts holds hosts UNDER the agency, not the owner.
        // Do NOT insert the owner here — hosts join later via host-request flow.
    }

    protected function syncApprovedOwners(): void
    {
        if (!Schema::hasTable('agency_applications')) return;

        $apps = DB::table('agency_applications')
            ->where('status', 'approved')
            ->orderByDesc('id')
            ->get();

        foreach ($apps as $app) {
            $this->syncLegacyAgencyForApplication($app);
        }
    }

    protected function ensureAdmin(): ?\Illuminate\Http\JsonResponse
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);
        $role = strtolower((string) ($u->role ?? ''));
        if (!in_array($role, ['admin', 'superadmin', 'super_admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return null;
    }

    protected function userCols(): array
    {
        $cols = ['id', 'name'];
        foreach (['username', 'email', 'avatar', 'avatar_url', 'gender'] as $c) {
            if (Schema::hasColumn('users', $c)) $cols[] = $c;
        }
        return $cols;
    }

    protected function shapeUser($u): array
    {
        if (!$u) return [];
        return [
            'id' => (int) $u->id,
            'name' => $u->name ?? '',
            'username' => $u->username ?? null,
            'avatar' => $u->avatar_url ?? $u->avatar ?? null,
        ];
    }

    protected function activeTarget()
    {
        if (!Schema::hasTable('host_targets')) return null;
        return DB::table('host_targets')->where('active', true)->orderByDesc('id')->first();
    }

    protected function periodDates($target): array
    {
        if ($target) return [$target->period_start, $target->period_end];
        return [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()];
    }

    /**
     * Resolve owner user_id for a legacy agency row.
     * Tries columns on the row first (owner_id / user_id / created_by),
     * then falls back to agency_hosts where role='owner' | 'admin' | first row.
     */
    protected function resolveOwnerId($ag, ?string $code): ?int
    {
        foreach (['owner_id', 'user_id', 'created_by', 'admin_id'] as $col) {
            if (isset($ag->$col) && (int) $ag->$col > 0) return (int) $ag->$col;
        }
        if ($code && Schema::hasTable('agency_hosts')) {
            $row = null;
            if (Schema::hasColumn('agency_hosts', 'role')) {
                $row = DB::table('agency_hosts')
                    ->where('agency_code', $code)
                    ->whereIn('role', ['owner', 'admin'])
                    ->orderBy('id')->first();
            }
            if (!$row) {
                $row = DB::table('agency_hosts')->where('agency_code', $code)->orderBy('id')->first();
            }
            if ($row && !empty($row->user_id)) return (int) $row->user_id;
        }
        return null;
    }

    /** GET /api/admin/agencies — approved agencies + aggregate performance. */
    public function index()
    {
        if ($r = $this->ensureAdmin()) return $r;
        $this->syncApprovedOwners();

        $target = $this->activeTarget();
        [$start, $end] = $this->periodDates($target);

        $result = [];

        // ============ PRIMARY: legacy `agencies` table ============
        if (Schema::hasTable('agencies')) {
            $rows = DB::table('agencies')->orderByDesc('id')->get();

            // Preload owners for all rows in one query
            $ownerMap = [];
            foreach ($rows as $ag) {
                $ownerMap[$ag->id] = $this->resolveOwnerId($ag, $ag->code ?? null);
            }
            $ownerIds = array_values(array_filter(array_unique($ownerMap)));
            $owners = empty($ownerIds) ? collect()
                : DB::table('users')->whereIn('id', $ownerIds)->get($this->userCols())->keyBy('id');

            foreach ($rows as $ag) {
                $code = $ag->code ?? null;

                // Host user IDs under this agency (via agency_code)
                $hostUserIds = ($code && Schema::hasTable('agency_hosts'))
                    ? DB::table('agency_hosts')->where('agency_code', $code)->pluck('user_id')->filter()->all()
                    : [];

                // Totals: prefer host_reports for the active period, fallback to agency_hosts aggregate
                $totals = (object) ['coins' => 0, 'hours' => 0, 'diamonds' => 0];
                if (!empty($hostUserIds) && Schema::hasTable('host_reports')) {
                    $t = DB::table('host_reports')
                        ->whereIn('host_user_id', $hostUserIds)
                        ->whereBetween('report_date', [$start, $end])
                        ->selectRaw('SUM(coins_earned) as coins, SUM(live_hours) as hours, SUM(diamonds_earned) as diamonds')
                        ->first();
                    if ($t) $totals = $t;
                }
                if ((int) ($totals->diamonds ?? 0) === 0 && $code && Schema::hasTable('agency_hosts')) {
                    $fb = DB::table('agency_hosts')->where('agency_code', $code)
                        ->selectRaw('SUM(diamonds_received) as diamonds, SUM(live_hours) as hours')->first();
                    if ($fb) {
                        $totals->diamonds = (int) ($fb->diamonds ?? 0);
                        $totals->hours = (float) ($fb->hours ?? 0);
                    }
                }

                $ownerUser = ($ownerMap[$ag->id] ?? null) ? $owners->get($ownerMap[$ag->id]) : null;

                $result[] = [
                    'id' => (int) $ag->id,
                    'source' => 'agencies',
                    'code' => $code,
                    'agency_name' => $ag->name ?? $ag->agency_name ?? ('Agency #' . $ag->id),
                    'owner' => $this->shapeUser($ownerUser),
                    'phone' => $ag->phone ?? null,
                    'email' => $ag->email ?? null,
                    'status' => $ag->status ?? 'active',
                    'commission' => (int) ($ag->commission ?? 0),
                    'approved_at' => $ag->updated_at ?? $ag->created_at ?? null,
                    'hosts_count' => count($hostUserIds) ?: (int) ($ag->hosts_count ?? 0),
                    'totals' => [
                        'coins_earned' => (int) ($totals->coins ?? 0),
                        'live_hours' => (float) ($totals->hours ?? 0),
                        'diamonds_earned' => (int) ($totals->diamonds ?? 0),
                    ],
                    'progress' => $this->progressBlock($target, $totals),
                ];
            }
        }

        // ============ SECONDARY: newer `agency_applications` (approved) ============
        // Only include rows that don't duplicate a legacy agency (by user_id === owner id).
        if (Schema::hasTable('agency_applications')) {
            $existingOwners = collect($result)->pluck('owner.id')->filter()->all();
            $apps = DB::table('agency_applications')
                ->where('status', 'approved')
                ->when(!empty($existingOwners), fn($q) => $q->whereNotIn('user_id', $existingOwners))
                ->orderByDesc('id')->get();

            $ownerIds = $apps->pluck('user_id')->filter()->all();
            $owners = empty($ownerIds) ? collect()
                : DB::table('users')->whereIn('id', $ownerIds)->get($this->userCols())->keyBy('id');

            foreach ($apps as $ag) {
                $hostUserIds = Schema::hasTable('hosts')
                    ? DB::table('hosts')->where('agency_id', $ag->id)->where('status', 'approved')->pluck('user_id')->all()
                    : [];

                $totals = (object) ['coins' => 0, 'hours' => 0, 'diamonds' => 0];
                if (!empty($hostUserIds) && Schema::hasTable('host_reports')) {
                    $t = DB::table('host_reports')
                        ->whereIn('host_user_id', $hostUserIds)
                        ->whereBetween('report_date', [$start, $end])
                        ->selectRaw('SUM(coins_earned) as coins, SUM(live_hours) as hours, SUM(diamonds_earned) as diamonds')
                        ->first();
                    if ($t) $totals = $t;
                }

                $result[] = [
                    'id' => (int) $ag->id,
                    'source' => 'applications',
                    'agency_name' => $ag->agency_name ?? $ag->name ?? '—',
                    'owner' => $this->shapeUser($owners->get($ag->user_id)),
                    'phone' => $ag->phone ?? null,
                    'email' => $ag->email ?? null,
                    'approved_at' => $ag->updated_at ?? $ag->created_at ?? null,
                    'hosts_count' => count($hostUserIds),
                    'totals' => [
                        'coins_earned' => (int) ($totals->coins ?? 0),
                        'live_hours' => (float) ($totals->hours ?? 0),
                        'diamonds_earned' => (int) ($totals->diamonds ?? 0),
                    ],
                    'progress' => $this->progressBlock($target, $totals),
                ];
            }
        }

        return response()->json([
            'target' => $target,
            'period' => ['from' => $start, 'to' => $end],
            'agencies' => $result,
        ]);
    }

    protected function progressBlock($target, $totals): array
    {
        return [
            'coins_pct' => $target && $target->coins_target
                ? min(100, round(((int) ($totals->coins ?? 0)) / max(1, (int) $target->coins_target) * 100, 1)) : null,
            'hours_pct' => $target && $target->live_hours_target
                ? min(100, round(((float) ($totals->hours ?? 0)) / max(0.01, (float) $target->live_hours_target) * 100, 1)) : null,
            'diamonds_pct' => $target && $target->diamonds_target
                ? min(100, round(((int) ($totals->diamonds ?? 0)) / max(1, (int) $target->diamonds_target) * 100, 1)) : null,
        ];
    }

    /**
     * GET /api/admin/agencies/{id}/hosts — hosts under an agency + per-host progress.
     * Works for BOTH legacy `agencies` (via agency_code) and new `hosts` table (via agency_id).
     */
    public function hosts($id)
    {
        if ($r = $this->ensureAdmin()) return $r;

        $target = $this->activeTarget();
        [$start, $end] = $this->periodDates($target);

        $hostRows = collect();

        // Legacy path: agencies.id -> agencies.code -> agency_hosts.agency_code
        if (Schema::hasTable('agencies') && Schema::hasTable('agency_hosts')) {
            $ag = DB::table('agencies')->where('id', $id)->first();
            if ($ag && !empty($ag->code)) {
                $rows = DB::table('agency_hosts')->where('agency_code', $ag->code)->get();
                foreach ($rows as $r) {
                    $hostRows->push((object) [
                        'id' => $r->id,
                        'user_id' => $r->user_id,
                        'joined_at' => $r->created_at ?? null,
                        'diamonds_received' => $r->diamonds_received ?? 0,
                        'live_hours' => $r->live_hours ?? 0,
                    ]);
                }
            }
        }

        // New path: hosts.agency_id
        if ($hostRows->isEmpty() && Schema::hasTable('hosts')) {
            $rows = DB::table('hosts')->where('agency_id', $id)->where('status', 'approved')->get();
            foreach ($rows as $r) {
                $hostRows->push((object) [
                    'id' => $r->id,
                    'user_id' => $r->user_id,
                    'joined_at' => $r->joined_at ?? null,
                    'diamonds_received' => 0,
                    'live_hours' => 0,
                ]);
            }
        }

        $userIds = $hostRows->pluck('user_id')->filter()->all();
        $users = empty($userIds) ? collect()
            : DB::table('users')->whereIn('id', $userIds)->get($this->userCols())->keyBy('id');

        $reportTotals = (Schema::hasTable('host_reports') && !empty($userIds))
            ? DB::table('host_reports')
                ->whereIn('host_user_id', $userIds)
                ->whereBetween('report_date', [$start, $end])
                ->selectRaw('host_user_id, SUM(coins_earned) coins, SUM(live_hours) hours, SUM(diamonds_earned) diamonds')
                ->groupBy('host_user_id')->get()->keyBy('host_user_id')
            : collect();

        $out = $hostRows->map(function ($h) use ($users, $reportTotals, $target) {
            $t = $reportTotals->get($h->user_id);
            $coins = (int) ($t->coins ?? 0);
            $hours = (float) ($t->hours ?? $h->live_hours ?? 0);
            $dias = (int) ($t->diamonds ?? $h->diamonds_received ?? 0);
            return [
                'host_id' => (int) $h->id,
                'user' => $this->shapeUser($users->get($h->user_id)),
                'joined_at' => $h->joined_at,
                'coins_earned' => $coins,
                'live_hours' => $hours,
                'diamonds_earned' => $dias,
                'coins_pct' => $target && $target->coins_target
                    ? min(100, round($coins / max(1, (int) $target->coins_target) * 100, 1)) : null,
                'hours_pct' => $target && $target->live_hours_target
                    ? min(100, round($hours / max(0.01, (float) $target->live_hours_target) * 100, 1)) : null,
                'diamonds_pct' => $target && $target->diamonds_target
                    ? min(100, round($dias / max(1, (int) $target->diamonds_target) * 100, 1)) : null,
            ];
        })->values();

        return response()->json([
            'agency_id' => (int) $id,
            'period' => ['from' => $start, 'to' => $end],
            'hosts' => $out,
        ]);
    }

    /** POST /api/admin/agencies/{id}/suspend */
    public function suspend($id)
    {
        if ($r = $this->ensureAdmin()) return $r;

        if (Schema::hasTable('agencies')) {
            DB::table('agencies')->where('id', $id)->update([
                'status' => 'suspended',
                'updated_at' => now(),
            ]);
        }
        if (Schema::hasTable('agency_applications')) {
            DB::table('agency_applications')->where('id', $id)->update([
                'status' => 'suspended',
                'updated_at' => now(),
            ]);
        }
        if (Schema::hasTable('hosts')) {
            DB::table('hosts')->where('agency_id', $id)->update([
                'status' => 'removed',
                'removed_at' => now(),
                'updated_at' => now(),
            ]);
        }
        // Revert the owner's role from 'agent' → 'user' so client-side gates disengage
        if (Schema::hasTable('agency_applications') && Schema::hasColumn('users', 'role')) {
            $app = DB::table('agency_applications')->where('id', $id)->first();
            if ($app && !empty($app->user_id)) {
                DB::table('users')->where('id', $app->user_id)->where('role', 'agent')->update([
                    'role' => 'user',
                    'updated_at' => now(),
                ]);
            }
        }
        return response()->json(['ok' => true]);
    }

    /** POST /api/admin/agencies/{id}/reactivate */
    public function reactivate($id)
    {
        if ($r = $this->ensureAdmin()) return $r;

        if (Schema::hasTable('agencies')) {
            DB::table('agencies')->where('id', $id)->update([
                'status' => 'active',
                'updated_at' => now(),
            ]);
        }
        if (Schema::hasTable('agency_applications')) {
            DB::table('agency_applications')->where('id', $id)->update([
                'status' => 'approved',
                'updated_at' => now(),
            ]);
        }
        // Restore owner's 'agent' role
        if (Schema::hasTable('agency_applications') && Schema::hasColumn('users', 'role')) {
            $app = DB::table('agency_applications')->where('id', $id)->first();
            if ($app && !empty($app->user_id)) {
                DB::table('users')->where('id', $app->user_id)->update([
                    'role' => 'agent',
                    'updated_at' => now(),
                ]);
            }
        }
        return response()->json(['ok' => true]);
    }
}
