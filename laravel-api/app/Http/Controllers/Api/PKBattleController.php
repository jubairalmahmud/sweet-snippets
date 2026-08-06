<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

/**
 * ============================================================================
 *  PKBattleController — 1v1 Host PK
 * ----------------------------------------------------------------------------
 *  Endpoints (register inside auth:sanctum group):
 *
 *    GET   /pk/online-hosts                 onlineHosts()   — invite picker list
 *    POST  /pk/invite                       invite()        — send invite (from_host = auth user)
 *    GET   /pk/mine                         mine()          — poll my active/pending battle
 *    POST  /pk/accept                       accept()        — invitee accepts → starts battle
 *    POST  /pk/reject                       reject()        — invitee rejects
 *    POST  /pk/cancel                       cancel()        — inviter cancels pending invite
 *    POST  /pk/end                          end()           — either host ends early
 *    GET   /pk/{battle}/score               score()         — live score poll
 *    POST  /pk/{battle}/gift                gift()          — record a score event (gift → PK score)
 *
 *  Notes:
 *   - Online-host detection reads live_rooms and adapts to common schema
 *     variants used by the video streaming module.
 *   - Score is derived from SUM(pk_score_events.amount) then cached on the row.
 * ============================================================================
 */
class PKBattleController extends Controller
{
    /* ------------------------------------------------------------------ */
    /*  Helpers                                                            */
    /* ------------------------------------------------------------------ */

    protected function authUserId(Request $req): ?int
    {
        $u = $req->user();
        return $u ? (int) $u->id : null;
    }

    protected function battleOrFail($id)
    {
        $b = DB::table('pk_battles')->where('id', $id)->first();
        if (!$b) abort(response()->json(['message' => 'Battle not found'], 404));
        return $b;
    }

    protected function isParticipant($battle, int $uid): bool
    {
        return ((int)$battle->from_host_id === $uid) || ((int)$battle->to_host_id === $uid);
    }

    protected function liveRoomsHostColumn(): ?string
    {
        if (!Schema::hasTable('live_rooms')) return null;
        foreach (['host_id','user_id','broadcaster_id','owner_id','streamer_id','created_by'] as $c) {
            if (Schema::hasColumn('live_rooms', $c)) return $c;
        }
        return null;
    }

    protected function liveRoomIdForHost(int $hostId): ?int
    {
        $hostCol = $this->liveRoomsHostColumn();
        if (!$hostCol) return null;

        $q = DB::table('live_rooms')->where($hostCol, $hostId);

        if (Schema::hasColumn('live_rooms', 'ended_at')) {
            $q->where(function ($w) {
                $w->whereNull('ended_at')
                  ->orWhere('ended_at', '')
                  ->orWhere('ended_at', '0000-00-00 00:00:00');
            });
        }
        if (Schema::hasColumn('live_rooms', 'status')) {
            $q->whereNotIn('status', ['ended', 'closed', 'finished', 'stopped', 'offline']);
        }
        $truthyLiveValues = [1, '1', true, 'true', 'TRUE', 'live', 'Live', 'LIVE', 'active', 'Active', 'ACTIVE', 'yes', 'YES', 'on', 'ON'];
        if (Schema::hasColumn('live_rooms', 'is_live')) $q->whereIn('is_live', $truthyLiveValues);
        if (Schema::hasColumn('live_rooms', 'live'))    $q->whereIn('live',    $truthyLiveValues);
        if (Schema::hasColumn('live_rooms', 'active'))  $q->whereIn('active',  $truthyLiveValues);
        if (Schema::hasColumn('live_rooms', 'type'))    $q->whereNotIn('type', ['party', 'audio', 'Party', 'Audio']);
        if (Schema::hasColumn('live_rooms', 'mode'))    $q->whereNotIn('mode', ['party', 'audio', 'Party', 'Audio']);

        $row = $q->orderByDesc('id')->first(['id']);
        return $row && $row->id ? (int) $row->id : null;
    }

