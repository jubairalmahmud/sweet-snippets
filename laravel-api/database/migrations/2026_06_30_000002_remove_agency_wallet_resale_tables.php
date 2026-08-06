<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::dropIfExists('wallet_transfers');

        Schema::table('agencies', function (Blueprint $table) {
            if (Schema::hasColumn('agencies', 'wallet_r_coins')) {
                $table->dropColumn('wallet_r_coins');
            }
            if (Schema::hasColumn('agencies', 'wallet_diamonds')) {
                $table->dropColumn('wallet_diamonds');
            }
        });
    }

    public function down(): void
    {
        Schema::table('agencies', function (Blueprint $table) {
            if (!Schema::hasColumn('agencies', 'wallet_diamonds')) {
                $table->unsignedBigInteger('wallet_diamonds')->default(0)->after('base_salary_rules');
            }
            if (!Schema::hasColumn('agencies', 'wallet_r_coins')) {
                $table->unsignedBigInteger('wallet_r_coins')->default(0)->after('wallet_diamonds');
            }
        });
    }
};
