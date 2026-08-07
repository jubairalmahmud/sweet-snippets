<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('admin_id');
            $t->string('action', 64);             // ban_user, approve_deposit, etc.
            $t->string('target_type', 32)->nullable();
            $t->unsignedBigInteger('target_id')->nullable();
            $t->json('meta')->nullable();
            $t->string('ip', 64)->nullable();
            $t->timestamps();
            $t->index(['admin_id', 'id']);
            $t->index(['action', 'id']);
        });
    }
    public function down(): void { Schema::dropIfExists('audit_logs'); }
};
