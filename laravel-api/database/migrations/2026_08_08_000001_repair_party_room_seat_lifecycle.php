<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('party_room_seats')) {
            return;
        }

        // Root cause of cross-device seat loss on the imported live database:
        // left_at used to auto-fill/update with CURRENT_TIMESTAMP, making a
        // newly occupied seat immediately look inactive to every other client.
        DB::statement(
            "ALTER TABLE `party_room_seats` " .
            "MODIFY `joined_at` TIMESTAMP NULL DEFAULT NULL, " .
            "MODIFY `left_at` TIMESTAMP NULL DEFAULT NULL"
        );
    }

    public function down(): void
    {
        // Intentionally non-destructive. Restoring the broken automatic
        // timestamp behavior would reintroduce seat auto-kicks.
    }
};
