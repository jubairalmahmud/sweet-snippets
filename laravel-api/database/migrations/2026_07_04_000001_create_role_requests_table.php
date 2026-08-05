<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('role_requests')) {
            Schema::create('role_requests', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('requested_role', 24);
                $table->string('status', 24)->default('pending')->index();
                $table->string('referral_code', 64)->nullable();
                $table->string('phone', 32)->nullable();
                $table->string('message')->nullable();
                $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('reviewed_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'status']);
                $table->index(['requested_role', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('role_requests');
    }
};
