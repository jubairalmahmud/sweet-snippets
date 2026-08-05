<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vip_prices', function (Blueprint $t) {
            $t->unsignedInteger('level')->primary();
            $t->unsignedInteger('price'); // diamonds required
            $t->timestamps();
        });

        // Seed default prices (level * 1000) for levels 1..10
        $now = now();
        $rows = [];
        for ($i = 1; $i <= 10; $i++) {
            $rows[] = ['level' => $i, 'price' => $i * 1000, 'created_at' => $now, 'updated_at' => $now];
        }
        DB::table('vip_prices')->insert($rows);
    }

    public function down(): void
    {
        Schema::dropIfExists('vip_prices');
    }
};
