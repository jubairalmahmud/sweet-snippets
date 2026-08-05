<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('live_rooms', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('host_id');
            $t->string('title', 200)->nullable();
            $t->longText('cover')->nullable();
            $t->string('category', 32)->default('general');
            $t->string('country', 8)->nullable();
            $t->boolean('live')->default(true);
            $t->unsignedInteger('viewer_count')->default(0);
            $t->unsignedBigInteger('total_diamonds')->default(0);
            $t->timestamp('started_at')->nullable();
            $t->timestamp('ended_at')->nullable();
            $t->timestamps();
            $t->index(['live', 'viewer_count']);
            $t->index('host_id');
        });

        Schema::create('live_room_viewers', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('room_id');
            $t->unsignedBigInteger('user_id');
            $t->timestamp('joined_at')->nullable();
            $t->timestamp('last_seen_at')->nullable();
            $t->timestamp('left_at')->nullable();
            $t->unique(['room_id', 'user_id']);
            $t->index(['room_id', 'left_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('live_room_viewers');
        Schema::dropIfExists('live_rooms');
    }
};
