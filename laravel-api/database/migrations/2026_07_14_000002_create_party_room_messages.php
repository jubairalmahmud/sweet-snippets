<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Party room chat comments so every viewer sees the same conversation via the
 * room poll (shape()->recentChat). Kept intentionally small; old rows age out
 * of the 30-minute window used by shape().
 */
return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('party_room_messages')) {
            return;
        }
        Schema::create('party_room_messages', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('room_id');
            $t->unsignedBigInteger('user_id')->nullable();
            $t->string('name', 191)->nullable();
            $t->string('text', 500);
            $t->string('reply_to_name', 191)->nullable();
            $t->timestamp('created_at')->nullable();
            $t->index(['room_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_room_messages');
    }
};
