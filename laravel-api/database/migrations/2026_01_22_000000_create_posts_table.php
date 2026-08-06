<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->longText('body')->nullable();
            $table->longText('media')->nullable();
            $table->string('media_type', 24)->nullable();
            $table->unsignedInteger('likes_count')->default(0);
            $table->json('comments')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'id']);
            $table->index('id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
