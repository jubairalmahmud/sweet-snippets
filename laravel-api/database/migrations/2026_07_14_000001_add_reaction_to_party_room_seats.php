<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Transient emoji reaction on a seat so every viewer (not just the sender) sees
 * it via the room poll. reaction_until is milliseconds-since-epoch; shape()
 * drops the reaction once it is past.
 */
return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('party_room_seats')) {
            return;
        }
        Schema::table('party_room_seats', function (Blueprint $table) {
            if (! Schema::hasColumn('party_room_seats', 'reaction_emoji')) {
                $table->string('reaction_emoji', 16)->nullable();
            }
            if (! Schema::hasColumn('party_room_seats', 'reaction_until')) {
                $table->unsignedBigInteger('reaction_until')->nullable();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('party_room_seats')) {
            return;
        }
        Schema::table('party_room_seats', function (Blueprint $table) {
            if (Schema::hasColumn('party_room_seats', 'reaction_emoji')) {
                $table->dropColumn('reaction_emoji');
            }
            if (Schema::hasColumn('party_room_seats', 'reaction_until')) {
                $table->dropColumn('reaction_until');
            }
        });
    }
};
