<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('follows', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('follower_id');
            $t->unsignedBigInteger('following_id');
            $t->timestamps();
            $t->unique(['follower_id', 'following_id']);
            $t->index('following_id');
        });
    }
    public function down(): void { Schema::dropIfExists('follows'); }
};
