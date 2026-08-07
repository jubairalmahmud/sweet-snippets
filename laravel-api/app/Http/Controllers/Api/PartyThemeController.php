<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Throwable;

/**
 * Party Room Theme system.
 *
 * Endpoints:
 *   GET    /api/party-themes/catalog          -> public, list active themes
 *   GET    /api/party-themes/admin/catalog    -> admin, full list (incl. inactive)
 *   POST   /api/party-themes/admin/upsert     -> admin, create/update theme
 *   DELETE /api/party-themes/admin/{id}       -> admin, delete theme
 *   GET    /api/party-themes/my               -> auth, owned themes + equipped id
 *   POST   /api/party-themes/purchase         -> auth, buy a theme with diamonds
 *   POST   /api/party-themes/equip            -> auth, equip (also writes to any
 *                                                room this user hosts so all
 *                                                viewers pick it up)
 *   POST   /api/party-themes/unequip          -> auth
 */
class PartyThemeController extends Controller
{
    // ────────────────────── PUBLIC / CATALOG ──────────────────────
    public function catalog(): array
    {
        $this->ensureTables();
        $rows = DB::table('party_themes')
            ->where('active', 1)
            ->orderBy('sort_order')->orderBy('id')
            ->get();
        return ['themes' => $rows->map(fn ($r) => $this->shape($r))->all()];
    }

    // ────────────────────── ADMIN ──────────────────────
    public function adminCatalog(Request $req): array
    {
        $this->ensureAdmin($req);
        $this->ensureTables();
        $rows = DB::table('party_themes')->orderBy('sort_order')->orderBy('id')->get();
        return ['themes' => $rows->map(fn ($r) => $this->shape($r))->all()];
    }

    public function adminUpsert(Request $req): array
    {
        $this->ensureAdmin($req);
        $this->ensureTables();
        $data = $req->validate([
            'id'            => 'nullable|integer',
            'code'          => 'nullable|string|max:64',
            'name'          => 'required|string|max:120',
            'imageUrl'      => 'required|string',
            'price'         => 'required|integer|min:0',
            'offerPrice'    => 'nullable|integer|min:0',
            'durationDays'  => 'nullable|integer|min:1|max:3650',
            'active'        => 'nullable|boolean',
            'sortOrder'     => 'nullable|integer',
        ]);

        $payload = [
            'code'          => $data['code'] ?? ('theme_' . Str::random(8)),
            'name'          => $data['name'],
            'image_url'     => $data['imageUrl'],
            'price'         => (int) $data['price'],
            'offer_price'   => isset($data['offerPrice']) ? (int) $data['offerPrice'] : null,
            'duration_days' => (int) ($data['durationDays'] ?? 30),
            'active'        => (bool) ($data['active'] ?? true),
            'sort_order'    => (int) ($data['sortOrder'] ?? 0),
            'updated_at'    => now(),
        ];

        if (!empty($data['id'])) {
            DB::table('party_themes')->where('id', $data['id'])->update($payload);
            $id = (int) $data['id'];
        } else {
            $payload['created_at'] = now();
            $id = DB::table('party_themes')->insertGetId($payload);
        }
        $row = DB::table('party_themes')->where('id', $id)->first();
        return ['theme' => $this->shape($row)];
    }

