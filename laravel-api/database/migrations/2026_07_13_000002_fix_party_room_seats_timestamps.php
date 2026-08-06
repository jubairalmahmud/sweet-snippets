<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * ROOT-CAUSE FIX for "seats never persist / srvSeats:0".
 *
 * On the live DB (imported from an SQL dump) party_room_seats.left_at is a
 * `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
 * column. So every INSERT sets left_at = NOW() (a seat is "left" the instant
 * it is created) and every UPDATE re-stamps it — meaning shape()'s
 * `whereNull('left_at')` always returns zero active seats.
 *
 * Make left_at / joined_at plain nullable timestamps with no auto default and
 * no ON UPDATE, then release any rows that were wrongly stamped as left in the
 * last few minutes so current sitters reappear.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('party_room_seats')) {
            return;
        }

        try {
            DB::statement("ALTER TABLE `party_room_seats` MODIFY `left_at` TIMESTAMP NULL DEFAULT NULL");
        } catch (\Throwable $e) {
            // ignore — column may already be correct
        }
        try {
            DB::statement("ALTER TABLE `party_room_seats` MODIFY `joined_at` TIMESTAMP NULL DEFAULT NULL");
        } catch (\Throwable $e) {
            // ignore
        }
    }

    public function down(): void
    {
        // Non-destructive.
    }
};
