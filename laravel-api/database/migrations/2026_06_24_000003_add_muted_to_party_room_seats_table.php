<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('party_room_seats', function (Blueprint $table) {
            if (!Schema::hasColumn('party_room_seats', 'muted')) {
                $table->boolean('muted')->default(false)->after('occupant_avatar');
            }
        });
    }

    public function down(): void
    {
        Schema::table('party_room_seats', function (Blueprint $table) {
            if (Schema::hasColumn('party_room_seats', 'muted')) {
                $table->dropColumn('muted');
            }
        });
    }
};
