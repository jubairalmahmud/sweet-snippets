<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class MatchRequestController extends Controller
{
    public function users(Request $request)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $query = DB::table('users')
            ->where('id', '!=', $user->id)
            ->where('is_banned', false)
            ->limit(50);

        if (Schema::hasColumn('users', 'last_seen_at')) {
            $query->where('last_seen_at', '>=', now()->subMinutes(2))
                ->orderByDesc('last_seen_at');
        } else {
            $query->whereRaw('1 = 0');
        }

        $rows = $query
            ->orderByDesc('id')
            ->get(['id', 'name', 'email', 'avatar', 'bio', 'vip_level']);

        return ['data' => $rows->map(fn ($row) => [
            'id' => (int) $row->id,
            'name' => $row->name,
            'email' => $row->email,
            'avatar' => $row->avatar ?? null,
            'bio' => $row->bio ?? null,
            'vipLevel' => (int) ($row->vip_level ?? 1),
            'status' => 'Online',
        ])->values()];
    }

    private function shape(object $row): array
    {
        $requester = DB::table('users')->where('id', $row->requester_id)->first();
        $target = DB::table('users')->where('id', $row->target_user_id)->first();

        return [
            'id' => (int) $row->id,
            'requesterId' => (int) $row->requester_id,
            'requesterName' => $requester->name ?? null,
            'requesterAvatar' => $requester->avatar ?? null,
            'targetUserId' => (int) $row->target_user_id,
            'targetName' => $target->name ?? null,
            'targetAvatar' => $target->avatar ?? null,
            'ratePerMinute' => (int) $row->rate_per_minute,
            'status' => $row->status,
            'respondedAt' => $row->responded_at,
            'expiresAt' => $row->expires_at,
            'createdAt' => $row->created_at,
            'updatedAt' => $row->updated_at,
        ];
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) abort(401);

        DB::table('match_requests')
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->update(['status' => 'expired', 'updated_at' => now()]);

        $rows = DB::table('match_requests')
            ->where(function ($q) use ($user) {
                $q->where('requester_id', $user->id)->orWhere('target_user_id', $user->id);
            })
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return ['data' => $rows->map(fn ($row) => $this->shape($row))->values()];
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $data = $request->validate([
            'target_user_id' => 'required|integer|min:1',
            'rate_per_minute' => 'required|integer|min:1|max:100000',
        ]);
        if ((int) $data['target_user_id'] === (int) $user->id) abort(422, 'Cannot match yourself.');

        $target = DB::table('users')->where('id', $data['target_user_id'])->first();
        if (!$target) abort(404, 'Target user not found.');
        if ((bool) ($target->is_banned ?? false)) abort(422, 'Target user is not available.');

        DB::table('match_requests')
            ->where('requester_id', $user->id)
            ->where('target_user_id', $target->id)
            ->where('status', 'pending')
            ->update(['status' => 'cancelled', 'updated_at' => now()]);

        $id = DB::table('match_requests')->insertGetId([
            'requester_id' => $user->id,
            'target_user_id' => $target->id,
            'rate_per_minute' => (int) $data['rate_per_minute'],
            'status' => 'pending',
            'expires_at' => now()->addMinutes(2),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('match_requests')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    public function respond(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $data = $request->validate([
            'action' => 'required|in:accept,reject,cancel',
        ]);

        $row = DB::table('match_requests')->where('id', $id)->first();
        if (!$row) abort(404, 'Match request not found.');

        $isTarget = (int) $row->target_user_id === (int) $user->id;
        $isRequester = (int) $row->requester_id === (int) $user->id;
        if (!$isTarget && !$isRequester) abort(403);
        if ($data['action'] === 'cancel' && !$isRequester) abort(403, 'Only requester can cancel.');
        if (in_array($data['action'], ['accept', 'reject'], true) && !$isTarget) {
            abort(403, 'Only target user can respond.');
        }
        if ($row->status !== 'pending') abort(422, 'Match request is no longer pending.');
        if ($row->expires_at && now()->greaterThan($row->expires_at)) {
            DB::table('match_requests')->where('id', $id)->update([
                'status' => 'expired',
                'updated_at' => now(),
            ]);
            abort(422, 'Match request expired.');
        }

        $status = match ($data['action']) {
            'accept' => 'accepted',
            'reject' => 'rejected',
            default => 'cancelled',
        };

        DB::table('match_requests')->where('id', $id)->update([
            'status' => $status,
            'responded_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('match_requests')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }
}
