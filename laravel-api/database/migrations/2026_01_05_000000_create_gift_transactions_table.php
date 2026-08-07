<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('gift_transactions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $t->foreignId('receiver_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('gift_name', 64);
            $t->string('gift_icon', 16)->nullable();
            $t->unsignedInteger('diamonds');   // cost
            $t->unsignedInteger('r_coins');    // host payout
            $t->string('room_type', 32)->nullable(); // pk | party | call | live
            $t->string('room_id', 64)->nullable();
            $t->timestamps();
            $t->index(['sender_id', 'created_at']);
            $t->index(['receiver_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gift_transactions');
    }
};
