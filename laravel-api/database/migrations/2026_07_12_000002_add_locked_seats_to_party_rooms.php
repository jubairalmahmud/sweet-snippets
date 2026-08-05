<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('party_rooms') && ! Schema::hasColumn('party_rooms', 'locked_seats')) {
            Schema::table('party_rooms', function (Blueprint $table) {
                // JSON array of locked seat indexes (0-based). Nullable so old rows are fine.
                $table->text('locked_seats')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('party_rooms') && Schema::hasColumn('party_rooms', 'locked_seats')) {
            Schema::table('party_rooms', function (Blueprint $table) {
                $table->dropColumn('locked_seats');
            });
        }
    }
};
