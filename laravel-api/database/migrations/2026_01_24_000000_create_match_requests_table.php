<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('match_requests', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('requester_id');
            $table->unsignedBigInteger('target_user_id');
            $table->unsignedInteger('rate_per_minute')->default(0);
            $table->string('status', 24)->default('pending'); // pending|accepted|rejected|cancelled|expired
            $table->timestamp('responded_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['target_user_id', 'status', 'id']);
            $table->index(['requester_id', 'status', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('match_requests');
    }
};
