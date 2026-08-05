<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('agencies', function (Blueprint $t) {
            $t->id();
            $t->string('name', 120);
            $t->string('code', 32)->unique();
            $t->unsignedInteger('commission')->default(10); // %
            $t->unsignedInteger('hosts_count')->default(0);
            $t->enum('status', ['active', 'suspended'])->default('active');
            $t->unsignedInteger('monthly_target')->default(100000);
            $t->unsignedInteger('target_hours')->default(40);
            $t->text('base_salary_rules')->nullable();
            $t->timestamps();
        });

        Schema::create('agency_hosts', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $t->string('name', 120);
            $t->string('username', 64);
            $t->enum('status', ['Active', 'Suspended'])->default('Active');
            $t->unsignedInteger('live_hours')->default(0);
            $t->unsignedInteger('diamonds_received')->default(0);
            $t->string('agency_code', 32);
            $t->boolean('salary_released')->default(false);
            $t->timestamps();
            $t->index('agency_code');
            $t->foreign('agency_code')->references('code')->on('agencies')->cascadeOnUpdate()->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('agency_hosts');
        Schema::dropIfExists('agencies');
    }
};
