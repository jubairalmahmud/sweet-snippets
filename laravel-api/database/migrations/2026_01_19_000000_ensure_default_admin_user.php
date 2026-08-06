<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        User::updateOrCreate(
            ['email' => env('SKLOVE_ADMIN_EMAIL', 'admin@sklove.nit.bd')],
            [
                'name' => env('SKLOVE_ADMIN_NAME', 'SK Love Admin'),
                'password' => Hash::make(env('SKLOVE_ADMIN_PASSWORD', 'admin123')),
                'diamonds' => 9999,
                'r_coins' => 5000,
                'vip_level' => 5,
                'is_admin' => true,
                'is_banned' => false,
            ],
        );
    }

    public function down(): void
    {
        // Keep the admin account intact when rolling back unrelated migrations.
    }
};
