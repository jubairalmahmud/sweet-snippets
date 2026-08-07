<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

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

        // Seed Party Themes
        $defaultThemes = [
            ['code' => 'party-theme-1',  'name' => 'Royal Night',   'image_url' => '/assets/party-themes/theme-1.jpg',  'price' => 5000, 'offer_price' => 3500, 'duration_days' => 30, 'sort_order' => 1, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-2',  'name' => 'Neon Vibes',    'image_url' => '/assets/party-themes/theme-2.jpg',  'price' => 4000, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 2, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-3',  'name' => 'Sunset Glow',   'image_url' => '/assets/party-themes/theme-3.jpg',  'price' => 6000, 'offer_price' => 4500, 'duration_days' => 30, 'sort_order' => 3, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-4',  'name' => 'Ocean Blue',    'image_url' => '/assets/party-themes/theme-4.jpg',  'price' => 3500, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 4, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-5',  'name' => 'Purple Haze',   'image_url' => '/assets/party-themes/theme-5.jpg',  'price' => 5500, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 5, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-6',  'name' => 'Golden Hour',   'image_url' => '/assets/party-themes/theme-6.jpg',  'price' => 8000, 'offer_price' => 6000, 'duration_days' => 30, 'sort_order' => 6, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-7',  'name' => 'Mystic Forest', 'image_url' => '/assets/party-themes/theme-7.jpg',  'price' => 4500, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 7, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-8',  'name' => 'Cyber City',    'image_url' => '/assets/party-themes/theme-8.jpg',  'price' => 7000, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 8, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-9',  'name' => 'Rose Garden',   'image_url' => '/assets/party-themes/theme-9.jpg',  'price' => 4000, 'offer_price' => 2800, 'duration_days' => 30, 'sort_order' => 9, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'party-theme-10', 'name' => 'Aurora',        'image_url' => '/assets/party-themes/theme-10.jpg', 'price' => 9000, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 10, 'active' => 1, 'created_at' => now(), 'updated_at' => now()],
        ];
        foreach ($defaultThemes as $theme) {
            if (DB::table('party_themes')->where('code', $theme['code'])->doesntExist()) {
                DB::table('party_themes')->insert($theme);
            }
        }

        // Seed Avatar Frames
        $defaultFrames = [
            ['code' => 'avatar-egol',             'name' => 'Egol',         'image_url' => '/assets/frames/egol.png',             'price_coins' => 500000, 'rarity' => 'epic',      'duration_days' => 30,   'sort_order' => 1, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'avatar-fair',             'name' => 'Fair',         'image_url' => '/assets/frames/fair.png',             'price_coins' => 500000, 'rarity' => 'epic',      'duration_days' => 30,   'sort_order' => 2, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'avatar-king',             'name' => 'KING',         'image_url' => '/assets/frames/king.png',             'price_coins' => 500000, 'rarity' => 'legendary', 'duration_days' => 30,   'sort_order' => 3, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'avatar-queen',            'name' => 'QUEEN',        'image_url' => '/assets/frames/queen.png',            'price_coins' => 500000, 'rarity' => 'legendary', 'duration_days' => 30,   'sort_order' => 4, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'avatar-host-premium',     'name' => 'HOST VIP',     'image_url' => '/assets/frames/host-vip.png',         'price_coins' => 0,      'rarity' => 'rare',      'duration_days' => 3650, 'sort_order' => 5, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'avatar-reseller-premium', 'name' => 'RESELLER VIP', 'image_url' => '/assets/frames/reseller-vip.png',     'price_coins' => 0,      'rarity' => 'rare',      'duration_days' => 3650, 'sort_order' => 6, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'avatar-agency-premium',   'name' => 'AGENCY VIP',   'image_url' => '/assets/frames/agency-vip.png',       'price_coins' => 0,      'rarity' => 'rare',      'duration_days' => 3650, 'sort_order' => 7, 'is_active' => 1, 'created_at' => now(), 'updated_at' => now()],
        ];
        foreach ($defaultFrames as $frame) {
            if (DB::table('frame_catalog')->where('code', $frame['code'])->doesntExist()) {
                DB::table('frame_catalog')->insert($frame);
            }
        }
    }
}

