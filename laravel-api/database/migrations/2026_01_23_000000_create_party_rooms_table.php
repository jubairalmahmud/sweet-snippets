<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('party_rooms', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('host_id');
            $t->string('title', 200)->nullable();
            $t->unsignedTinyInteger('max_guest_seats')->default(10);
            $t->boolean('live')->default(true);
            $t->unsignedInteger('viewer_count')->default(0);
            $t->unsignedBigInteger('total_diamonds')->default(0);
            $t->timestamp('started_at')->nullable();
            $t->timestamp('ended_at')->nullable();
            $t->timestamps();
            $t->index(['live', 'id']);
            $t->index('host_id');
        });

        Schema::create('party_room_seats', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('room_id');
            $t->unsignedTinyInteger('seat_num');
            $t->unsignedBigInteger('user_id')->nullable();
            $t->string('occupant_name', 191)->nullable();
            $t->string('occupant_avatar', 512)->nullable();
            $t->timestamp('joined_at')->nullable();
            $t->timestamp('left_at')->nullable();
            $t->timestamps();
            $t->unique(['room_id', 'seat_num']);
            $t->index(['room_id', 'left_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_room_seats');
        Schema::dropIfExists('party_rooms');
    }
};
