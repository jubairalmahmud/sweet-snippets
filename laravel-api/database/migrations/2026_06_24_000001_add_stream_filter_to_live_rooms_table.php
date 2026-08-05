<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('live_rooms', function (Blueprint $table) {
            if (!Schema::hasColumn('live_rooms', 'stream_filter')) {
                $table->string('stream_filter', 64)->nullable()->after('cover');
            }
        });
    }

    public function down(): void
    {
        Schema::table('live_rooms', function (Blueprint $table) {
            if (Schema::hasColumn('live_rooms', 'stream_filter')) {
                $table->dropColumn('stream_filter');
            }
        });
    }
};
