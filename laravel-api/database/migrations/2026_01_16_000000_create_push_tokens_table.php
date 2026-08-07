<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('push_tokens', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('user_id');
            $t->string('token', 512);
            $t->string('platform', 16)->default('android'); // android|ios|web
            $t->string('device', 128)->nullable();
            $t->timestamps();
            $t->unique('token');
            $t->index('user_id');
        });
    }
    public function down(): void { Schema::dropIfExists('push_tokens'); }
};
