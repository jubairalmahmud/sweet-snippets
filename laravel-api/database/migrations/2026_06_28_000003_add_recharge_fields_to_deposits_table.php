<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deposits', function (Blueprint $table) {
            if (!Schema::hasColumn('deposits', 'phone_number')) {
                $table->string('phone_number', 32)->nullable()->after('tx_id');
            }
            if (!Schema::hasColumn('deposits', 'payment_number')) {
                $table->string('payment_number', 32)->nullable()->after('phone_number');
            }
            if (!Schema::hasColumn('deposits', 'coins')) {
                $table->unsignedInteger('coins')->default(0)->after('diamonds');
            }
        });

        DB::table('app_settings')->updateOrInsert(
            ['key' => 'recharge_config'],
            [
                'value' => json_encode([
                    'paymentNumber' => '01700000000',
                    'diamondRate' => 1.1,
                    'coinRate' => 0,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        Schema::table('deposits', function (Blueprint $table) {
            if (Schema::hasColumn('deposits', 'phone_number')) {
                $table->dropColumn('phone_number');
            }
            if (Schema::hasColumn('deposits', 'payment_number')) {
                $table->dropColumn('payment_number');
            }
            if (Schema::hasColumn('deposits', 'coins')) {
                $table->dropColumn('coins');
            }
        });
    }
};