    /** Recompute cached scores + finalize if past end time. */
    protected function refreshBattle($battle)
    {
        $rows = DB::table('pk_score_events')
            ->select('host_id', DB::raw('SUM(amount) as total'))
            ->where('battle_id', $battle->id)
            ->groupBy('host_id')
            ->pluck('total', 'host_id');

        $fromScore = (int) ($rows[$battle->from_host_id] ?? 0);
        $toScore   = (int) ($rows[$battle->to_host_id] ?? 0);

        $patch = ['from_score' => $fromScore, 'to_score' => $toScore, 'updated_at' => now()];

        // PK viewer needs both hosts' live room IDs to subscribe to both Agora
        // channels. Hydrate missing IDs from the currently live video rooms so
        // older/missed accept payloads do not leave to_room_id/from_room_id null.
        if (in_array($battle->status, ['pending', 'active'], true)) {
            if (empty($battle->from_room_id)) {
                $fromRoomId = $this->liveRoomIdForHost((int) $battle->from_host_id);
                if ($fromRoomId) $patch['from_room_id'] = $fromRoomId;
            }
            if (empty($battle->to_room_id)) {
                $toRoomId = $this->liveRoomIdForHost((int) $battle->to_host_id);
                if ($toRoomId) $patch['to_room_id'] = $toRoomId;
            }
        }

        // Auto-finalize if ends_at passed
        if ($battle->status === 'active' && $battle->ends_at && Carbon::parse($battle->ends_at)->isPast()) {
            $patch['status']         = 'ended';
            $patch['ended_at']       = now();
            $patch['winner_host_id'] = $fromScore === $toScore
                ? null
                : ($fromScore > $toScore ? $battle->from_host_id : $battle->to_host_id);
        }

        DB::table('pk_battles')->where('id', $battle->id)->update($patch);
        return DB::table('pk_battles')->where('id', $battle->id)->first();
    }

    protected function shape($battle): array
    {
        return [
            'id'               => (int) $battle->id,
            'from_host_id'     => (int) $battle->from_host_id,
            'to_host_id'       => (int) $battle->to_host_id,
            'from_room_id'     => $battle->from_room_id ? (int) $battle->from_room_id : $this->liveRoomIdForHost((int) $battle->from_host_id),
            'to_room_id'       => $battle->to_room_id   ? (int) $battle->to_room_id   : $this->liveRoomIdForHost((int) $battle->to_host_id),
            'duration_minutes' => (int) $battle->duration_minutes,
            'status'           => (string) $battle->status,
            'from_score'       => (int) $battle->from_score,
            'to_score'         => (int) $battle->to_score,
            'winner_host_id'   => $battle->winner_host_id ? (int) $battle->winner_host_id : null,
            'started_at'       => $battle->started_at ? Carbon::parse($battle->started_at)->toIso8601String() : null,
            'ends_at'          => $battle->ends_at ? Carbon::parse($battle->ends_at)->toIso8601String() : null,
            'ended_at'         => $battle->ended_at ? Carbon::parse($battle->ended_at)->toIso8601String() : null,
            'server_now'       => now()->toIso8601String(),
            'remaining_sec'    => $battle->ends_at
                ? max(0, Carbon::parse($battle->ends_at)->diffInSeconds(now(), false) * -1)
                : null,
        ];
    }

    /* ------------------------------------------------------------------ */
    /*  Endpoints                                                          */
    /* ------------------------------------------------------------------ */

    /** GET /pk/online-hosts — video live streamers currently broadcasting. */
    public function onlineHosts(Request $req)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        if (!\Schema::hasTable('live_rooms')) {
            return response()->json(['data' => []]);
        }

        $hasEndedAt   = \Schema::hasColumn('live_rooms', 'ended_at');
        $hasUpdatedAt = \Schema::hasColumn('live_rooms', 'updated_at');
        $hasHeartbeat = \Schema::hasColumn('live_rooms', 'last_heartbeat_at');
        $hasStatus    = \Schema::hasColumn('live_rooms', 'status');
        $hasTitle     = \Schema::hasColumn('live_rooms', 'title');
        $hasViewers   = \Schema::hasColumn('live_rooms', 'viewer_count');
        $hasType      = \Schema::hasColumn('live_rooms', 'type');
        $hasMode      = \Schema::hasColumn('live_rooms', 'mode');
        $hasIsLive    = \Schema::hasColumn('live_rooms', 'is_live');
        $hasLive      = \Schema::hasColumn('live_rooms', 'live');
        $hasActive    = \Schema::hasColumn('live_rooms', 'active');

