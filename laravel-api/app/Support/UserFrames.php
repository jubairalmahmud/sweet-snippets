<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Central helper for resolving a user's currently equipped avatar frame.
 *
 * Reads from the `user_frames` table (is_equipped = 1, not expired) and joins
 * `frame_catalog` to get the frame image / metadata. Since the equipped flag
 * lives in the DB, logging in from ANY device automatically shows the same
 * frame everywhere — no client-side storage involved.
 *
 * Usage:
 *   $frame = UserFrames::forUser($userId);                    // single user
 *   $map   = UserFrames::forUsers([1,2,3]);                   // batch (id => frame)
 *   $shape = array_merge($base, UserFrames::shape($userId));  // append to a user shape
 */
class UserFrames
{
    /** In-request memo so repeated calls on the same user hit DB once. */
    private static array $cache = [];

    /**
     * Return equipped-frame info for one user, or null if none.
     *
     * Shape:
     *   [
     *     'id'       => int,      // user_frames row id
     *     'frameId'  => int,      // frame_catalog.id
     *     'code'     => string,   // frame_catalog.code (e.g. "king")
     *     'name'     => string,
     *     'imageUrl' => string,   // resolved absolute URL
     *     'rarity'   => string,
     *     'expiresAt'=> string|null,
     *   ]
     */
    public static function forUser($userId): ?array
    {
        if (!$userId) return null;
        $key = (int) $userId;
        if (array_key_exists($key, self::$cache)) return self::$cache[$key];

        if (!Schema::hasTable('user_frames') || !Schema::hasTable('frame_catalog')) {
            return self::$cache[$key] = null;
        }

        $row = DB::table('user_frames as uf')
            ->join('frame_catalog as fc', 'fc.id', '=', 'uf.frame_id')
            ->where('uf.user_id', $key)
            ->where('uf.is_equipped', true)
            ->where(function ($q) {
                $q->whereNull('uf.expires_at')->orWhere('uf.expires_at', '>', now());
            })
            ->where('fc.is_active', true)
            ->orderByDesc('uf.updated_at')
            ->orderByDesc('uf.id')
            ->select([
                'uf.id as uf_id',
                'uf.expires_at',
                'fc.id as frame_id',
                'fc.code',
                'fc.name',
                'fc.image_url',
                'fc.rarity',
            ])
            ->first();

        if (!$row) {
            // Fallback: check users table directly if avatar_frame is set on user record
            if (Schema::hasTable('users') && Schema::hasColumn('users', 'avatar_frame')) {
                $columns = ['avatar_frame'];
                if (Schema::hasColumn('users', 'avatar_frame_id')) $columns[] = 'avatar_frame_id';
                $userCol = DB::table('users')->where('id', $key)->select($columns)->first();
                $val = $userCol->avatar_frame ?? ($userCol->avatar_frame_id ?? null);
                if ($val && (string)$val !== '' && $val !== 'None' && $val !== 'Default') {
                    return self::$cache[$key] = [
                        'id'          => 0,
                        'frameId'     => (string) $val,
                        'code'        => (string) $val,
                        'name'        => (string) $val,
                        'imageUrl'    => null,
                        'rarity'      => 'common',
                        'expiresAt'   => null,
                        'activeFrame' => (string) $val,
                    ];
                }
            }
            return self::$cache[$key] = null;
        }

        return self::$cache[$key] = [
            'id'          => (int) $row->uf_id,
            'frameId'     => (int) $row->frame_id,
            'code'        => $row->code,
            'name'        => $row->name,
            'imageUrl'    => self::absolutize($row->image_url),
            'rarity'      => $row->rarity,
            'expiresAt'   => $row->expires_at,
            'activeFrame' => $row->code ?: $row->name,
        ];
    }

