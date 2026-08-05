<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('role', 24)->default('user')->after('is_admin')->index();
            });
        }

        if (! Schema::hasTable('wallet_transfers')) {
            Schema::create('wallet_transfers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();
                $table->string('sender_role', 24)->nullable();
                $table->string('receiver_role', 24)->nullable();
                $table->unsignedBigInteger('diamonds')->default(0);
                $table->unsignedBigInteger('r_coins')->default(0);
                $table->string('source', 32)->default('reseller');
                $table->string('note')->nullable();
                $table->timestamps();
                $table->index(['receiver_id', 'created_at']);
                $table->index(['sender_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transfers');

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('role');
            });
        }
    }
};