        // Detect which column stores the host user id
        $hostCol = null;
        foreach (['host_id','user_id','broadcaster_id','owner_id','streamer_id','created_by'] as $c) {
            if (\Schema::hasColumn('live_rooms', $c)) { $hostCol = $c; break; }
        }
        if (!$hostCol) {
            return response()->json([
                'data' => [],
                'error' => 'live_rooms has no recognizable host column',
                'columns' => \Schema::getColumnListing('live_rooms'),
            ]);
        }

        $usersTable = \Schema::hasTable('users') ? 'users' : null;
        $userNameCol = null; $userAvatarCol = null;
        if ($usersTable) {
            foreach (['name','username','display_name'] as $c) {
                if (\Schema::hasColumn($usersTable, $c)) { $userNameCol = $c; break; }
            }
            foreach (['avatar','avatar_url','profile_photo_url','profile_photo_path','profile_image','photo','image'] as $c) {
                if (\Schema::hasColumn($usersTable, $c)) { $userAvatarCol = $c; break; }
            }
        }

        $selects = ["lr.$hostCol as id", 'lr.id as room_id'];
        if ($hasTitle)   $selects[] = 'lr.title as room_title';
        if ($hasViewers) $selects[] = 'lr.viewer_count as viewers';
        if ($usersTable && $userNameCol)   $selects[] = "u.$userNameCol as name";
        if ($usersTable && $userAvatarCol) $selects[] = "u.$userAvatarCol as avatar";

        $q = DB::table('live_rooms as lr')->select($selects)
            ->whereNotNull("lr.$hostCol")
            ->where("lr.$hostCol", '!=', $uid);

        if ($usersTable) {
            $q->leftJoin("$usersTable as u", 'u.id', '=', "lr.$hostCol");
        }

        if ($hasEndedAt) {
            $q->where(function ($w) {
                $w->whereNull('lr.ended_at')
                  ->orWhere('lr.ended_at', '')
                  ->orWhere('lr.ended_at', '0000-00-00 00:00:00');
            });
        }
        if ($hasStatus)  $q->whereNotIn('lr.status', ['ended', 'closed', 'finished', 'stopped', 'offline']);
        // Accept both integer(1) and string('live'/'active'/'1') truthy values
        $truthyLiveValues = [1, '1', true, 'true', 'TRUE', 'live', 'Live', 'LIVE', 'active', 'Active', 'ACTIVE', 'yes', 'YES', 'on', 'ON'];
        if ($hasIsLive)  $q->whereIn('lr.is_live', $truthyLiveValues);
        if ($hasLive)    $q->whereIn('lr.live',    $truthyLiveValues);
        if ($hasActive)  $q->whereIn('lr.active',  $truthyLiveValues);
        if ($hasType)    $q->whereNotIn('lr.type', ['party', 'audio', 'Party', 'Audio']);
        if ($hasMode)    $q->whereNotIn('lr.mode', ['party', 'audio', 'Party', 'Audio']);

        // Freshness: only apply a dedicated heartbeat column. Do not use
        // updated_at here: some live-room endpoints keep live='live' current
        // but do not touch updated_at on every heartbeat, which hid real hosts.
        $cutoff = now()->subSeconds(90);
        if ($hasHeartbeat) {
            $q->where('lr.last_heartbeat_at', '>=', $cutoff);
        }

        try {
            $rows = $q->orderByDesc('lr.id')->limit(50)->get();
        } catch (\Throwable $e) {
            return response()->json(['data' => [], 'error' => $e->getMessage()]);
        }

        $out = $rows->map(fn($r) => [
            'id'        => (int) $r->id,
            'name'      => (string) ($r->name ?? ('Host #' . $r->id)),
            'avatar'    => $r->avatar ?? null,
            'room_id'   => isset($r->room_id) && $r->room_id ? (int) $r->room_id : null,
            'roomTitle' => $r->room_title ?? null,
            'viewers'   => isset($r->viewers) ? (int) $r->viewers : null,
        ])->values();

