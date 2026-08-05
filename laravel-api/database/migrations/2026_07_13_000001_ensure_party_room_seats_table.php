<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Ensure the party_room_seats table exists. On some live databases (imported
 * from an SQL dump) party_rooms exists but party_room_seats was never created,
 * so every seat join fails and shape() returns zero seats. This creates it if
 * missing (and adds the `muted` column if the table exists without it).
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('party_room_seats')) {
            Schema::create('party_room_seats', function (Blueprint $t) {
                $t->bigIncrements('id');
                $t->unsignedBigInteger('room_id');
                $t->unsignedTinyInteger('seat_num');
                $t->unsignedBigInteger('user_id')->nullable();
                $t->string('occupant_name', 191)->nullable();
                $t->string('occupant_avatar', 2048)->nullable();
                $t->boolean('muted')->default(false);
                $t->timestamp('joined_at')->nullable();
                $t->timestamp('left_at')->nullable();
                $t->timestamps();
                $t->index(['room_id', 'left_at']);
                $t->index(['room_id', 'seat_num']);
            });
        } elseif (! Schema::hasColumn('party_room_seats', 'muted')) {
            Schema::table('party_room_seats', function (Blueprint $t) {
                $t->boolean('muted')->default(false);
            });
        }
    }

    public function down(): void
    {
        // Non-destructive: never drop the seats table on rollback.
    }
};
