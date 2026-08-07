<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * PartyJoinRequestController (hardened)
 *
 * Handles Private Party Room join requests:
 *   POST   /api/party-rooms/{room}/join-requests           -> guest requests to join
 *   GET    /api/party-rooms/{room}/join-requests           -> host lists pending requests
 *   POST   /api/party-rooms/{room}/join-requests/{id}/accept
 *   POST   /api/party-rooms/{room}/join-requests/{id}/reject
 *   GET    /api/party-rooms/{room}/join-requests/mine      -> guest polls own status
 *
 * All endpoints wrap logic in try/catch and return JSON error details
 * instead of a bare 500 HTML page, so the frontend can show a meaningful
 * toast and we can debug fast.
 */
class PartyJoinRequestController extends Controller
{
    /* ---------------------------------------------------------------- helpers */

    protected function ensureTable(): void
    {
        if (Schema::hasTable('party_join_requests')) {
            return;
        }
        Schema::create('party_join_requests', function ($t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('room_id')->index();
            $t->unsignedBigInteger('user_id')->index();
            $t->string('user_name', 191)->nullable();
            $t->string('user_avatar', 512)->nullable();
            $t->string('user_code', 64)->nullable();
            $t->enum('status', ['pending', 'accepted', 'rejected'])->default('pending')->index();
            $t->timestamp('created_at')->nullable();
            $t->timestamp('updated_at')->nullable();
            $t->index(['room_id', 'status']);
            $t->index(['room_id', 'user_id']);
        });
    }

    protected function pickName($user): ?string
    {
        if (!$user) return null;
        foreach (['display_name', 'name', 'username', 'nickname', 'full_name'] as $k) {
            $v = data_get($user, $k);
            if (is_string($v) && $v !== '') return $v;
        }
        return null;
    }

    protected function pickAvatar($user): ?string
    {
        if (!$user) return null;
        foreach (['avatar', 'avatar_url', 'photo', 'photo_url', 'profile_image', 'image'] as $k) {
            $v = data_get($user, $k);
            if (is_string($v) && $v !== '') return $v;
        }
        return null;
    }

    protected function pickCode($user): ?string
    {
        if (!$user) return null;
        foreach (['code', 'user_code', 'sk_id', 'display_id', 'public_id'] as $k) {
            $v = data_get($user, $k);
            if (is_string($v) && $v !== '') return $v;
            if (is_numeric($v)) return (string) $v;
        }
        return null;
    }

    protected function isHost(int $roomId, int $userId): bool
    {
        try {
            $host = DB::table('party_rooms')->where('id', $roomId)->value('host_id');
            return $host !== null && (int) $host === $userId;
        } catch (Throwable $e) {
            return false;
        }
    }

    protected function fail(Throwable $e, string $where)
    {
        Log::error('[JoinReq] ' . $where . ': ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString(),
        ]);
        return response()->json([
            'ok'      => false,
            'where'   => $where,
            'message' => $e->getMessage(),
        ], 500);
    }

    /* ---------------------------------------------------------------- endpoints */

    // POST /api/party-rooms/{room}/join-requests
    public function store(Request $request, $room)
    {
        try {
            $this->ensureTable();
            $user = $request->user();
            if (!$user) {
                return response()->json(['ok' => false, 'message' => 'Unauthenticated'], 401);
            }
            $roomId = (int) $room;
            $userId = (int) $user->id;

            // Host doesn't request itself
            if ($this->isHost($roomId, $userId)) {
                return response()->json(['ok' => true, 'skipped' => 'host']);
            }

            $now = date('Y-m-d H:i:s');

            // De-dupe pending request
            $existing = DB::table('party_join_requests')
                ->where('room_id', $roomId)
                ->where('user_id', $userId)
                ->where('status', 'pending')
                ->first();

            if ($existing) {
                return response()->json(['ok' => true, 'id' => $existing->id, 'status' => 'pending', 'duplicated' => true]);
            }

            $id = DB::table('party_join_requests')->insertGetId([
                'room_id'     => $roomId,
                'user_id'     => $userId,
                'user_name'   => $this->pickName($user),
                'user_avatar' => $this->pickAvatar($user),
                'user_code'   => $this->pickCode($user),
                'status'      => 'pending',
                'created_at'  => $now,
                'updated_at'  => $now,
            ]);

            return response()->json(['ok' => true, 'id' => $id, 'status' => 'pending']);
        } catch (Throwable $e) {
            return $this->fail($e, 'store');
        }
    }

    // GET /api/party-rooms/{room}/join-requests  (host)
    public function index(Request $request, $room)
    {
        try {
            $this->ensureTable();
            $user = $request->user();
            if (!$user) return response()->json(['ok' => false, 'message' => 'Unauthenticated'], 401);
            $roomId = (int) $room;
            if (!$this->isHost($roomId, (int) $user->id)) {
                return response()->json(['ok' => false, 'message' => 'Only host can view requests'], 403);
            }

            $rows = DB::table('party_join_requests')
                ->where('room_id', $roomId)
                ->where('status', 'pending')
                ->orderBy('id', 'desc')
                ->get();

            return response()->json([
                'ok'       => true,
                'count'    => $rows->count(),
                'requests' => $rows,
            ]);
        } catch (Throwable $e) {
            return $this->fail($e, 'index');
        }
    }

    // GET /api/party-rooms/{room}/join-requests/mine
    public function mine(Request $request, $room)
    {
        try {
            $this->ensureTable();
            $user = $request->user();
            if (!$user) return response()->json(['ok' => false, 'message' => 'Unauthenticated'], 401);

            $row = DB::table('party_join_requests')
                ->where('room_id', (int) $room)
                ->where('user_id', (int) $user->id)
                ->orderBy('id', 'desc')
                ->first();

            return response()->json([
                'ok'      => true,
                'status'  => $row->status ?? null,
                'request' => $row,
            ]);
        } catch (Throwable $e) {
            return $this->fail($e, 'mine');
        }
    }

    // POST /api/party-rooms/{room}/join-requests/{id}/accept
    public function accept(Request $request, $room, $id)
    {
        try {
            $this->ensureTable();
            $user = $request->user();
            if (!$user) return response()->json(['ok' => false, 'message' => 'Unauthenticated'], 401);
            $roomId = (int) $room;
            if (!$this->isHost($roomId, (int) $user->id)) {
                return response()->json(['ok' => false, 'message' => 'Only host can accept'], 403);
            }

            DB::table('party_join_requests')
                ->where('id', (int) $id)
                ->where('room_id', $roomId)
                ->update(['status' => 'accepted', 'updated_at' => date('Y-m-d H:i:s')]);

            return response()->json(['ok' => true, 'status' => 'accepted']);
        } catch (Throwable $e) {
            return $this->fail($e, 'accept');
        }
    }

    // POST /api/party-rooms/{room}/join-requests/{id}/reject
    public function reject(Request $request, $room, $id)
    {
        try {
            $this->ensureTable();
            $user = $request->user();
            if (!$user) return response()->json(['ok' => false, 'message' => 'Unauthenticated'], 401);
            $roomId = (int) $room;
            if (!$this->isHost($roomId, (int) $user->id)) {
                return response()->json(['ok' => false, 'message' => 'Only host can reject'], 403);
            }

            DB::table('party_join_requests')
                ->where('id', (int) $id)
                ->where('room_id', $roomId)
                ->update(['status' => 'rejected', 'updated_at' => date('Y-m-d H:i:s')]);

            return response()->json(['ok' => true, 'status' => 'rejected']);
        } catch (Throwable $e) {
            return $this->fail($e, 'reject');
        }
    }
}
