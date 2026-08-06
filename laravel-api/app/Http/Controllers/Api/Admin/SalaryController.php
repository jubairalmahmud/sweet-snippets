<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\SalaryCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin: preview / lock / edit salary lines.
 *   GET  /api/admin/salary/preview?agency_id=&year=&month=
 *   POST /api/admin/salary/{agency_id}/{year}/{month}/lock
 *   POST /api/admin/salary/{agency_id}/{year}/{month}/unlock
 *   PUT  /api/admin/salary/lines/{id}
 */
class SalaryController extends Controller
{
    public function __construct(protected SalaryCalculator $calc) {}

    protected function ensureAdmin(): ?\Illuminate\Http\JsonResponse
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthenticated'], 401);
        $isAdmin = ($u->role ?? null) === 'admin' || ($u->is_admin ?? false);
        if (!$isAdmin && Schema::hasTable('user_roles')) {
            $isAdmin = DB::table('user_roles')->where('user_id', $u->id)->where('role', 'admin')->exists();
        }
        if (!$isAdmin) return response()->json(['message' => 'Forbidden'], 403);
        return null;
    }

    public function preview(Request $req)
    {
        if ($e = $this->ensureAdmin()) return $e;
        $agencyId = (int) $req->query('agency_id');
        $year = (int) $req->query('year', now()->year);
        $month = (int) $req->query('month', now()->month);
        if (!$agencyId) return response()->json(['message' => 'agency_id required'], 422);
        return response()->json($this->calc->computeOrLocked($agencyId, $year, $month));
    }

    public function lock($agencyId, $year, $month)
    {
        if ($e = $this->ensureAdmin()) return $e;
        $agencyId = (int) $agencyId; $year = (int) $year; $month = (int) $month;
        $data = $this->calc->compute($agencyId, $year, $month);

        return DB::transaction(function () use ($agencyId, $year, $month, $data) {
            $existing = DB::table('salary_periods')
                ->where('agency_id', $agencyId)->where('year', $year)->where('month', $month)->first();

            $periodId = $existing?->id;
            $payload = [
                'agency_id' => $agencyId, 'year' => $year, 'month' => $month, 'status' => 'locked',
                'points_to_usd' => $data['points_to_usd'],
                'agency_share_pct' => $data['agency_share_pct'],
                'sum_salary_usd' => $data['summary']['sum_salary_usd'],
                'sum_bonus_usd' => $data['summary']['sum_bonus_usd'],
                'sum_total_usd' => $data['summary']['sum_total_usd'],
                'agency_share_usd' => $data['summary']['agency_share_usd'],
                'net_payable_usd' => $data['summary']['net_payable_usd'],
                'locked_at' => now(), 'locked_by' => Auth::id(), 'updated_at' => now(),
            ];

            if ($periodId) {
                DB::table('salary_periods')->where('id', $periodId)->update($payload);
                DB::table('salary_lines')->where('period_id', $periodId)->delete();
            } else {
                $payload['created_at'] = now();
                $periodId = DB::table('salary_periods')->insertGetId($payload);
            }

            foreach ($data['rows'] as $r) {
                DB::table('salary_lines')->insert([
                    'period_id' => $periodId,
                    'host_user_id' => $r['host_user_id'],
                    'days' => $r['days'], 'hours' => $r['hours'], 'points' => $r['points'],
                    'salary_usd' => $r['salary_usd'], 'bonus_usd' => $r['bonus_usd'], 'total_usd' => $r['total_usd'],
                    'note' => $r['note'] ?? null, 'overridden' => false,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            return response()->json(['ok' => true, 'period_id' => $periodId]);
        });
    }

    public function unlock($agencyId, $year, $month)
    {
        if ($e = $this->ensureAdmin()) return $e;
        DB::table('salary_periods')
            ->where('agency_id', $agencyId)->where('year', $year)->where('month', $month)
            ->update(['status' => 'draft', 'updated_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function updateLine(Request $req, $id)
    {
        if ($e = $this->ensureAdmin()) return $e;
        $data = $req->validate([
            'days' => 'nullable|integer|min:0',
            'hours' => 'nullable|numeric|min:0',
            'points' => 'nullable|integer|min:0',
            'salary_usd' => 'nullable|numeric|min:0',
            'bonus_usd' => 'nullable|numeric|min:0',
            'note' => 'nullable|string|max:255',
        ]);
        $line = DB::table('salary_lines')->where('id', $id)->first();
        if (!$line) return response()->json(['message' => 'Line not found'], 404);

        $days = $data['days'] ?? $line->days;
        $hours = $data['hours'] ?? $line->hours;
        $points = $data['points'] ?? $line->points;
        $salary = $data['salary_usd'] ?? $line->salary_usd;
        $bonus = $data['bonus_usd'] ?? $line->bonus_usd;
        $total = round(((float) $salary) + ((float) $bonus), 2);

        DB::table('salary_lines')->where('id', $id)->update([
            'days' => $days, 'hours' => $hours, 'points' => $points,
            'salary_usd' => $salary, 'bonus_usd' => $bonus, 'total_usd' => $total,
            'note' => $data['note'] ?? $line->note, 'overridden' => true, 'updated_at' => now(),
        ]);

        // Recompute period summary from lines.
        $agg = DB::table('salary_lines')->where('period_id', $line->period_id)
            ->selectRaw('SUM(salary_usd) s, SUM(bonus_usd) b, SUM(total_usd) t')->first();
        $period = DB::table('salary_periods')->where('id', $line->period_id)->first();
        $sharePct = (float) $period->agency_share_pct;
        $t = (float) ($agg->t ?? 0);
        $share = round($t * $sharePct / 100, 2);
        DB::table('salary_periods')->where('id', $line->period_id)->update([
            'sum_salary_usd' => (float) ($agg->s ?? 0),
            'sum_bonus_usd' => (float) ($agg->b ?? 0),
            'sum_total_usd' => $t,
            'agency_share_usd' => $share,
            'net_payable_usd' => round($t - $share, 2),
            'updated_at' => now(),
        ]);
        return response()->json(['ok' => true]);
    }
}
