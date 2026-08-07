<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. party_themes
        if (!Schema::hasTable('party_themes')) {
            Schema::create('party_themes', function (Blueprint $table) {
                $table->id();
                $table->string('code', 64)->unique();
                $table->string('name', 120);
                $table->text('image_url');
                $table->unsignedInteger('price')->default(0);
                $table->unsignedInteger('offer_price')->nullable();
                $table->unsignedInteger('duration_days')->default(30);
                $table->boolean('active')->default(true);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        // 2. user_party_themes
        if (!Schema::hasTable('user_party_themes')) {
            Schema::create('user_party_themes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('theme_id');
                $table->timestamp('expires_at')->nullable();
                $table->boolean('is_equipped')->default(false);
                $table->timestamps();
            });
        }

        // 3. frame_catalog
        if (!Schema::hasTable('frame_catalog')) {
            Schema::create('frame_catalog', function (Blueprint $table) {
                $table->id();
                $table->string('code', 64)->unique();
                $table->string('name', 120);
                $table->string('image_url', 500)->nullable();
                $table->unsignedInteger('price_coins')->default(0);
                $table->unsignedInteger('vip_level_required')->default(0);
                $table->string('rarity', 32)->default('common');
                $table->unsignedInteger('duration_days')->default(30);
                $table->boolean('is_active')->default(true);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        // 4. user_frames
        if (!Schema::hasTable('user_frames')) {
            Schema::create('user_frames', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('user_id');
                $table->unsignedBigInteger('frame_id');
                $table->timestamp('acquired_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->boolean('is_equipped')->default(false);
                $table->timestamps();
            });
        }

        // Add avatar_frame and entry_effect columns to users if missing
        if (Schema::hasTable('users')) {
            if (!Schema::hasColumn('users', 'avatar_frame')) {
                Schema::table('users', function (Blueprint $table) {
                    $table->string('avatar_frame', 120)->nullable();
                });
            }
            if (!Schema::hasColumn('users', 'entry_effect')) {
                Schema::table('users', function (Blueprint $table) {
                    $table->string('entry_effect', 120)->nullable();
                });
            }
        }

        // Add active_theme columns to party_rooms if missing
        if (Schema::hasTable('party_rooms')) {
            if (!Schema::hasColumn('party_rooms', 'active_theme_id')) {
                Schema::table('party_rooms', function (Blueprint $table) {
                    $table->unsignedBigInteger('active_theme_id')->nullable();
                    $table->text('active_theme_img')->nullable();
                });
            }
        }

        // Seed default Party Themes if table is empty
        if (DB::table('party_themes')->count() === 0) {
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
                if (!DB::table('party_themes')->where('code', $theme['code'])->exists()) {
                    DB::table('party_themes')->insert($theme);
                }
            }
        }

        // Seed default Avatar Frames if table is empty
        if (DB::table('frame_catalog')->count() === 0) {
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
                if (!DB::table('frame_catalog')->where('code', $frame['code'])->exists()) {
                    DB::table('frame_catalog')->insert($frame);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_frames');
        Schema::dropIfExists('frame_catalog');
        Schema::dropIfExists('user_party_themes');
        Schema::dropIfExists('party_themes');
    }
};
