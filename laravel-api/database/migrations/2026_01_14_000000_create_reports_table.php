<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('reporter_id');
            $t->string('target_type', 24);   // user|room|message
            $t->unsignedBigInteger('target_id');
            $t->string('reason', 64);
            $t->text('description')->nullable();
            $t->string('status', 16)->default('pending'); // pending|reviewed|dismissed|actioned
            $t->unsignedBigInteger('reviewed_by')->nullable();
            $t->timestamp('reviewed_at')->nullable();
            $t->timestamps();
            $t->index(['status', 'id']);
            $t->index(['target_type', 'target_id']);
        });
    }
    public function down(): void { Schema::dropIfExists('reports'); }
};
