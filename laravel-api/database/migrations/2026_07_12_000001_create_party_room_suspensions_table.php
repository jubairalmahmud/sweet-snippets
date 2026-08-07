<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('party_room_suspensions')) {
            Schema::create('party_room_suspensions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('room_id')->index();
                $table->unsignedBigInteger('user_id')->index();
                $table->timestamp('until')->index();
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->unique(['room_id', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('party_room_suspensions');
    }
};
