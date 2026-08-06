<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class FrameCatalogController extends Controller
{
    // GET /api/frame-catalog  (public — list active frames)
    public function index()
    {
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
        $userId = $r->user()->id;
        $frameId = $id ?: $r->input('frame_id');
        $code = $r->input('code');

        $catalog = null;
        if ($frameId && is_numeric($frameId)) {
            $catalog = DB::table('frame_catalog')->where('id', (int)$frameId)->first();
        }
        if (!$catalog && $code) {
            $catalog = DB::table('frame_catalog')->where('code', $code)->orWhere('name', $code)->first();
        }

        if ($catalog) {
            $fid = $catalog->id;
            DB::transaction(function () use ($userId, $fid, $catalog) {
                if (Schema::hasTable('user_frames')) {
                    DB::table('user_frames')->where('user_id', $userId)->update(['is_equipped' => 0, 'updated_at' => now()]);
                    DB::table('user_frames')->where('user_id', $userId)->where('frame_id', $fid)->update(['is_equipped' => 1, 'updated_at' => now()]);
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

    // POST /api/frame-catalog/{id}/buy   (auth — deduct coins, grant frame, auto-equip)
    public function buy(Request $r, int $id)
    {
        $user = $r->user();
        $frame = DB::table('frame_catalog')->where('id', $id)->where('is_active', 1)->first();
        if (!$frame) return response()->json(['message' => 'Not found'], 404);

        return DB::transaction(function () use ($user, $frame) {
            $user = \App\Models\User::lockForUpdate()->find($user->id);

            // Prefer r_coins if the wallets table exists; otherwise fall back to users.diamonds.
            $useWalletTable = Schema::hasTable('wallets');
            if ($useWalletTable) {
                $wallet = DB::table('wallets')->where('user_id', $user->id)->lockForUpdate()->first();
                if (!$wallet || $wallet->r_coins < $frame->price_coins) {
                    return response()->json(['message' => 'Insufficient coins'], 422);
                }
                DB::table('wallets')->where('user_id', $user->id)
                    ->update(['r_coins' => $wallet->r_coins - $frame->price_coins, 'updated_at' => now()]);
            } else {
                if ((int) $user->diamonds < (int) $frame->price_coins) {
                    return response()->json(['message' => 'Insufficient diamonds'], 422);
                }
                $user->diamonds = (int) $user->diamonds - (int) $frame->price_coins;
            }

            $expires = $frame->duration_days > 0 ? Carbon::now()->addDays($frame->duration_days) : null;

            // Un-equip every other frame and equip this one (works across devices).
            DB::table('user_frames')
                ->where('user_id', $user->id)
                ->update(['is_equipped' => 0, 'updated_at' => now()]);

            $existing = DB::table('user_frames')
                ->where('user_id', $user->id)
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
                    'user_id'     => $user->id,
                    'frame_id'    => $frame->id,
                    'is_equipped' => 1,
                    'acquired_at' => now(),
                    'expires_at'  => $expires,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            // Keep legacy columns in sync so old clients still see the frame.
            if (Schema::hasColumn('users', 'avatar_frame')) {
                $user->avatar_frame = $frame->code ?: $frame->name;
            }
            if (Schema::hasColumn('users', 'avatar_frame_id')) {
                $user->avatar_frame_id = $frame->id;
            }
            $user->save();

            return response()->json([
                'ok'             => true,
                'expires_at'     => $expires,
                'activeFrame'    => $frame->code ?: $frame->name,
                'activeFrameImg' => $this->absoluteUrl($frame->image_url),
                'diamonds'       => (int) $user->diamonds,
            ]);
        });
    }

    // ===== Admin =====
    // POST /api/admin/frame-catalog
    public function store(Request $r)
    {
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

    // PUT /api/admin/frame-catalog/{id}
    public function update(Request $r, int $id)
    {
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

    // DELETE /api/admin/frame-catalog/{id}
    public function destroy(int $id)
    {
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
