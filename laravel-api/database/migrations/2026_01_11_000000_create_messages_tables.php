<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Direct messages (1:1) — conversation key is sorted pair
        Schema::create('messages', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('conversation_key', 64);
            $t->unsignedBigInteger('sender_id');
            $t->unsignedBigInteger('receiver_id');
            $t->text('body');
            $t->string('kind', 16)->default('text'); // text|image|gift|system
            $t->timestamp('read_at')->nullable();
            $t->timestamps();
            $t->index(['conversation_key', 'id']);
            $t->index(['receiver_id', 'read_at']);
        });

        // Room/chat messages (live room chat)
        Schema::create('room_messages', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('room_id');
            $t->unsignedBigInteger('user_id');
            $t->text('body');
            $t->string('kind', 16)->default('text'); // text|gift|system
            $t->timestamps();
            $t->index(['room_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_messages');
        Schema::dropIfExists('messages');
    }
};
