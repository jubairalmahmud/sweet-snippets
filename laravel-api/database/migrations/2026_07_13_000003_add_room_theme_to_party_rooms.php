<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('party_rooms') && ! Schema::hasColumn('party_rooms', 'room_theme')) {
            Schema::table('party_rooms', function (Blueprint $table) {
                $table->string('room_theme', 64)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('party_rooms') && Schema::hasColumn('party_rooms', 'room_theme')) {
            Schema::table('party_rooms', function (Blueprint $table) {
                $table->dropColumn('room_theme');
            });
        }
    }
};
