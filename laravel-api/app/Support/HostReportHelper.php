<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ============================================================================
 *  HostReportHelper — single source of truth for writing to `host_reports`
 * ----------------------------------------------------------------------------
 *  Call this everywhere a host earns coins or finishes a live session, so
 *  the daily aggregation used by CheckHostTargets (cron) stays correct.
 *
 *  Usage:
 *      use App\Support\HostReportHelper;
 *      HostReportHelper::addCoins($receiverUserId, $rCoins);
 *      HostReportHelper::addLiveHours($hostUserId, $secondsStreamed);
 * ============================================================================
 */
class HostReportHelper
{
    /** Increment today's coins_earned for a host (safe to call always). */
    public static function addCoins(?int $hostUserId, int $coins): void
    {
        if (!$hostUserId || $coins <= 0) return;
        if (!Schema::hasTable('host_reports')) return;

        self::upsertToday($hostUserId, $coins, 0.0, 0);
    }

    /** Increment today's live_hours for a host given a raw duration in seconds. */
    public static function addLiveSeconds(?int $hostUserId, int $seconds): void
    {
        if (!$hostUserId || $seconds <= 0) return;
        if (!Schema::hasTable('host_reports')) return;

        $hours = round($seconds / 3600, 4);
        self::upsertToday($hostUserId, 0, $hours, 0);
    }

    /** Increment today's diamonds_earned for a host. */
    public static function addDiamonds(?int $hostUserId, int $diamonds): void
    {
        if (!$hostUserId || $diamonds <= 0) return;
        if (!Schema::hasTable('host_reports')) return;

        self::upsertToday($hostUserId, 0, 0.0, $diamonds);
    }

    /** Combined upsert (INSERT … ON DUPLICATE KEY UPDATE). */
    protected static function upsertToday(int $hostUserId, int $coins, float $hours, int $diamonds): void
    {
        try {
            $agencyId = null;
            if (Schema::hasTable('hosts')) {
                $agencyId = DB::table('hosts')
                    ->where('user_id', $hostUserId)
                    ->where('status', 'approved')
                    ->value('agency_id');
            }

            $now  = now();
            $date = $now->toDateString();

            DB::statement(
                'INSERT INTO host_reports
                    (host_user_id, agency_id, report_date, coins_earned, live_hours, diamonds_earned, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    coins_earned    = coins_earned    + VALUES(coins_earned),
                    live_hours      = live_hours      + VALUES(live_hours),
                    diamonds_earned = diamonds_earned + VALUES(diamonds_earned),
                    agency_id       = COALESCE(agency_id, VALUES(agency_id)),
                    updated_at      = VALUES(updated_at)',
                [$hostUserId, $agencyId, $date, $coins, $hours, $diamonds, $now, $now]
            );
        } catch (\Throwable $e) {
            // never break the main transaction
        }
    }
}