    /**
     * Batch fetch — returns [userId => frame|null] for every id passed in.
     * Use this in list endpoints (party seats, followers, feeds) to avoid N+1.
     */
    public static function forUsers(array $userIds): array
    {
        $ids = array_values(array_unique(array_map('intval', array_filter($userIds))));
        $out = array_fill_keys($ids, null);
        if (empty($ids)) return $out;
        if (!Schema::hasTable('user_frames') || !Schema::hasTable('frame_catalog')) return $out;

        $rows = DB::table('user_frames as uf')
            ->join('frame_catalog as fc', 'fc.id', '=', 'uf.frame_id')
            ->whereIn('uf.user_id', $ids)
            ->where('uf.is_equipped', true)
            ->where(function ($q) {
                $q->whereNull('uf.expires_at')->orWhere('uf.expires_at', '>', now());
            })
            ->where('fc.is_active', true)
            ->orderByDesc('uf.updated_at')
            ->orderByDesc('uf.id')
            ->select([
                'uf.id as uf_id',
                'uf.user_id',
                'uf.expires_at',
                'fc.id as frame_id',
                'fc.code',
                'fc.name',
                'fc.image_url',
                'fc.rarity',
            ])
            ->get();

        foreach ($rows as $r) {
            $uid = (int) $r->user_id;
            if (!empty($out[$uid])) continue; // keep first (most recent)
            $shape = [
                'id'        => (int) $r->uf_id,
                'frameId'   => (int) $r->frame_id,
                'code'      => $r->code,
                'name'      => $r->name,
                'imageUrl'  => self::absolutize($r->image_url),
                'rarity'    => $r->rarity,
                'expiresAt' => $r->expires_at,
            ];
            $out[$uid] = $shape;
            self::$cache[$uid] = $shape;
        }
        // Fallback for users missing from user_frames table
        $missingIds = array_filter($ids, fn($uid) => empty($out[$uid]));
        if (!empty($missingIds) && Schema::hasTable('users') && Schema::hasColumn('users', 'avatar_frame')) {
            $columns = ['id', 'avatar_frame'];
            if (Schema::hasColumn('users', 'avatar_frame_id')) $columns[] = 'avatar_frame_id';
            $userCols = DB::table('users')->whereIn('id', $missingIds)->select($columns)->get();
            foreach ($userCols as $uc) {
                $uid = (int) $uc->id;
                $val = $uc->avatar_frame ?? ($uc->avatar_frame_id ?? null);
                if ($val && (string)$val !== '' && $val !== 'None' && $val !== 'Default') {
                    $shape = [
                        'id'        => 0,
                        'frameId'   => (string) $val,
                        'code'      => (string) $val,
                        'name'      => (string) $val,
                        'imageUrl'  => null,
                        'rarity'    => 'common',
                        'expiresAt' => null,
                    ];
                    $out[$uid] = $shape;
                    self::$cache[$uid] = $shape;
                }
            }
        }

        // Cache negatives too.
        foreach ($ids as $uid) {
            if (!array_key_exists($uid, self::$cache)) self::$cache[$uid] = null;
        }
        return $out;
    }

    /**
     * Convenience: return the pair of fields to merge into a user JSON shape.
     * Frontend App.tsx reads `activeFrame` (frame code/id) and `activeFrameImg`
     * (direct URL) — resolveUserFrameImg() prefers activeFrameImg when present.
     */
    public static function shape($userId): array
    {
        $f = self::forUser($userId);
        return [
            'activeFrame'    => $f['code'] ?? ($f['frameId'] ?? null),
            'activeFrameImg' => $f['imageUrl'] ?? null,
        ];
    }

    /** Same as shape() but takes a pre-fetched frame (from forUsers batch). */
    public static function shapeFrom(?array $frame): array
    {
        return [
            'activeFrame'    => $frame['code'] ?? ($frame['frameId'] ?? null),
            'activeFrameImg' => $frame['imageUrl'] ?? null,
        ];
    }

    /** Turn a stored image path into a URL the frontend can load directly. */
    private static function absolutize(?string $url): ?string
    {
        if (!$url) return null;
        if (preg_match('#^(https?:)?//#i', $url)) return $url;
        if (str_starts_with($url, 'data:')) return $url;
        if (str_starts_with($url, '/')) {
            return rtrim(config('app.url', ''), '/') . $url;
        }
        // Bare filename — assume it lives under /storage or /assets/frames.
        return rtrim(config('app.url', ''), '/') . '/storage/' . ltrim($url, '/');
    }
}
