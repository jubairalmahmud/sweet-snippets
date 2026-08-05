<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('gift_catalog', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('emoji', 16)->nullable();
            $table->longText('image')->nullable(); // URL or data-URL
            $table->integer('price')->default(0); // diamonds
            $table->string('category', 32)->default('basic'); // basic|premium|vip|special
            $table->integer('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
            $table->index(['active', 'category', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gift_catalog');
    }
};
