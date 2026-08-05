<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    public function up(): void
    {
        $email = env('SKLOVE_ADMIN_EMAIL', 'admin@sklove.nit.bd');
        $user = User::firstOrNew(['email' => $email]);

        $user->forceFill([
            'name' => env('SKLOVE_ADMIN_NAME', 'SK Love Admin'),
            'password' => Hash::make(env('SKLOVE_ADMIN_PASSWORD', 'admin123')),
            'diamonds' => 9999,
            'r_coins' => 5000,
            'vip_level' => 5,
            'is_admin' => true,
            'is_banned' => false,
        ])->save();
    }

    public function down(): void
    {
        // Intentionally keep the admin account available.
    }
};
