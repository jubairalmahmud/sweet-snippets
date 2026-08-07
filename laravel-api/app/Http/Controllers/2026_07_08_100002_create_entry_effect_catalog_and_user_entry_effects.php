<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('entry_effect_catalog', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('name', 120);
            $table->string('animation_url', 500);          // lottie / mp4 / webp
            $table->string('preview_url', 500)->nullable();
            $table->unsignedInteger('price_coins')->default(0);
            $table->unsignedInteger('vip_level_required')->default(0);
            $table->enum('rarity', ['common','rare','epic','legendary'])->default('common');
            $table->unsignedInteger('duration_days')->default(30);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('user_entry_effects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('effect_id')->constrained('entry_effect_catalog')->cascadeOnDelete();
            $table->timestamp('acquired_at')->useCurrent();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_equipped')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'effect_id']);
            $table->index(['user_id', 'is_equipped']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_entry_effects');
        Schema::dropIfExists('entry_effect_catalog');
    }
};
