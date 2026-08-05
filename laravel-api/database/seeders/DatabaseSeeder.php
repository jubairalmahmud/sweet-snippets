<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
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
            ]
        );
    }
}