        if ($req->query('debug')) {
            return response()->json([
                'data'  => $out,
                'debug' => [
                    'host_col'   => $hostCol,
                    'columns'    => \Schema::getColumnListing('live_rooms'),
                    'count'      => $out->count(),
                    'sample_raw' => DB::table('live_rooms')->orderByDesc('id')->limit(3)->get(),
                ],
            ]);
        }

        return response()->json(['data' => $out]);
    }


    /** POST /pk/invite  body: { to_host_id, duration_minutes, room_id? } */
    public function invite(Request $req)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        $data = $req->validate([
            'to_host_id'       => 'required|integer|different:from',
            'duration_minutes' => 'nullable|integer|in:3,5,10',
            'room_id'          => 'nullable|integer',
        ]);

        $toHostId = (int) $data['to_host_id'];
        if ($toHostId === $uid) {
            return response()->json(['message' => 'Cannot invite yourself'], 400);
        }

        // Auto-expire stale pending invites (>45s old) so ghosts don't block future PKs
        DB::table('pk_battles')
            ->where('status', 'pending')
            ->where('created_at', '<', now()->subSeconds(45))
            ->update(['status' => 'expired', 'ended_at' => now(), 'updated_at' => now()]);

        // Auto-cancel any of MY own still-pending invites so I can freely retry
        DB::table('pk_battles')
            ->where('status', 'pending')
            ->where('from_host_id', $uid)
            ->update(['status' => 'cancelled', 'ended_at' => now(), 'updated_at' => now()]);

        // Now only block if the OTHER side is genuinely busy (active battle, or pending they received)
        $busy = DB::table('pk_battles')
            ->whereIn('status', ['pending', 'active'])
            ->where(function ($w) use ($uid, $toHostId) {
                $w->where('from_host_id', $toHostId)
                  ->orWhere('to_host_id', $toHostId)
                  ->orWhere(function ($w2) use ($uid) {
                      $w2->where('from_host_id', $uid)->orWhere('to_host_id', $uid);
                  })->where('status', 'active');
            })
            ->first();
        if ($busy) {
            return response()->json([
                'message'   => 'Opponent is currently in another PK battle',
                'battle_id' => (int) $busy->id,
            ], 409);
        }


        $id = DB::table('pk_battles')->insertGetId([
            'from_host_id'     => $uid,
            'to_host_id'       => $toHostId,
            'from_room_id'     => $data['room_id'] ?? $this->liveRoomIdForHost($uid),
            'to_room_id'       => null,
            'duration_minutes' => (int) ($data['duration_minutes'] ?? 5),
            'status'           => 'pending',
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        return response()->json([
            'ok'        => true,
            'battle_id' => $id,
            'battle'    => $this->shape(DB::table('pk_battles')->where('id', $id)->first()),
        ]);
    }

    /** GET /pk/mine — most recent pending/active battle involving me. */
    public function mine(Request $req)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        // Auto-expire stale pending invites (>45s) before returning "mine"
        DB::table('pk_battles')
            ->where('status', 'pending')
            ->where('created_at', '<', now()->subSeconds(45))
            ->update(['status' => 'expired', 'ended_at' => now(), 'updated_at' => now()]);

        $b = DB::table('pk_battles')
            ->whereIn('status', ['pending', 'active'])
            ->where(function ($w) use ($uid) {
                $w->where('from_host_id', $uid)->orWhere('to_host_id', $uid);
            })
            ->orderByDesc('id')
            ->first();

        if (!$b) return response()->json(['data' => null]);


        $b = $this->refreshBattle($b);
        $out = $this->shape($b);

        // Enrich with inviter (from_host) and invitee (to_host) name/avatar
        if (Schema::hasTable('users')) {
            $nameCol = null; $avatarCol = null;
            foreach (['name','username','display_name'] as $c) {
                if (Schema::hasColumn('users', $c)) { $nameCol = $c; break; }
            }
            foreach (['avatar','avatar_url','profile_photo_url','profile_photo_path','profile_image','photo','image'] as $c) {
                if (Schema::hasColumn('users', $c)) { $avatarCol = $c; break; }
            }
            $selects = ['id'];
            if ($nameCol) $selects[] = "$nameCol as name";
            if ($avatarCol) $selects[] = "$avatarCol as avatar";
            $users = DB::table('users')
                ->whereIn('id', [$b->from_host_id, $b->to_host_id])
                ->select($selects)->get()->keyBy('id');
            $from = $users[$b->from_host_id] ?? null;
            $to   = $users[$b->to_host_id]   ?? null;
            $out['from_name']   = $from->name   ?? ('Host #' . $b->from_host_id);
            $out['from_avatar'] = $from->avatar ?? null;
            $out['to_name']     = $to->name     ?? ('Host #' . $b->to_host_id);
            $out['to_avatar']   = $to->avatar   ?? null;
        }

        return response()->json(['data' => $out]);
    }


    /** POST /pk/accept  body: { battle_id, room_id? } — invitee only. */
    public function accept(Request $req)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        $data = $req->validate([
            'battle_id' => 'required|integer',
            'room_id'   => 'nullable|integer',
        ]);

        $b = $this->battleOrFail($data['battle_id']);
        if ((int)$b->to_host_id !== $uid) {
            return response()->json(['message' => 'Only invitee can accept'], 403);
        }
        if ($b->status !== 'pending') {
            return response()->json(['message' => 'Invite is no longer pending', 'status' => $b->status], 409);
        }

        $now  = now();
        $ends = (clone $now)->addMinutes((int) $b->duration_minutes);
        DB::table('pk_battles')->where('id', $b->id)->update([
            'status'     => 'active',
            'to_room_id' => $data['room_id'] ?? $b->to_room_id ?? $this->liveRoomIdForHost($uid),
            'started_at' => $now,
            'ends_at'    => $ends,
            'updated_at' => $now,
        ]);

        return response()->json(['ok' => true, 'battle' => $this->shape(DB::table('pk_battles')->where('id', $b->id)->first())]);
    }

    /** POST /pk/reject  body: { battle_id } — invitee only. */
    public function reject(Request $req)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        $data = $req->validate(['battle_id' => 'required|integer']);
        $b = $this->battleOrFail($data['battle_id']);

        if ((int)$b->to_host_id !== $uid) {
            return response()->json(['message' => 'Only invitee can reject'], 403);
        }
        if ($b->status !== 'pending') {
            return response()->json(['message' => 'Invite is no longer pending', 'status' => $b->status], 409);
        }

        DB::table('pk_battles')->where('id', $b->id)->update([
            'status'     => 'rejected',
            'ended_at'   => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    /** POST /pk/cancel body: { battle_id } — inviter cancels pending invite. */
    public function cancel(Request $req)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        $data = $req->validate(['battle_id' => 'required|integer']);
        $b = $this->battleOrFail($data['battle_id']);

        if ((int)$b->from_host_id !== $uid) {
            return response()->json(['message' => 'Only inviter can cancel'], 403);
        }
        if ($b->status !== 'pending') {
            return response()->json(['message' => 'Cannot cancel', 'status' => $b->status], 409);
        }

        DB::table('pk_battles')->where('id', $b->id)->update([
            'status'     => 'cancelled',
            'ended_at'   => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    /** POST /pk/end body: { battle_id } — either participant ends early. */
    public function end(Request $req)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        $data = $req->validate(['battle_id' => 'required|integer']);
        $b = $this->battleOrFail($data['battle_id']);

        if (!$this->isParticipant($b, $uid)) {
            return response()->json(['message' => 'Not a participant'], 403);
        }
        if (!in_array($b->status, ['pending', 'active'], true)) {
            return response()->json(['message' => 'Battle already finished', 'status' => $b->status], 409);
        }

        // Recompute + choose winner
        $b = $this->refreshBattle($b);
        $winner = $b->from_score === $b->to_score
            ? null
            : ($b->from_score > $b->to_score ? $b->from_host_id : $b->to_host_id);

        DB::table('pk_battles')->where('id', $b->id)->update([
            'status'         => 'ended',
            'ended_at'       => now(),
            'winner_host_id' => $winner,
            'updated_at'     => now(),
        ]);

        return response()->json(['ok' => true, 'battle' => $this->shape(DB::table('pk_battles')->where('id', $b->id)->first())]);
    }

    /** GET /pk/{battle}/score — live cached score + auto-finalize check. */
    /**
     * GET /pk/active — public list of all currently active PK battles.
     * Used by Explore "⚔️ PK Battle" tab and auto-sync when a host starts PK.
     * Enriches with host name + avatar for both sides.
     */
    public function active(Request $req)
    {
        // Auto-end battles whose ends_at has passed
        DB::table('pk_battles')
            ->where('status', 'active')
            ->whereNotNull('ends_at')
            ->where('ends_at', '<', now())
            ->update(['status' => 'ended', 'ended_at' => now(), 'updated_at' => now()]);

        $rows = DB::table('pk_battles')
            ->where('status', 'active')
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        if ($rows->isEmpty()) return response()->json(['data' => []]);

        // Resolve user name/avatar in one query
        $userMap = collect();
        if (Schema::hasTable('users')) {
            $nameCol = null; $avatarCol = null;
            foreach (['name','username','display_name'] as $c) {
                if (Schema::hasColumn('users', $c)) { $nameCol = $c; break; }
            }
            foreach (['avatar','avatar_url','profile_photo_url','profile_photo_path','profile_image','photo','image'] as $c) {
                if (Schema::hasColumn('users', $c)) { $avatarCol = $c; break; }
            }
            $ids = $rows->flatMap(fn($r) => [$r->from_host_id, $r->to_host_id])->unique()->values()->all();
            $selects = ['id'];
            if ($nameCol)   $selects[] = "$nameCol as name";
            if ($avatarCol) $selects[] = "$avatarCol as avatar";
            $userMap = DB::table('users')->whereIn('id', $ids)->select($selects)->get()->keyBy('id');
        }

        $out = $rows->map(function ($b) use ($userMap) {
            $b = $this->refreshBattle($b);
            $s = $this->shape($b);
            $from = $userMap[$b->from_host_id] ?? null;
            $to   = $userMap[$b->to_host_id]   ?? null;
            $s['from_name']   = $from->name   ?? ('Host #' . $b->from_host_id);
            $s['from_avatar'] = $from->avatar ?? null;
            $s['to_name']     = $to->name     ?? ('Host #' . $b->to_host_id);
            $s['to_avatar']   = $to->avatar   ?? null;
            return $s;
        })->values();

        return response()->json(['data' => $out]);
    }

    public function score(Request $req, $battle)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        $b = $this->battleOrFail($battle);
        $b = $this->refreshBattle($b);
        return response()->json(['data' => $this->shape($b)]);
    }

    /** POST /pk/{battle}/gift body: { host_id, amount, source?, meta? } — append score event. */
    public function gift(Request $req, $battle)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);

        $data = $req->validate([
            'host_id' => 'required|integer',
            'amount'  => 'required|integer|min:1',
            'source'  => 'nullable|string|max:32',
            'meta'    => 'nullable|string|max:255',
        ]);

        $b = $this->battleOrFail($battle);
        if ($b->status !== 'active') {
            return response()->json(['message' => 'Battle is not active', 'status' => $b->status], 409);
        }
        $hostId = (int) $data['host_id'];
        if ($hostId !== (int)$b->from_host_id && $hostId !== (int)$b->to_host_id) {
            return response()->json(['message' => 'host_id must be one of the participants'], 422);
        }
        if ($b->ends_at && Carbon::parse($b->ends_at)->isPast()) {
            $b = $this->refreshBattle($b);
            return response()->json(['message' => 'Battle already ended', 'battle' => $this->shape($b)], 409);
        }

        DB::table('pk_score_events')->insert([
            'battle_id'  => $b->id,
            'host_id'    => $hostId,
            'user_id'    => $uid,
            'amount'     => (int) $data['amount'],
            'source'     => $data['source'] ?? 'gift',
            'meta'       => $data['meta'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $b = $this->refreshBattle($b);
        return response()->json(['ok' => true, 'battle' => $this->shape($b)]);
    }

    /* ------------------------------------------------------------------ */
    /*  Comments                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * Runtime ALTER/CREATE can fail on shared hosting and turn comment posting
     * into a generic Laravel "Server Error". The uploaded SQL dump already has
     * the correct pk_comments table, so comments now only validate the existing
     * schema and return a clear JSON error if the table is incomplete.
     */
    protected function ensurePkCommentsTable(): void
    {
        return;
    }

    /** Read pk_comments columns after applying the lightweight repair above. */
    protected function pkCommentColumns(): array
    {
        if (!Schema::hasTable('pk_comments')) return [];
        return Schema::getColumnListing('pk_comments');
    }

    /**
     * Some phpMyAdmin imports apply CREATE TABLE but miss the later
     * AUTO_INCREMENT ALTER statement. If id has no default, normal insert fails
     * with SQLSTATE HY000/1364. Fall back to a manual id so comments still work.
     */
    protected function insertPkComment(array $insert): int
    {
        try {
            return (int) DB::table('pk_comments')->insertGetId($insert);
        } catch (\Throwable $e) {
            $message = $e->getMessage();
            $looksLikeMissingAutoIncrement = stripos($message, "Field 'id' doesn't have a default value") !== false
                || stripos($message, 'pk_comments.id') !== false
                || stripos($message, '1364') !== false;

            if (!$looksLikeMissingAutoIncrement) throw $e;

            $nextId = ((int) DB::table('pk_comments')->max('id')) + 1;
            $insertWithId = ['id' => $nextId] + $insert;
            DB::table('pk_comments')->insert($insertWithId);
            return $nextId;
        }
    }

    protected function firstPkCommentColumn(array $columns, array $candidates): ?string
    {
        foreach ($candidates as $column) {
            if (in_array($column, $columns, true)) return $column;
        }
        return null;
    }

    protected function pkCommentSchemaError(array $columns)
    {
        if (empty($columns)) {
            return response()->json([
                'message' => 'PK comments table is missing. Run the pk_comments migration first.',
            ], 500);
        }

        $missing = [];
        foreach (['battle_id', 'user_id'] as $required) {
            if (!in_array($required, $columns, true)) $missing[] = $required;
        }
        if (!$this->firstPkCommentColumn($columns, ['text', 'body', 'comment', 'message'])) {
            $missing[] = 'text';
        }

        if ($missing) {
            return response()->json([
                'message' => 'PK comments table is incomplete. Missing: ' . implode(', ', $missing),
            ], 500);
        }

        return null;
    }

    protected function safeCommentText(string $text, int $limit = 180): string
    {
        $text = trim($text);
        return function_exists('mb_substr') ? mb_substr($text, 0, $limit) : substr($text, 0, $limit);
    }

    protected function safeString($value, int $limit, string $fallback = ''): string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') $value = $fallback;
        return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
    }

    protected function safeNullableString($value, int $limit): ?string
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '') return null;
        return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
    }

    /** GET /pk/{battle}/comments?after_id=X — list latest 100 (or after id). */
    public function listComments(Request $req, $battle)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);
        try {
            $columns = $this->pkCommentColumns();
            if ($error = $this->pkCommentSchemaError($columns)) return $error;

            $textCol = $this->firstPkCommentColumn($columns, ['text', 'body', 'comment', 'message']) ?: 'text';
            $afterId = (int) $req->query('after_id', 0);
            $q = DB::table('pk_comments')->where('battle_id', (int) $battle);
            if ($afterId > 0 && in_array('id', $columns, true)) $q->where('id', '>', $afterId);
            $rows = $q->orderBy(in_array('id', $columns, true) ? 'id' : 'created_at', 'asc')->limit(100)->get();

            return response()->json([
                'data' => $rows->map(function ($r) use ($textCol, $columns) {
                    $id = isset($r->id) ? (int) $r->id : 0;
                    $userId = isset($r->user_id) ? (int) $r->user_id : 0;
                    $createdAt = in_array('created_at', $columns, true) && !empty($r->created_at)
                        ? Carbon::parse($r->created_at)->toIso8601String()
                        : null;

                    return [
                        'id'          => $id,
                        'user_id'     => $userId,
                        'user_name'   => (string) ($r->user_name ?? ('User #' . $userId)),
                        'user_avatar' => $r->user_avatar ?? null,
                        'role'        => (string) ($r->role ?? 'viewer'),
                        'text'        => (string) ($r->{$textCol} ?? ''),
                        'created_at'  => $createdAt,
                    ];
                })->values(),
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'PK comments load failed',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    /** POST /pk/{battle}/comment body: { text } */
    public function postComment(Request $req, $battle)
    {
        $uid = $this->authUserId($req);
        if (!$uid) return response()->json(['message' => 'Unauthorized'], 401);
        try {
            $columns = $this->pkCommentColumns();
            if ($error = $this->pkCommentSchemaError($columns)) return $error;

            // Accept PK payload `{ text }`, live-room style `{ body }`, and a
            // few older aliases. Truncate instead of rejecting long mobile text.
            $text = $this->safeCommentText((string) $req->input(
                'text',
                $req->input('body', $req->input('comment', $req->input('message', '')))
            ));
            if ($text === '') return response()->json(['message' => 'Empty comment'], 422);

            $b = $this->battleOrFail($battle);
            if (!in_array($b->status, ['active', 'pending'], true)) {
                return response()->json(['message' => 'Battle is not live', 'status' => $b->status], 409);
            }

            // Resolve name/avatar from users table (best-effort).
            $name = null; $avatar = null;
            if (Schema::hasTable('users')) {
                $userColumns = Schema::getColumnListing('users');
                $nameCol = $this->firstPkCommentColumn($userColumns, ['name','username','display_name']);
                $avatarCol = $this->firstPkCommentColumn($userColumns, ['avatar_url','profile_photo_url','profile_photo_path','profile_image','photo','image','avatar']);
                $selects = ['id'];
                if ($nameCol) $selects[] = "$nameCol as name";
                if ($avatarCol) $selects[] = "$avatarCol as avatar";
                $u = DB::table('users')->where('id', $uid)->select($selects)->first();
                if ($u) {
                    $name = $this->safeNullableString($u->name ?? null, 60);
                    // Prefer real URL columns for comments. The users.avatar
                    // column in the live dump is LONGTEXT/base64, which should
                    // not be copied into pk_comments.user_avatar varchar fields.
                    $avatar = $this->safeNullableString($u->avatar ?? null, 250);
                }
            }

            // Keep the stored role conservative. Some live/shared-hosting DBs
            // were created with role as enum('viewer','host') or NOT NULL, so
            // inserting host_from/host_to can throw SQLSTATE 1265/01000 and the
            // browser only shows a generic 500 Server Error. The frontend does
            // not require this column to save/load comments, so always store a
            // schema-safe value.
            $role = 'viewer';

            $textCol = $this->firstPkCommentColumn($columns, ['text', 'body', 'comment', 'message']) ?: 'text';
            $insert = [
                'battle_id'   => (int) $b->id,
                'user_id'     => $uid,
                $textCol      => $text,
            ];
            if (in_array('user_name', $columns, true)) $insert['user_name'] = $this->safeString($name, 60, 'User #' . $uid);
            if (in_array('user_avatar', $columns, true)) $insert['user_avatar'] = $this->safeString($avatar, 240, '');
            if (in_array('role', $columns, true)) $insert['role'] = $role;
            if (in_array('created_at', $columns, true)) $insert['created_at'] = now();
            if (in_array('updated_at', $columns, true)) $insert['updated_at'] = now();

            $id = $this->insertPkComment($insert);

            return response()->json([
                'ok' => true,
                'comment' => [
                    'id' => (int) $id, 'user_id' => $uid, 'user_name' => $name ?: ('User #' . $uid),
                    'user_avatar' => $avatar, 'role' => $role, 'text' => $text,
                    'created_at' => now()->toIso8601String(),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'PK comment save failed',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }
}


