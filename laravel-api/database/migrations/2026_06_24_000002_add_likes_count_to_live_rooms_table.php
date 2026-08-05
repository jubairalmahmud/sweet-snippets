<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('live_rooms', function (Blueprint $table) {
            if (!Schema::hasColumn('live_rooms', 'likes_count')) {
                $table->unsignedBigInteger('likes_count')->default(0)->after('total_diamonds');
            }
        });
    }

    public function down(): void
    {
        Schema::table('live_rooms', function (Blueprint $table) {
            if (Schema::hasColumn('live_rooms', 'likes_count')) {
                $table->dropColumn('likes_count');
            }
        });
    }
};
