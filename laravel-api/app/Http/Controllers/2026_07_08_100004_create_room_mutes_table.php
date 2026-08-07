<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('room_mutes', function (Blueprint $table) {
            $table->id();
            $table->enum('room_type', ['live', 'party']);
            $table->unsignedBigInteger('room_id');
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('muted_by')->constrained('users')->cascadeOnDelete();
            $table->enum('scope', ['chat', 'mic', 'both'])->default('chat');
            $table->timestamp('expires_at')->nullable();  // null = until unmuted
            $table->string('reason', 255)->nullable();
            $table->timestamps();
            $table->unique(['room_type', 'room_id', 'user_id']);
            $table->index(['room_type', 'room_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_mutes');
    }
};
