<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;

class PostController extends Controller
{
    private function shape(object $post): array
    {
        $createdAt = $post->created_at ? Carbon::parse($post->created_at) : null;
        return [
            'id' => (int) $post->id,
            'userId' => (int) $post->user_id,
            'userName' => $post->user_name,
            'userAvatar' => $post->user_avatar,
            'timestamp' => $createdAt ? $createdAt->diffForHumans() : '',
            'text' => $post->body ?? '',
            'image' => $post->media,
            'mediaType' => $post->media_type,
            'likes' => (int) $post->likes_count,
            'hasLiked' => (bool) ($post->has_liked ?? false),
            'comments' => $post->comments ? json_decode($post->comments, true) ?: [] : [],
            'createdAt' => $createdAt ? $createdAt->toIso8601String() : null,
        ];
    }

    public function index(Request $request)
    {
        $userId = $request->query('user_id');
        $viewerId = $request->user()?->id;
        $query = DB::table('posts as p')
            ->join('users as u', 'u.id', '=', 'p.user_id')
            ->select([
                'p.*',
                'u.name as user_name',
                DB::raw('COALESCE(u.avatar, "") as user_avatar'),
            ])
            ->orderByDesc('p.id')
            ->limit(100);

        if ($userId) {
            $query->where('p.user_id', (int) $userId);
        }

        $rows = $query->get();
        $likedIds = [];
        if ($viewerId && Schema::hasTable('post_likes') && $rows->isNotEmpty()) {
            $likedIds = DB::table('post_likes')
                ->where('user_id', $viewerId)
                ->whereIn('post_id', $rows->pluck('id')->all())
                ->pluck('post_id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }

        return ['data' => $rows->map(function ($post) use ($likedIds) {
            $post->has_liked = in_array((int) $post->id, $likedIds, true);
            return $this->shape($post);
        })->values()];
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $data = $request->validate([
            'body' => 'nullable|string|max:5000',
            'media' => 'nullable|string',
            'media_type' => 'nullable|string|max:24',
        ]);

        if (!trim($data['body'] ?? '') && empty($data['media'])) {
            abort(422, 'Post text or media is required.');
        }

        if (!empty($data['media']) && strlen($data['media']) > 8 * 1024 * 1024) {
            abort(422, 'Post media is too large. Use an image or short video under 6MB.');
        }

        $id = DB::table('posts')->insertGetId([
            'user_id' => $user->id,
            'body' => $data['body'] ?? null,
            'media' => $data['media'] ?? null,
            'media_type' => $data['media_type'] ?? null,
            'likes_count' => 0,
            'comments' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $post = DB::table('posts as p')
            ->join('users as u', 'u.id', '=', 'p.user_id')
            ->select(['p.*', 'u.name as user_name', DB::raw('COALESCE(u.avatar, "") as user_avatar')])
            ->where('p.id', $id)
            ->first();

        return ['data' => $this->shape($post)];
    }

    public function toggleLike(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $post = DB::table('posts')->where('id', $id)->first();
        if (!$post) abort(404, 'Post not found.');

        $hasLiked = false;
        if (Schema::hasTable('post_likes')) {
            $existing = DB::table('post_likes')
                ->where('post_id', $id)
                ->where('user_id', $user->id)
                ->first();

            if ($existing) {
                DB::table('post_likes')
                    ->where('post_id', $id)
                    ->where('user_id', $user->id)
                    ->delete();
                DB::table('posts')->where('id', $id)->where('likes_count', '>', 0)->decrement('likes_count');
            } else {
                DB::table('post_likes')->insert([
                    'post_id' => $id,
                    'user_id' => $user->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                DB::table('posts')->where('id', $id)->increment('likes_count');
                $hasLiked = true;
            }
        } else {
            DB::table('posts')->where('id', $id)->increment('likes_count');
            $hasLiked = true;
        }

        $likes = (int) DB::table('posts')->where('id', $id)->value('likes_count');
        return ['data' => ['id' => $id, 'likes' => $likes, 'hasLiked' => $hasLiked]];
    }

    public function comment(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $data = $request->validate([
            'text' => 'required|string|max:1000',
        ]);

        $post = DB::table('posts')->where('id', $id)->first();
        if (!$post) abort(404, 'Post not found.');

        $comments = $post->comments ? json_decode($post->comments, true) ?: [] : [];
        $comments[] = [
            'id' => (int) round(microtime(true) * 1000),
            'sender' => $user->name ?: 'SK Love User',
            'senderAvatar' => $user->avatar ?? '',
            'text' => trim($data['text']),
            'timestamp' => 'Just now',
            'createdAt' => now()->toIso8601String(),
        ];

        DB::table('posts')->where('id', $id)->update([
            'comments' => json_encode($comments),
            'updated_at' => now(),
        ]);

        return ['data' => ['id' => $id, 'comments' => $comments]];
    }


    public function update(Request $r, $id) {
    $post = Post::findOrFail($id);
    abort_if($post->user_id !== $r->user()->id, 403);
    $post->update(['body' => $r->input('body', '')]);
    return response()->json(['data' => $post]);
}

public function destroy(Request $r, $id) {
    $post = Post::findOrFail($id);
    abort_if($post->user_id !== $r->user()->id, 403);
    $post->delete();
    return response()->json(['ok' => true]);
}


}
