<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class FrameCatalogController extends Controller
{
    private function ensureTables(): void
    {
        if (!Schema::hasTable('frame_catalog')) {
            try {
                Schema::create('frame_catalog', function ($table) {
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
            } catch (\Throwable $e) {}
        }

        if (!Schema::hasTable('user_frames')) {
            try {
                Schema::create('user_frames', function ($table) {
                    $table->id();
                    $table->unsignedBigInteger('user_id');
                    $table->unsignedBigInteger('frame_id');
                    $table->timestamp('acquired_at')->nullable();
                    $table->timestamp('expires_at')->nullable();
                    $table->boolean('is_equipped')->default(false);
                    $table->timestamps();
                });
            } catch (\Throwable $e) {}
        }

        if (Schema::hasTable('users')) {
            if (!Schema::hasColumn('users', 'avatar_frame')) {
                try {
                    Schema::table('users', function ($table) {
                        $table->string('avatar_frame', 120)->nullable();
                    });
                } catch (\Throwable $e) {}
            }
            if (!Schema::hasColumn('users', 'entry_effect')) {
                try {
                    Schema::table('users', function ($table) {
                        $table->string('entry_effect', 120)->nullable();
                    });
                } catch (\Throwable $e) {}
            }
        }
    }

    // GET /api/frame-catalog  (public — list active frames)
    public function index()
    {
        $this->ensureTables();
        $rows = DB::table('frame_catalog')
            ->where('is_active', 1)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        return response()->json(['data' => $rows]);
    }

    // GET /api/me/frames  (auth — my owned frames + equipped)
    public function myFrames(Request $r)
    {
        $this->ensureTables();
        $userId = $r->user()->id;
        $rows = DB::table('user_frames as uf')
            ->join('frame_catalog as fc', 'fc.id', '=', 'uf.frame_id')
            ->where('uf.user_id', $userId)
            ->where(function ($q) {
                $q->whereNull('uf.expires_at')->orWhere('uf.expires_at', '>', now());
            })
            ->select('uf.id', 'uf.frame_id', 'uf.is_equipped', 'uf.expires_at',
                     'fc.code', 'fc.name', 'fc.image_url', 'fc.rarity')
            ->orderByDesc('uf.is_equipped')
            ->get();
        return response()->json(['data' => $rows]);
    }

    // POST /api/me/frames/{id}/equip or /api/me/frames/equip
    public function equip(Request $r, $id = null)
    {
        $this->ensureTables();
        $userId = $r->user()->id;
        $frameId = $id ?: $r->input('frame_id');
        $code = $r->input('code');

        $catalog = null;
        if ($frameId && is_numeric($frameId)) {
            $catalog = DB::table('frame_catalog')->where('id', (int)$frameId)->first();
        }
        if (!$catalog && $code) {
            $catalog = DB::table('frame_catalog')->where('code', (string)$code)->orWhere('name', (string)$code)->first();
        }
        if (!$catalog && $code) {
            $catId = DB::table('frame_catalog')->insertGetId([
                'code' => (string)$code,
                'name' => (string)$code,
                'image_url' => '',
                'price_coins' => 0,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $catalog = DB::table('frame_catalog')->where('id', $catId)->first();
        }

        if ($catalog) {
            $fid = $catalog->id;
            DB::transaction(function () use ($userId, $fid, $catalog) {
                if (Schema::hasTable('user_frames')) {
                    DB::table('user_frames')->where('user_id', $userId)->update(['is_equipped' => 0, 'updated_at' => now()]);
                    $existing = DB::table('user_frames')->where('user_id', $userId)->where('frame_id', $fid)->first();
                    if ($existing) {
                        DB::table('user_frames')->where('id', $existing->id)->update(['is_equipped' => 1, 'updated_at' => now()]);
                    } else {
                        DB::table('user_frames')->insert([
                            'user_id' => $userId,
                            'frame_id' => $fid,
                            'is_equipped' => 1,
                            'acquired_at' => now(),
                            'expires_at' => Carbon::now()->addDays(30),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
                if (Schema::hasColumn('users', 'avatar_frame')) {
                    DB::table('users')->where('id', $userId)->update(['avatar_frame' => $catalog->code ?: $catalog->name]);
                }
                if (Schema::hasColumn('users', 'avatar_frame_id')) {
                    DB::table('users')->where('id', $userId)->update(['avatar_frame_id' => $fid]);
                }
            });
            return response()->json(['ok' => true, 'activeFrame' => $catalog->code ?: $catalog->name]);
        }

        if ($code) {
            if (Schema::hasColumn('users', 'avatar_frame')) {
                DB::table('users')->where('id', $userId)->update(['avatar_frame' => $code]);
            }
            return response()->json(['ok' => true, 'activeFrame' => $code]);
        }

        return response()->json(['message' => 'Frame not found'], 404);
    }

    // POST /api/me/frames/unequip
    public function unequip(Request $r)
    {
        $this->ensureTables();
        $userId = $r->user()->id;
        DB::transaction(function () use ($userId) {
            if (Schema::hasTable('user_frames')) {
                DB::table('user_frames')->where('user_id', $userId)->update(['is_equipped' => 0, 'updated_at' => now()]);
            }
            if (Schema::hasColumn('users', 'avatar_frame')) {
                DB::table('users')->where('id', $userId)->update(['avatar_frame' => 'Default']);
            }
            if (Schema::hasColumn('users', 'avatar_frame_id')) {
                DB::table('users')->where('id', $userId)->update(['avatar_frame_id' => null]);
            }
        });
        return response()->json(['ok' => true]);
    }

    // POST /api/frame-catalog/{id}/buy or /api/me/frames/purchase
    public function buy(Request $r, $id = null)
    {
        $this->ensureTables();
        $user = $r->user();
        $codeParam = $r->input('code') ?: $id;
        $frameId = $r->input('frame_id') ?: $id;

        $frame = null;
        if ($frameId && is_numeric($frameId)) {
            $frame = DB::table('frame_catalog')->where('id', (int)$frameId)->first();
        }
        if (!$frame && $codeParam) {
            $frame = DB::table('frame_catalog')->where('code', (string)$codeParam)->orWhere('name', (string)$codeParam)->first();
        }
        if (!$frame && $codeParam) {
            $catId = DB::table('frame_catalog')->insertGetId([
                'code' => (string)$codeParam,
                'name' => (string)$codeParam,
                'image_url' => '',
                'price_coins' => (int)$r->input('price', 10000),
                'duration_days' => (int)$r->input('days', 30),
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $frame = DB::table('frame_catalog')->where('id', $catId)->first();
        }

        if (!$frame) {
            return response()->json(['message' => 'Frame not found'], 404);
        }

        return DB::transaction(function () use ($user, $frame, $r) {
            $u = \App\Models\User::lockForUpdate()->find($user->id);

            $price = (int) ($frame->price_coins ?? $r->input('price', 10000));
            $days = (int) ($frame->duration_days ?? 30);

            $useWalletTable = Schema::hasTable('wallets');
            if ($useWalletTable) {
                $wallet = DB::table('wallets')->where('user_id', $u->id)->lockForUpdate()->first();
                if ($wallet && $wallet->r_coins >= $price) {
                    DB::table('wallets')->where('user_id', $u->id)
                        ->update(['r_coins' => $wallet->r_coins - $price, 'updated_at' => now()]);
                } else if (isset($u->diamonds) && $u->diamonds >= $price) {
                    $u->diamonds = $u->diamonds - $price;
                }
            } else {
                if (isset($u->diamonds) && $u->diamonds >= $price) {
                    $u->diamonds = $u->diamonds - $price;
                }
            }

            $expires = $days > 0 ? Carbon::now()->addDays($days) : null;

            DB::table('user_frames')
                ->where('user_id', $u->id)
                ->update(['is_equipped' => 0, 'updated_at' => now()]);

            $existing = DB::table('user_frames')
                ->where('user_id', $u->id)
                ->where('frame_id', $frame->id)
                ->first();

            if ($existing) {
                DB::table('user_frames')->where('id', $existing->id)->update([
                    'is_equipped' => 1,
                    'expires_at'  => $expires,
                    'acquired_at' => now(),
                    'updated_at'  => now(),
                ]);
            } else {
                DB::table('user_frames')->insert([
                    'user_id'     => $u->id,
                    'frame_id'    => $frame->id,
                    'is_equipped' => 1,
                    'acquired_at' => now(),
                    'expires_at'  => $expires,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            if (Schema::hasColumn('users', 'avatar_frame')) {
                $u->avatar_frame = $frame->code ?: $frame->name;
            }
            if (Schema::hasColumn('users', 'avatar_frame_id')) {
                $u->avatar_frame_id = $frame->id;
            }
            $u->save();

            return response()->json([
                'ok'             => true,
                'expires_at'     => $expires,
                'activeFrame'    => $frame->code ?: $frame->name,
                'activeFrameImg' => $this->absoluteUrl($frame->image_url),
                'diamonds'       => (int) ($u->diamonds ?? 0),
            ]);
        });
    }

    // ===== Admin =====
    public function adminIndex(Request $r)
    {
        $this->ensureTables();
        $rows = DB::table('frame_catalog')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        return response()->json(['data' => $rows]);
    }

    public function seed(Request $r)
    {
        $this->ensureTables();
        $defaults = [
            ['code' => 'avatar-egol',             'name' => 'Egol',         'image_url' => '/assets/frames/egol.png',             'price_coins' => 500000, 'rarity' => 'epic',      'duration_days' => 30,   'sort_order' => 1],
            ['code' => 'avatar-fair',             'name' => 'Fair',         'image_url' => '/assets/frames/fair.png',             'price_coins' => 500000, 'rarity' => 'epic',      'duration_days' => 30,   'sort_order' => 2],
            ['code' => 'avatar-king',             'name' => 'KING',         'image_url' => '/assets/frames/king.png',             'price_coins' => 500000, 'rarity' => 'legendary', 'duration_days' => 30,   'sort_order' => 3],
            ['code' => 'avatar-queen',            'name' => 'QUEEN',        'image_url' => '/assets/frames/queen.png',            'price_coins' => 500000, 'rarity' => 'legendary', 'duration_days' => 30,   'sort_order' => 4],
            ['code' => 'avatar-host-premium',     'name' => 'HOST VIP',     'image_url' => '/assets/frames/host-vip.png',         'price_coins' => 0,      'rarity' => 'rare',      'duration_days' => 3650, 'sort_order' => 5],
            ['code' => 'avatar-reseller-premium', 'name' => 'RESELLER VIP', 'image_url' => '/assets/frames/reseller-vip.png',     'price_coins' => 0,      'rarity' => 'rare',      'duration_days' => 3650, 'sort_order' => 6],
            ['code' => 'avatar-agency-premium',   'name' => 'AGENCY VIP',   'image_url' => '/assets/frames/agency-vip.png',       'price_coins' => 0,      'rarity' => 'rare',      'duration_days' => 3650, 'sort_order' => 7],
        ];

        $inserted = 0;
        foreach ($defaults as $f) {
            $exists = DB::table('frame_catalog')->where('code', $f['code'])->exists();
            if (!$exists) {
                DB::table('frame_catalog')->insert(array_merge($f, [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]));
                $inserted++;
            }
        }

        $rows = DB::table('frame_catalog')->orderBy('sort_order')->orderBy('id')->get();
        return response()->json(['ok' => true, 'inserted' => $inserted, 'data' => $rows]);
    }

    public function store(Request $r)
    {
        $this->ensureTables();
        $code = $r->input('code') ?: ('frame_' . time());
        $data = [
            'code' => $code,
            'name' => $r->input('name', 'New Frame'),
            'image_url' => $r->input('image_url') ?: $r->input('image', ''),
            'price_coins' => (int)($r->input('price_coins') ?? $r->input('price', 0)),
            'vip_level_required' => (int)$r->input('vip_level_required', 0),
            'rarity' => $r->input('rarity', 'common'),
            'duration_days' => (int)($r->input('duration_days') ?? $r->input('durationDays', 30)),
            'is_active' => $r->has('is_active') ? (bool)$r->input('is_active') : true,
            'sort_order' => (int)$r->input('sort_order', 0),
            'created_at' => now(),
            'updated_at' => now(),
        ];
        $id = DB::table('frame_catalog')->insertGetId($data);
        return response()->json(['id' => $id, 'ok' => true], 201);
    }

    public function update(Request $r, $id)
    {
        $this->ensureTables();
        $data = [];
        if ($r->has('code')) $data['code'] = $r->input('code');
        if ($r->has('name')) $data['name'] = $r->input('name');
        if ($r->has('image_url') || $r->has('image')) $data['image_url'] = $r->input('image_url') ?: $r->input('image');
        if ($r->has('price_coins') || $r->has('price')) $data['price_coins'] = (int)($r->input('price_coins') ?? $r->input('price'));
        if ($r->has('duration_days') || $r->has('durationDays')) $data['duration_days'] = (int)($r->input('duration_days') ?? $r->input('durationDays'));
        if ($r->has('rarity')) $data['rarity'] = $r->input('rarity');
        if ($r->has('is_active')) $data['is_active'] = (bool)$r->input('is_active');
        if ($r->has('sort_order')) $data['sort_order'] = (int)$r->input('sort_order');

        DB::table('frame_catalog')->where('id', $id)->update($data + ['updated_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function destroy($id)
    {
        $this->ensureTables();
        DB::table('frame_catalog')->where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }

    private function absoluteUrl(?string $url): ?string
    {
        if (!$url) return null;
        if (preg_match('#^https?://#i', $url)) return $url;
        return url(ltrim($url, '/'));
    }
}
