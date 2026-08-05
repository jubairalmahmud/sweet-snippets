<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FcmService;
use App\Support\UserFrames;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FollowController extends Controller
{
    private function userShape(object $u, ?array $frame = null): array
    {
        // If $frame isn't pre-fetched (single-user paths), look it up now.
        $frameFields = $frame !== null
            ? UserFrames::shapeFrom($frame)
            : UserFrames::shape($u->id);

        return array_merge([
            'id'     => (int) $u->id,
            'name'   => $u->name,
            'avatar' => $u->avatar ?? $u->avatar_url ?? null,
            'bio'    => $u->bio ?? null,
        ], $frameFields);
    }

    /** Batch-map a rowset of users into shapes with their equipped frames. */
    private function mapWithFrames($rows): array
    {
        $ids    = collect($rows)->pluck('id')->all();
        $frames = UserFrames::forUsers($ids);
        return collect($rows)
            ->map(fn ($u) => $this->userShape($u, $frames[(int) $u->id] ?? null))
            ->values()
            ->all();
    }

    public function follow(Request $request, int $userId)
    {
        $uid = $request->user()->id;
        if ($uid === $userId) abort(422, 'Cannot follow self');
        $target = DB::table('users')->where('id', $userId)->first();
        if (!$target) abort(404, 'User not found');

        DB::table('follows')->updateOrInsert(
            ['follower_id' => $uid, 'following_id' => $userId],
            ['created_at' => now(), 'updated_at' => now()]
        );

        // notify target
        DB::table('notifications')->insert([
            'user_id'    => $userId,
            'type'       => 'follow',
            'title'      => 'New follower',
            'body'       => ($request->user()->name ?? 'Someone') . ' followed you',
            'data'       => json_encode(['userId' => $uid]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            FcmService::sendToUser($userId, 'New follower',
                ($request->user()->name ?? 'Someone') . ' followed you',
                ['type' => 'follow', 'userId' => $uid]);
        } catch (\Throwable $e) {}

        return ['ok' => true, 'following' => true];
    }

    public function unfollow(Request $request, int $userId)
    {
        $uid = $request->user()->id;
        DB::table('follows')->where('follower_id', $uid)->where('following_id', $userId)->delete();
        return ['ok' => true, 'following' => false];
    }

    public function followers(Request $request, int $userId)
    {
        $rows = DB::table('follows as f')
            ->join('users as u', 'u.id', '=', 'f.follower_id')
            ->where('f.following_id', $userId)
            ->orderByDesc('f.id')->limit(500)
            ->get(['u.id','u.name','u.avatar','u.bio']);
        return ['data' => $this->mapWithFrames($rows)];
    }

    public function following(Request $request, int $userId)
    {
        $rows = DB::table('follows as f')
            ->join('users as u', 'u.id', '=', 'f.following_id')
            ->where('f.follower_id', $userId)
            ->orderByDesc('f.id')->limit(500)
            ->get(['u.id','u.name','u.avatar','u.bio']);
        return ['data' => $this->mapWithFrames($rows)];
    }

    public function stats(Request $request, int $userId)
    {
        $followers = DB::table('follows')->where('following_id', $userId)->count();
        $following = DB::table('follows')->where('follower_id', $userId)->count();
        $isFollowing = false;
        if ($request->user()) {
            $isFollowing = DB::table('follows')
                ->where('follower_id', $request->user()->id)
                ->where('following_id', $userId)->exists();
        }
        return [
            'followers'   => (int) $followers,
            'following'   => (int) $following,
            'isFollowing' => $isFollowing,
        ];
    }
}
