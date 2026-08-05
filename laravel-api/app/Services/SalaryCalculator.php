<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Auto-calculates salary/bonus for an agency in a given month.
 * Rule (single source of truth):
 *   salary_usd = points * points_to_usd
 *   bonus_usd  = apply(bonus_rules, points, days, hours)
 *   total_usd  = salary_usd + bonus_usd
 *   agency_share_usd = sum_total * share_pct / 100
 *   net_payable_usd  = sum_total - agency_share_usd
 */
class SalaryCalculator
{
    /** Latest active global settings. */
    public function settings(): object
    {
        $row = DB::table('salary_settings')->where('active', true)->orderByDesc('id')->first();
        return $row ?: (object)[
            'points_to_usd' => 0,
            'default_agency_share_pct' => 20,
            'min_days' => 0,
            'min_hours' => 0,
            'points_source' => 'diamonds',
            'bonus_rules' => '[]',
        ];
    }

    /** Effective share % for an agency at a given date (YYYY-MM-DD). */
    public function agencySharePct(int $agencyId, string $onDate): float
    {
        $s = $this->settings();
        $default = (float) ($s->default_agency_share_pct ?? 20);
        if (!Schema::hasTable('agency_share_overrides')) return $default;

        $ov = DB::table('agency_share_overrides')
            ->where('agency_id', $agencyId)
            ->where('effective_from', '<=', $onDate)
            ->orderByDesc('effective_from')
            ->orderByDesc('id')
            ->first();
        return $ov ? (float) $ov->share_pct : $default;
    }

    /** Resolve host user IDs approved under the agency. */
    public function agencyHostIds(int $agencyId): array
    {
        if (!Schema::hasTable('hosts')) return [];
        return DB::table('hosts')
            ->where('agency_id', $agencyId)
            ->where('status', 'approved')
            ->pluck('user_id')->map(fn ($v) => (int) $v)->all();
    }

    /** Live-preview compute for [year, month]. Returns summary + rows (not persisted). */
    public function compute(int $agencyId, int $year, int $month): array
    {
        $settings = $this->settings();
        $rate = (float) ($settings->points_to_usd ?? 0);
        $source = ($settings->points_source ?? 'diamonds') === 'coins' ? 'coins_earned' : 'diamonds_earned';
        $bonusRules = $this->decodeRules($settings->bonus_rules ?? '[]');

        $start = Carbon::createFromDate($year, $month, 1)->startOfMonth()->toDateString();
        $end   = Carbon::createFromDate($year, $month, 1)->endOfMonth()->toDateString();
        $sharePct = $this->agencySharePct($agencyId, $end);

        $hostIds = $this->agencyHostIds($agencyId);
        if (empty($hostIds)) {
            return $this->emptyResult($year, $month, $rate, $sharePct, $start, $end);
        }

        // Aggregate from host_reports.
        $agg = DB::table('host_reports')
            ->whereIn('host_user_id', $hostIds)
            ->whereBetween('report_date', [$start, $end])
            ->select(
                'host_user_id',
                DB::raw("COUNT(DISTINCT report_date) as days"),
                DB::raw("SUM(live_hours) as hours"),
                DB::raw("SUM($source) as points")
            )
            ->groupBy('host_user_id')
            ->get()
            ->keyBy('host_user_id');

        $users = DB::table('users')->whereIn('id', $hostIds)
            ->get(['id', 'name', Schema::hasColumn('users', 'username') ? 'username' : DB::raw("'' as username")])
            ->keyBy('id');

        $rows = [];
        $sumSalary = 0.0; $sumBonus = 0.0; $sumTotal = 0.0; $sl = 1;
        foreach ($hostIds as $uid) {
            $r = $agg->get($uid);
            $days = (int) ($r->days ?? 0);
            $hours = (float) ($r->hours ?? 0);
            $points = (int) ($r->points ?? 0);
            $salary = round($points * $rate, 2);
            $bonus = $this->calcBonus($bonusRules, $points, $days, $hours, $settings);
            $total = round($salary + $bonus, 2);

            $u = $users->get($uid);
            $rows[] = [
                'sl' => $sl++,
                'host_user_id' => (int) $uid,
                'id_code' => (string) $uid,
                'name' => $u->name ?? ("User #$uid"),
                'days' => $days,
                'hours' => $hours,
                'points' => $points,
                'salary_usd' => $salary,
                'bonus_usd' => $bonus,
                'total_usd' => $total,
                'note' => null,
            ];
            $sumSalary += $salary; $sumBonus += $bonus; $sumTotal += $total;
        }

        $agencyShare = round($sumTotal * $sharePct / 100, 2);
        $netPayable = round($sumTotal - $agencyShare, 2);

        return [
            'year' => $year, 'month' => $month,
            'period_start' => $start, 'period_end' => $end,
            'status' => 'preview',
            'points_to_usd' => $rate,
            'agency_share_pct' => $sharePct,
            'summary' => [
                'sum_salary_usd' => round($sumSalary, 2),
                'sum_bonus_usd' => round($sumBonus, 2),
                'sum_total_usd' => round($sumTotal, 2),
                'agency_share_usd' => $agencyShare,
                'net_payable_usd' => $netPayable,
            ],
            'rows' => $rows,
        ];
    }