    public function adminSeed(Request $req): array
    {
        $this->ensureAdmin($req);
        $this->ensureTables();

        $defaults = [
            ['code' => 'party-theme-1',  'name' => 'Royal Night',   'image_url' => '/assets/party-themes/theme-1.jpg',  'price' => 5000, 'offer_price' => 3500, 'duration_days' => 30, 'sort_order' => 1],
            ['code' => 'party-theme-2',  'name' => 'Neon Vibes',    'image_url' => '/assets/party-themes/theme-2.jpg',  'price' => 4000, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 2],
            ['code' => 'party-theme-3',  'name' => 'Sunset Glow',   'image_url' => '/assets/party-themes/theme-3.jpg',  'price' => 6000, 'offer_price' => 4500, 'duration_days' => 30, 'sort_order' => 3],
            ['code' => 'party-theme-4',  'name' => 'Ocean Blue',    'image_url' => '/assets/party-themes/theme-4.jpg',  'price' => 3500, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 4],
            ['code' => 'party-theme-5',  'name' => 'Purple Haze',   'image_url' => '/assets/party-themes/theme-5.jpg',  'price' => 5500, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 5],
            ['code' => 'party-theme-6',  'name' => 'Golden Hour',   'image_url' => '/assets/party-themes/theme-6.jpg',  'price' => 8000, 'offer_price' => 6000, 'duration_days' => 30, 'sort_order' => 6],
            ['code' => 'party-theme-7',  'name' => 'Mystic Forest', 'image_url' => '/assets/party-themes/theme-7.jpg',  'price' => 4500, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 7],
            ['code' => 'party-theme-8',  'name' => 'Cyber City',    'image_url' => '/assets/party-themes/theme-8.jpg',  'price' => 7000, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 8],
            ['code' => 'party-theme-9',  'name' => 'Rose Garden',   'image_url' => '/assets/party-themes/theme-9.jpg',  'price' => 4000, 'offer_price' => 2800, 'duration_days' => 30, 'sort_order' => 9],
            ['code' => 'party-theme-10', 'name' => 'Aurora',        'image_url' => '/assets/party-themes/theme-10.jpg', 'price' => 9000, 'offer_price' => null, 'duration_days' => 30, 'sort_order' => 10],
        ];

        $inserted = 0;
        foreach ($defaults as $item) {
            $exists = DB::table('party_themes')->where('code', $item['code'])->exists();
            if (!$exists) {
                DB::table('party_themes')->insert(array_merge($item, [
                    'active' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
                $inserted++;
            }
        }

        $rows = DB::table('party_themes')->orderBy('sort_order')->orderBy('id')->get();
        return ['ok' => true, 'inserted' => $inserted, 'themes' => $rows->map(fn ($r) => $this->shape($r))->all()];
    }

    public function adminDelete(Request $req, int $id): array
    {
        $this->ensureAdmin($req);
        $this->ensureTables();
        DB::table('party_themes')->where('id', $id)->delete();
        DB::table('user_party_themes')->where('theme_id', $id)->delete();
        if (Schema::hasColumn('party_rooms', 'active_theme_id')) {
            DB::table('party_rooms')->where('active_theme_id', $id)
                ->update(['active_theme_id' => null, 'active_theme_img' => null]);
        }
        return ['ok' => true];
    }

    // ────────────────────── USER: OWNED + EQUIPPED ──────────────────────
    public function my(Request $req): array
    {
        $user = $req->user();
        if (!$user) abort(401);
        if (!Schema::hasTable('user_party_themes') || !Schema::hasTable('party_themes')) {
            return ['owned' => [], 'equipped' => null];
        }
        $now = now();
        // auto-expire
        DB::table('user_party_themes')
            ->where('user_id', $user->id)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', $now)
            ->delete();

        $rows = DB::table('user_party_themes as u')
            ->join('party_themes as t', 't.id', '=', 'u.theme_id')
            ->where('u.user_id', $user->id)
            ->select('t.*', 'u.expires_at', 'u.is_equipped')
            ->get();

        $owned = [];
        $equipped = null;
        foreach ($rows as $r) {
            $item = $this->shape($r);
            $item['expiresAt'] = $r->expires_at ? strtotime($r->expires_at) * 1000 : null;
            $item['isEquipped'] = (bool) $r->is_equipped;
            $owned[] = $item;
            if ($r->is_equipped) $equipped = $item['code'];
        }
        return ['owned' => $owned, 'equipped' => $equipped];
    }

    // ────────────────────── PURCHASE ──────────────────────
    public function purchase(Request $req): array
    {
        $user = $req->user();
        if (!$user) abort(401);
        $data = $req->validate([
            'themeId'  => 'nullable|integer',
            'code'     => 'nullable|string|max:64',
        ]);

        $theme = null;
        if (!empty($data['themeId'])) {
            $theme = DB::table('party_themes')->where('id', $data['themeId'])->first();
        } elseif (!empty($data['code'])) {
            $theme = DB::table('party_themes')->where('code', $data['code'])->first();
        }
        if (!$theme) return ['ok' => false, 'error' => 'theme_not_found'];

        $price = (int) ($theme->offer_price ?? $theme->price);

        return DB::transaction(function () use ($user, $theme, $price) {
            $fresh = DB::table('users')->where('id', $user->id)->lockForUpdate()->first();
            if (!$fresh) return ['ok' => false, 'error' => 'user_missing'];
            if ((int) $fresh->diamonds < $price) {
                return ['ok' => false, 'error' => 'insufficient_diamonds'];
            }

            DB::table('users')->where('id', $user->id)
                ->update(['diamonds' => (int) $fresh->diamonds - $price, 'updated_at' => now()]);

            $expiresAt = now()->addDays((int) ($theme->duration_days ?: 30));
            $existing = DB::table('user_party_themes')
                ->where('user_id', $user->id)->where('theme_id', $theme->id)->first();

            if ($existing) {
                DB::table('user_party_themes')->where('id', $existing->id)->update([
                    'expires_at' => $expiresAt,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('user_party_themes')->insert([
                    'user_id'    => $user->id,
                    'theme_id'   => $theme->id,
                    'expires_at' => $expiresAt,
                    'is_equipped'=> 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return [
                'ok'         => true,
                'diamonds'   => (int) $fresh->diamonds - $price,
                'themeId'    => (int) $theme->id,
                'code'       => $theme->code,
                'expiresAt'  => strtotime($expiresAt) * 1000,
            ];
        });
    }

    // ────────────────────── EQUIP / UNEQUIP ──────────────────────
    public function equip(Request $req): array
    {
        $user = $req->user();
        if (!$user) abort(401);
        $data = $req->validate([
            'themeId' => 'nullable|integer',
            'code'    => 'nullable|string|max:64',
        ]);
        $theme = null;
        if (!empty($data['themeId'])) $theme = DB::table('party_themes')->where('id', $data['themeId'])->first();
        elseif (!empty($data['code']))$theme = DB::table('party_themes')->where('code', $data['code'])->first();
        if (!$theme) return ['ok' => false, 'error' => 'theme_not_found'];

        $owned = DB::table('user_party_themes')
            ->where('user_id', $user->id)->where('theme_id', $theme->id)->first();
        if (!$owned) return ['ok' => false, 'error' => 'not_owned'];
        if ($owned->expires_at && strtotime($owned->expires_at) < time()) {
            return ['ok' => false, 'error' => 'expired'];
        }

        DB::table('user_party_themes')->where('user_id', $user->id)
            ->update(['is_equipped' => 0, 'updated_at' => now()]);
        DB::table('user_party_themes')->where('id', $owned->id)
            ->update(['is_equipped' => 1, 'updated_at' => now()]);

        // Propagate to every LIVE party room this user hosts so all viewers
        // immediately get the same background on next /party-rooms/{id} poll.
        if (Schema::hasTable('party_rooms') && Schema::hasColumn('party_rooms', 'active_theme_id')) {
            DB::table('party_rooms')->where('host_id', $user->id)
                ->update([
                    'active_theme_id'  => $theme->id,
                    'active_theme_img' => $theme->image_url,
                    'updated_at'       => now(),
                ]);
        }

        return ['ok' => true, 'code' => $theme->code, 'themeId' => (int) $theme->id];
    }

    public function unequip(Request $req): array
    {
        $user = $req->user();
        if (!$user) abort(401);
        DB::table('user_party_themes')->where('user_id', $user->id)
            ->update(['is_equipped' => 0, 'updated_at' => now()]);
        if (Schema::hasTable('party_rooms') && Schema::hasColumn('party_rooms', 'active_theme_id')) {
            DB::table('party_rooms')->where('host_id', $user->id)
                ->update(['active_theme_id' => null, 'active_theme_img' => null, 'updated_at' => now()]);
        }
        return ['ok' => true];
    }

    // ────────────────────── helpers ──────────────────────
    private function ensureTables(): void
    {
        if (!Schema::hasTable('party_themes')) {
            try {
                Schema::create('party_themes', function ($table) {
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
            } catch (\Throwable $e) {}
        }

        if (!Schema::hasTable('user_party_themes')) {
            try {
                Schema::create('user_party_themes', function ($table) {
                    $table->id();
                    $table->unsignedBigInteger('user_id');
                    $table->unsignedBigInteger('theme_id');
                    $table->timestamp('expires_at')->nullable();
                    $table->boolean('is_equipped')->default(false);
                    $table->timestamps();
                });
            } catch (\Throwable $e) {}
        }

        if (Schema::hasTable('party_rooms')) {
            if (!Schema::hasColumn('party_rooms', 'active_theme_id')) {
                try {
                    Schema::table('party_rooms', function ($table) {
                        $table->unsignedBigInteger('active_theme_id')->nullable();
                        $table->text('active_theme_img')->nullable();
                    });
                } catch (\Throwable $e) {}
            }
        }
    }

    private function shape($r): array
    {
        return [
            'id'           => (int) $r->id,
            'code'         => $r->code,
            'name'         => $r->name,
            'imageUrl'     => $r->image_url,
            'image'        => $r->image_url,
            'price'        => (int) $r->price,
            'offerPrice'   => isset($r->offer_price) ? (int) $r->offer_price : null,
            'durationDays' => (int) ($r->duration_days ?? 30),
            'active'       => (bool) ($r->active ?? true),
            'sortOrder'    => (int) ($r->sort_order ?? 0),
        ];
    }

    private function ensureAdmin(Request $req): void
    {
        $u = $req->user();
        if (!$u) abort(401);
        $isAdmin = false;
        try {
            $isAdmin = (bool) ($u->is_admin ?? 0)
                || in_array(strtolower((string) ($u->role ?? '')), ['admin', 'superadmin'], true);
        } catch (Throwable $e) { $isAdmin = false; }
        if (!$isAdmin) abort(403, 'Admin only');
    }
}
