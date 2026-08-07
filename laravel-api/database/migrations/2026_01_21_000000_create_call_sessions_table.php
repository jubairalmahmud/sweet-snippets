<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('call_sessions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('caller_id');
            $table->unsignedBigInteger('host_user_id')->nullable();
            $table->string('host_name', 120);
            $table->unsignedInteger('rate_per_minute')->default(0);
            $table->unsignedInteger('charged_diamonds')->default(0);
            $table->unsignedInteger('duration_seconds')->default(0);
            $table->string('status', 24)->default('dialing');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['caller_id', 'id']);
            $table->index(['status', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('call_sessions');
    }
};