    /** Return locked snapshot if present, else live preview. */
    public function computeOrLocked(int $agencyId, int $year, int $month): array
    {
        $period = DB::table('salary_periods')
            ->where('agency_id', $agencyId)->where('year', $year)->where('month', $month)
            ->first();
        if (!$period || $period->status !== 'locked') {
            return $this->compute($agencyId, $year, $month);
        }
        $lines = DB::table('salary_lines')->where('period_id', $period->id)->orderBy('id')->get();
        $userIds = $lines->pluck('host_user_id')->all();
        $users = DB::table('users')->whereIn('id', $userIds ?: [0])->get(['id', 'name'])->keyBy('id');

        $rows = [];
        $sl = 1;
        foreach ($lines as $l) {
            $u = $users->get($l->host_user_id);
            $rows[] = [
                'sl' => $sl++,
                'host_user_id' => (int) $l->host_user_id,
                'id_code' => (string) $l->host_user_id,
                'name' => $u->name ?? ("User #" . $l->host_user_id),
                'days' => (int) $l->days,
                'hours' => (float) $l->hours,
                'points' => (int) $l->points,
                'salary_usd' => (float) $l->salary_usd,
                'bonus_usd' => (float) $l->bonus_usd,
                'total_usd' => (float) $l->total_usd,
                'note' => $l->note,
                'line_id' => (int) $l->id,
                'overridden' => (bool) $l->overridden,
            ];
        }

        $start = Carbon::createFromDate($year, $month, 1)->startOfMonth()->toDateString();
        $end   = Carbon::createFromDate($year, $month, 1)->endOfMonth()->toDateString();

        return [
            'year' => $year, 'month' => $month,
            'period_start' => $start, 'period_end' => $end,
            'status' => 'locked',
            'period_id' => (int) $period->id,
            'points_to_usd' => (float) $period->points_to_usd,
            'agency_share_pct' => (float) $period->agency_share_pct,
            'summary' => [
                'sum_salary_usd' => (float) $period->sum_salary_usd,
                'sum_bonus_usd' => (float) $period->sum_bonus_usd,
                'sum_total_usd' => (float) $period->sum_total_usd,
                'agency_share_usd' => (float) $period->agency_share_usd,
                'net_payable_usd' => (float) $period->net_payable_usd,
            ],
            'rows' => $rows,
        ];
    }

    protected function decodeRules($raw): array
    {
        if (is_array($raw)) return $raw;
        $d = json_decode((string) $raw, true);
        return is_array($d) ? $d : [];
    }

    protected function calcBonus(array $rules, int $points, int $days, float $hours, object $settings): float
    {
        if (empty($rules)) return 0.0;
        $minDays = (int) ($settings->min_days ?? 0);
        $minHours = (float) ($settings->min_hours ?? 0);
        if ($days < $minDays || $hours < $minHours) return 0.0;

        // Tiered by points: pick highest tier the host qualifies for.
        $best = 0.0;
        foreach ($rules as $t) {
            $minP = (int) ($t['min_points'] ?? 0);
            $b = (float) ($t['bonus_usd'] ?? 0);
            if ($points >= $minP && $b > $best) $best = $b;
        }
        return round($best, 2);
    }

    protected function emptyResult(int $y, int $m, float $rate, float $sharePct, string $start, string $end): array
    {
        return [
            'year' => $y, 'month' => $m, 'period_start' => $start, 'period_end' => $end,
            'status' => 'preview', 'points_to_usd' => $rate, 'agency_share_pct' => $sharePct,
            'summary' => [
                'sum_salary_usd' => 0, 'sum_bonus_usd' => 0, 'sum_total_usd' => 0,
                'agency_share_usd' => 0, 'net_payable_usd' => 0,
            ],
            'rows' => [],
        ];
    }
}
