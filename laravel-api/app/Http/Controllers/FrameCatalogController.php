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
    public function store(Request $r)
    {
        $this->ensureTables();
        $data = $r->validate([
            'code' => 'required|string|max:64|unique:frame_catalog,code',
            'name' => 'required|string|max:120',
            'image_url' => 'required|string|max:500',
            'price_coins' => 'integer|min:0',
            'vip_level_required' => 'integer|min:0',
            'rarity' => 'in:common,rare,epic,legendary',
            'duration_days' => 'integer|min:0',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);
        $id = DB::table('frame_catalog')->insertGetId($data + ['created_at' => now(), 'updated_at' => now()]);
        return response()->json(['id' => $id], 201);
    }

    public function update(Request $r, $id)
    {
        $this->ensureTables();
        $data = $r->validate([
            'name' => 'sometimes|string|max:120',
            'image_url' => 'sometimes|string|max:500',
            'price_coins' => 'sometimes|integer|min:0',
            'vip_level_required' => 'sometimes|integer|min:0',
            'rarity' => 'sometimes|in:common,rare,epic,legendary',
            'duration_days' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);
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
