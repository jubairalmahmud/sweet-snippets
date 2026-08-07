<?php

namespace App\Http\Controllers\Api;

use App\Events\RoomViewerChanged;
use App\Http\Controllers\Controller;
use App\Support\HostReportHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LiveRoomController extends Controller
{
    private function shape(object $r): array
    {
        $host = DB::table('users')->where('id', $r->host_id)->first();
        return [
            'id'            => (int) $r->id,
            'hostId'        => (int) $r->host_id,
            'hostName'      => $host->name ?? null,
            'hostAvatar'    => $host->avatar ?? $host->avatar_url ?? null,
            'title'         => $r->title,
            'cover'         => $r->cover,
            'streamFilter'  => property_exists($r, 'stream_filter') ? $r->stream_filter : null,
            'category'      => $r->category,
            'country'       => $r->country,
            'live'          => (bool) $r->live,
            'viewerCount'   => (int) $r->viewer_count,
            'totalDiamonds' => (int) $r->total_diamonds,
            'likesCount'    => property_exists($r, 'likes_count') ? (int) $r->likes_count : 0,
            'startedAt'     => $r->started_at,
            'endedAt'       => $r->ended_at,
            'createdAt'     => $r->created_at,
            'updatedAt'     => $r->updated_at,
        ];
    }

    private function assertImage(?string $img): void
    {
        if (!$img) return;
        if (preg_match('#^https?://#i', $img)) return;
        if (preg_match('#^data:image/(png|jpe?g|webp|gif);base64,#i', $img)) {
            if (strlen($img) > 3 * 1024 * 1024 * 1.4) abort(422, 'Cover too large (max 3MB)');
            return;
        }
        abort(422, 'Invalid cover format');
    }

    // Public list of live rooms
    public function index(Request $request)
    {
        $staleBefore = now()->subMinutes(5);
        DB::table('live_rooms')
            ->where('live', true)
            ->where('updated_at', '<', $staleBefore)
            ->update(['live' => false, 'ended_at' => now(), 'updated_at' => now()]);

        DB::table('live_room_viewers')
            ->whereNull('left_at')
            ->where('last_seen_at', '<', $staleBefore)
            ->update(['left_at' => now()]);

        $q = DB::table('live_rooms')
            ->where('live', true)
            ->whereNull('ended_at');
        if ($c = $request->query('category')) {
            $q->where('category', $c);
        } else {
            $q->where('category', '!=', 'multi');
        }
        if ($co = $request->query('country'))  $q->where('country', $co);
        $rows = $q->orderByDesc('viewer_count')->orderByDesc('id')->limit(200)->get();
        return ['data' => $rows->map(fn ($r) => $this->shape($r))->values()];
    }

    public function show(Request $request, int $id)
    {
        $r = DB::table('live_rooms')->where('id', $id)->first();
        if (!$r) abort(404, 'Room not found');
        if ($r->live && $r->updated_at && \Illuminate\Support\Carbon::parse($r->updated_at)->lt(now()->subMinutes(5))) {
            DB::table('live_rooms')->where('id', $id)->update([
                'live' => false, 'ended_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('live_room_viewers')->where('room_id', $id)->whereNull('left_at')
                ->update(['left_at' => now()]);
            $r = DB::table('live_rooms')->where('id', $id)->first();
        }
        return ['data' => $this->shape($r)];
    }

    // Create / start a room (host)
    public function start(Request $request)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $data = $request->validate([
            'title'    => 'nullable|string|max:200',
            'cover'    => 'nullable|string',
            'streamFilter' => 'nullable|string|max:64',
            'category' => 'nullable|string|max:32',
            'country'  => 'nullable|string|max:8',
        ]);
        $this->assertImage($data['cover'] ?? null);

        // End any previously-live room by same host — and credit its live_hours.
        $prevRooms = DB::table('live_rooms')
            ->where('host_id', $user->id)
            ->where('live', true)
            ->get();
        foreach ($prevRooms as $pr) {
            try {
                $startedAt = $pr->started_at ? \Carbon\Carbon::parse($pr->started_at) : null;
                if ($startedAt) {
                    $secs = max(0, now()->diffInSeconds($startedAt));
                    HostReportHelper::addHoursFromSeconds((int) $user->id, $secs);
                }
            } catch (\Throwable $e) {
                \Log::warning('HostReportHelper start-cleanup failed: '.$e->getMessage());
            }
        }
        DB::table('live_rooms')
            ->where('host_id', $user->id)
            ->where('live', true)
            ->update(['live' => false, 'ended_at' => now(), 'updated_at' => now()]);

        $payload = [
            'host_id'        => $user->id,
            'title'          => $data['title'] ?? null,
            'cover'          => $data['cover'] ?? null,
            'category'       => $data['category'] ?? 'general',
            'country'        => $data['country'] ?? null,
            'live'           => true,
            'viewer_count'   => 0,
            'total_diamonds' => 0,
            'started_at'     => now(),
            'created_at'     => now(),
            'updated_at'     => now(),
        ];

        if (Schema::hasColumn('live_rooms', 'stream_filter')) {
            $payload['stream_filter'] = $data['streamFilter'] ?? null;
        }
        if (Schema::hasColumn('live_rooms', 'likes_count')) {
            $payload['likes_count'] = 0;
        }

        $id = DB::table('live_rooms')->insertGetId($payload);

        $row = DB::table('live_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    // End the room (host or admin)
    public function update(Request $request, int $id)
    {
        $user = $request->user();
        $row  = DB::table('live_rooms')->where('id', $id)->first();
        if (!$row) abort(404, 'Room not found');
        if ((int) $row->host_id !== (int) $user->id && !($user->is_admin ?? false)) abort(403);

        $data = $request->validate([
            'title' => 'nullable|string|max:200',
            'cover' => 'nullable|string',
            'streamFilter' => 'nullable|string|max:64',
        ]);
        $this->assertImage($data['cover'] ?? null);

        $patch = ['updated_at' => now()];
        if (array_key_exists('title', $data)) {
            $patch['title'] = $data['title'];
        }
        if (array_key_exists('cover', $data)) {
            $patch['cover'] = $data['cover'];
        }
        if (array_key_exists('streamFilter', $data) && Schema::hasColumn('live_rooms', 'stream_filter')) {
            $patch['stream_filter'] = $data['streamFilter'];
        }

        DB::table('live_rooms')->where('id', $id)->update($patch);
        $row = DB::table('live_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    // End the room (host or admin)
    public function end(Request $request, int $id)
    {
        $user = $request->user();
        $row  = DB::table('live_rooms')->where('id', $id)->first();
        if (!$row) abort(404, 'Room not found');
        if ($row->host_id !== $user->id && !($user->is_admin ?? false)) abort(403);

        DB::table('live_rooms')->where('id', $id)->update([
            'live' => false, 'ended_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('live_room_viewers')->where('room_id', $id)->whereNull('left_at')
            ->update(['left_at' => now()]);

        // Credit host_reports.live_hours with this session's duration.
        try {
            $startedAt = $row->started_at ? \Carbon\Carbon::parse($row->started_at) : null;
            if ($startedAt) {
                $secs = max(0, now()->diffInSeconds($startedAt));
                HostReportHelper::addHoursFromSeconds((int) $row->host_id, $secs);
            }
        } catch (\Throwable $e) {
            \Log::warning('HostReportHelper end-credit failed: '.$e->getMessage());
        }

        $row = DB::table('live_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    // Viewer joins
    public function join(Request $request, int $id)
    {
        $user = $request->user();
        $row  = DB::table('live_rooms')->where('id', $id)->first();
        if (!$row) abort(404, 'Room not found');
        if (!$row->live) abort(410, 'Room is not live');
        if (
            $row->category === 'multi'
            && (int) $row->host_id !== (int) $user->id
            && !($user->is_admin ?? false)
            && !DB::table('live_room_cohost_requests')
                ->where('room_id', $id)
                ->where('user_id', $user->id)
                ->where('status', 'approved')
                ->exists()
        ) {
            abort(403, 'Multi Board is invite-only.');
        }

        $existing = DB::table('live_room_viewers')
            ->where('room_id', $id)->where('user_id', $user->id)->first();

        if ($existing) {
            DB::table('live_room_viewers')->where('id', $existing->id)->update([
                'last_seen_at' => now(),
                'left_at'      => null,
            ]);
        } else {
            DB::table('live_room_viewers')->insert([
                'room_id'      => $id,
                'user_id'      => $user->id,
                'joined_at'    => now(),
                'last_seen_at' => now(),
            ]);
        }

        $count = DB::table('live_room_viewers')->where('room_id', $id)->whereNull('left_at')->count();
        DB::table('live_rooms')->where('id', $id)->update([
            'viewer_count' => $count, 'updated_at' => now(),
        ]);

        try { event(new RoomViewerChanged($id, $user->id, 'join', $count)); } catch (\Throwable $e) {}

        $row = DB::table('live_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    // Viewer leaves
    public function leave(Request $request, int $id)
    {
        $user = $request->user();
        DB::table('live_room_viewers')
            ->where('room_id', $id)->where('user_id', $user->id)
            ->update(['left_at' => now()]);

        $count = DB::table('live_room_viewers')->where('room_id', $id)->whereNull('left_at')->count();
        DB::table('live_rooms')->where('id', $id)->update([
            'viewer_count' => $count, 'updated_at' => now(),
        ]);

        try { event(new RoomViewerChanged($id, $user->id, 'leave', $count)); } catch (\Throwable $e) {}

        return ['ok' => true, 'viewerCount' => $count];
    }

    // Heartbeat — keep viewer alive
    public function heartbeat(Request $request, int $id)
    {
        $user = $request->user();
        $role = $request->input('role');
        $room = DB::table('live_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Room not found');
        if (!$room->live || $room->ended_at) abort(410, 'Room is not live');

        if ((int) $room->host_id === (int) $user->id || $role === 'streamer') {
            DB::table('live_rooms')->where('id', $id)->update(['updated_at' => now()]);
        }

        DB::table('live_room_viewers')
            ->where('room_id', $id)->where('user_id', $user->id)
            ->update(['last_seen_at' => now(), 'left_at' => null]);
        return ['ok' => true];
    }

    public function like(Request $request, int $id)
    {
        $room = DB::table('live_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Room not found');
        if (!$room->live || $room->ended_at) abort(410, 'Room is not live');

        if (Schema::hasColumn('live_rooms', 'likes_count')) {
            DB::table('live_rooms')
                ->where('id', $id)
                ->increment('likes_count', 1, ['updated_at' => now()]);
        }

        $room = DB::table('live_rooms')->where('id', $id)->first();
        return ['ok' => true, 'likesCount' => property_exists($room, 'likes_count') ? (int) $room->likes_count : 0];
    }

    // Active viewers in a room
    public function viewers(Request $request, int $id)
    {
        $rows = DB::table('live_room_viewers as v')
            ->join('users as u', 'u.id', '=', 'v.user_id')
            ->where('v.room_id', $id)
            ->whereNull('v.left_at')
            ->orderByDesc('v.joined_at')
            ->limit(200)
            ->get(['u.id', 'u.name', 'u.avatar', 'v.joined_at']);
        return ['data' => $rows->map(fn ($r) => [
            'userId'   => (int) $r->id,
            'name'     => $r->name,
            'avatar'   => $r->avatar ?? $r->avatar_url ?? null,
            'joinedAt' => $r->joined_at,
        ])->values()];
    }

    public function requestCohost(Request $request, int $id)
    {
        $room = DB::table('live_rooms')->where('id', $id)->first();
        if (!$room || !$room->live || $room->ended_at) abort(410, 'Room is not live');
        if ((int) $room->host_id === (int) $request->user()->id) abort(422, 'Host is already on stage');

        DB::table('live_room_cohost_requests')->updateOrInsert(
            ['room_id' => $id, 'user_id' => $request->user()->id],
            ['status' => 'pending', 'responded_at' => null, 'updated_at' => now(), 'created_at' => now()]
        );

        return ['ok' => true, 'status' => 'pending'];
    }

    public function inviteCohost(Request $request, int $id)
    {
        $room = DB::table('live_rooms')->where('id', $id)->first();
        if (!$room || !$room->live || $room->ended_at) abort(410, 'Room is not live');
        if ((int) $room->host_id !== (int) $request->user()->id && !($request->user()->is_admin ?? false)) abort(403);

        $data = $request->validate(['userId' => 'required|integer|exists:users,id']);
        if ((int) $data['userId'] === (int) $room->host_id) abort(422, 'Host is already on stage');

        DB::table('live_room_cohost_requests')->updateOrInsert(
            ['room_id' => $id, 'user_id' => (int) $data['userId']],
            ['status' => 'invited', 'responded_at' => null, 'updated_at' => now(), 'created_at' => now()]
        );

        return ['ok' => true, 'status' => 'invited'];
    }

    public function myInvites(Request $request)
    {
        $rows = DB::table('live_room_cohost_requests as r')
            ->join('live_rooms as lr', 'lr.id', '=', 'r.room_id')
            ->join('users as h', 'h.id', '=', 'lr.host_id')
            ->where('r.user_id', $request->user()->id)
            ->where('r.status', 'invited')
            ->where('lr.live', true)
            ->whereNull('lr.ended_at')
            ->orderByDesc('r.updated_at')
            ->limit(20)
            ->get(['r.id', 'r.room_id', 'r.status', 'r.created_at', 'lr.title', 'lr.category', 'h.name as host_name', 'h.avatar as host_avatar']);

        return ['data' => $rows->map(fn ($r) => [
            'id' => (int) $r->id,
            'roomId' => (int) $r->room_id,
            'status' => $r->status,
            'title' => $r->title,
            'category' => $r->category,
            'hostName' => $r->host_name,
            'hostAvatar' => $r->host_avatar,
            'createdAt' => $r->created_at,
        ])->values()];
    }

    public function respondInvite(Request $request, int $requestId)
    {
        $data = $request->validate(['action' => 'required|in:accept,reject']);
        $invite = DB::table('live_room_cohost_requests')
            ->where('id', $requestId)
            ->where('user_id', $request->user()->id)
            ->where('status', 'invited')
            ->first();
        if (!$invite) abort(404, 'Invite not found');

        $room = DB::table('live_rooms')->where('id', $invite->room_id)->first();
        if (!$room || !$room->live || $room->ended_at) abort(410, 'Room is not live');

        DB::table('live_room_cohost_requests')->where('id', $requestId)->update([
            'status' => $data['action'] === 'accept' ? 'approved' : 'rejected',
            'responded_at' => now(),
            'updated_at' => now(),
        ]);

        return [
            'ok' => true,
            'status' => $data['action'] === 'accept' ? 'approved' : 'rejected',
            'data' => $this->shape($room),
        ];
    }

    public function cohostRequests(Request $request, int $id)
    {
        $room = DB::table('live_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Room not found');
        if ((int) $room->host_id !== (int) $request->user()->id && !($request->user()->is_admin ?? false)) abort(403);

        $rows = DB::table('live_room_cohost_requests as r')
            ->join('users as u', 'u.id', '=', 'r.user_id')
            ->where('r.room_id', $id)
            ->where('r.status', 'pending')
            ->orderBy('r.created_at')
            ->get(['r.id', 'r.user_id', 'r.status', 'r.created_at', 'u.name', 'u.avatar']);

        return ['data' => $rows->map(fn ($r) => [
            'id' => (int) $r->id,
            'userId' => (int) $r->user_id,
            'name' => $r->name,
            'avatar' => $r->avatar,
            'status' => $r->status,
            'createdAt' => $r->created_at,
        ])->values()];
    }

    public function respondCohost(Request $request, int $id, int $requestId)
    {
        $room = DB::table('live_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Room not found');
        if ((int) $room->host_id !== (int) $request->user()->id && !($request->user()->is_admin ?? false)) abort(403);

        $data = $request->validate(['action' => 'required|in:approve,reject']);
        $cohostRequest = DB::table('live_room_cohost_requests')
            ->where('id', $requestId)->where('room_id', $id)->first();
        if (!$cohostRequest) abort(404, 'Request not found');

        DB::table('live_room_cohost_requests')->where('id', $requestId)->update([
            'status' => $data['action'] === 'approve' ? 'approved' : 'rejected',
            'responded_at' => now(),
            'updated_at' => now(),
        ]);
        return ['ok' => true, 'status' => $data['action'] === 'approve' ? 'approved' : 'rejected'];
    }

    public function cohosts(Request $request, int $id)
    {
        $rows = DB::table('live_room_cohost_requests as r')
            ->join('users as u', 'u.id', '=', 'r.user_id')
            ->where('r.room_id', $id)->where('r.status', 'approved')
            ->orderBy('r.responded_at')
            ->get(['r.user_id', 'u.name', 'u.avatar']);
        return ['data' => $rows->map(fn ($r) => [
            'userId' => (int) $r->user_id,
            'name' => $r->name,
            'avatar' => $r->avatar,
        ])->values()];
    }

    public function leaveCohost(Request $request, int $id)
    {
        DB::table('live_room_cohost_requests')
            ->where('room_id', $id)->where('user_id', $request->user()->id)
            ->where('status', 'approved')
            ->update(['status' => 'left', 'updated_at' => now()]);
        return ['ok' => true];
    }

    public function kickCohost(Request $request, int $id, int $userId)
    {
        $room = DB::table('live_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Room not found');
        if ((int) $room->host_id !== (int) $request->user()->id && !($request->user()->is_admin ?? false)) abort(403);

        DB::table('live_room_cohost_requests')
            ->where('room_id', $id)
            ->where('user_id', $userId)
            ->where('status', 'approved')
            ->update(['status' => 'kicked', 'updated_at' => now()]);

        return ['ok' => true];
    }
}
