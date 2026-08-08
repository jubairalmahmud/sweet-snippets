<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Throwable;

class PartyRoomController extends Controller
{
    private function touchPresence(int $roomId, object $user): array
    {
        $key = "party_room_presence_{$roomId}";
        $now = time();
        $presence = (array) Cache::get($key, []);
        $presence = array_filter($presence, fn ($row) => (int) ($row['lastSeen'] ?? 0) >= $now - 45);
        $presence[(string) $user->id] = [
            'id' => (int) $user->id,
            'userId' => (int) $user->id,
            'name' => $user->name ?? 'Viewer',
            'avatar' => $this->pickAvatar($user),
            'lastSeen' => $now,
        ];
        Cache::put($key, $presence, now()->addMinutes(2));
        return array_values($presence);
    }

    private function roomPresence(int $roomId): array
    {
        $key = "party_room_presence_{$roomId}";
        $now = time();
        $presence = array_filter(
            (array) Cache::get($key, []),
            fn ($row) => (int) ($row['lastSeen'] ?? 0) >= $now - 45
        );
        Cache::put($key, $presence, now()->addMinutes(2));
        return array_values($presence);
    }

    /**
     * Build the JSON shape the frontend (App.tsx → applyPartyRoomState) expects.
     * Always re-reads host + seats + recent gifts from DB so BOTH host-side and
     * guest-side polling see the SAME state.
     */
    private function tableExists(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (Throwable $e) {
            return false;
        }
    }

    private function columnExists(string $table, string $column): bool
    {
        static $cache = [];
        $key = $table . '.' . $column;

        if (!array_key_exists($key, $cache)) {
            try {
                $cache[$key] = Schema::hasColumn($table, $column);
            } catch (Throwable $e) {
                $cache[$key] = false;
            }
        }

        return (bool) $cache[$key];
    }

    private function prop(?object $row, string $key, mixed $default = null): mixed
    {
        return ($row && property_exists($row, $key)) ? $row->{$key} : $default;
    }

    /** Return list of avatar columns on `users` in priority order. */
    private function userAvatarColumns(): array
    {
        static $cols = null;
        if ($cols === null) {
            $cols = [];
            foreach (['avatar_url', 'avatar', 'profile_image', 'photo_url', 'image'] as $c) {
                if ($this->columnExists('users', $c)) $cols[] = $c;
            }
        }
        return $cols;
    }

    private function pickAvatar(?object $u): ?string
    {
        if (!$u) return null;
        foreach ($this->userAvatarColumns() as $c) {
            $v = $u->{$c} ?? null;
            if (is_string($v) && $v !== '') return $v;
        }
        return null;
    }

    private function frameShape(?array $frame, ?object $user = null): array
    {
        $code = $frame['code'] ?? ($frame['frameId'] ?? null);
        if (!$code && $user) {
            $code = $user->avatar_frame ?? ($user->avatar_frame_id ?? null);
        }
        $imageUrl = $frame['imageUrl'] ?? null;
        $entryEffect = $user->entry_effect ?? null;

        return [
            'frame' => $code,
            'frameId' => $code,
            'avatarFrame' => $code,
            'avatar_frame' => $code,
            'frameImg' => $imageUrl,
            'frameImage' => $imageUrl,
            'frameImageUrl' => $imageUrl,
            'entryEffect' => $entryEffect,
            'entry_effect' => $entryEffect,
        ];
    }

    private function userFramesFor(array $userIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $userIds))));
        if (empty($ids)) return [];

        // Keep party room stable even if the optional UserFrames helper is not
        // present on the server. Missing helper was causing /api/party-rooms 500.
        if (class_exists('App\\Support\\UserFrames')) {
            try {
                return \App\Support\UserFrames::forUsers($ids);
            } catch (Throwable $e) {
                return [];
            }
        }

        return [];
    }

    /** Which seat number is reserved for the host (crown seat). */
    private function hostSeatNum(): int
    {
        return 1;
    }

    private function normalizeLockedSeats(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = is_array($decoded) ? $decoded : [];
        }
        if (!is_array($value)) return [];

        return array_values(array_unique(array_filter(array_map(
            fn ($n) => (int) $n,
            $value
        ), fn ($n) => $n > 0)));
    }

    /**
     * Live servers may have slightly different party_room_seats schemas. The
     * previous controller assumed left_at / updated_at / occupant_avatar always
     * existed; on older installs that made every join fail with a DB error that
     * the frontend saw as "seat already booked". These helpers keep seat writes
     * compatible with both old and new tables.
     */
    private function activeSeatQuery(int $roomId)
    {
        $query = DB::table('party_room_seats')->where('room_id', $roomId);
        if ($this->columnExists('party_room_seats', 'left_at')) {
            $query->whereNull('left_at');
        }
        return $query;
    }

    private function seatTimestampUpdate(): array
    {
        return $this->columnExists('party_room_seats', 'updated_at')
            ? ['updated_at' => now()]
            : [];
    }

    private function markSeatRowsInactive($query): void
    {
        if ($this->columnExists('party_room_seats', 'left_at')) {
            $query->update(array_merge(['left_at' => now()], $this->seatTimestampUpdate()));
            return;
        }

        // Older table without left_at: remove the old active row so a fresh
        // row can represent the current seat owner.
        $query->delete();
    }

    /**
     * Extra seat-write mutex for shared-host MySQL installs.
     *
     * lockForUpdate() is enough on proper InnoDB tables, but some shared hosts
     * run mixed/legacy table settings where row locks do not reliably serialize
     * two guests tapping the same seat at the same time. MySQL GET_LOCK gives us
     * a room-level write gate without requiring a migration. If the database is
     * not MySQL or GET_LOCK is unavailable, we silently fall back to the normal
     * transaction + row-lock path below.
     */
    private function acquireSeatWriteLock(int $roomId): ?string
    {
        $lockName = 'sklove_party_room_' . $roomId . '_seat_write';

        try {
            $row = DB::selectOne('SELECT GET_LOCK(?, 8) AS acquired', [$lockName]);
        } catch (Throwable $e) {
            return null;
        }

        $acquired = (int) ($row->acquired ?? 0);
        if ($acquired !== 1) {
            abort(409, 'Seat is busy, please try again');
        }

        return $lockName;
    }

    private function releaseSeatWriteLock(?string $lockName): void
    {
        if (!$lockName) return;

        try {
            DB::select('SELECT RELEASE_LOCK(?)', [$lockName]);
        } catch (Throwable $e) {
            // Nothing to do — connection close also releases MySQL named locks.
        }
    }

    /**
     * Clean broken duplicate active rows WITHOUT using any time-based eviction.
     *
     * Previous versions treated seats as stale after ~90 seconds. That caused
     * real guests to be removed from seats while they were still in the room.
     * This cleaner only removes impossible duplicates that already exist in DB:
     *   - more than one active row for the same seat_num
     *   - more than one active row for the same user_id
     * It keeps the newest row and marks/deletes the older duplicates.
     */
    private function cleanupDuplicateActiveSeats(int $roomId): void
    {
        if (!$this->tableExists('party_room_seats')) return;

        try {
            $rows = $this->activeSeatQuery($roomId)
                ->when($this->columnExists('party_room_seats', 'updated_at'), fn ($q) => $q->orderByDesc('updated_at'))
                ->when($this->columnExists('party_room_seats', 'id'), fn ($q) => $q->orderByDesc('id'))
                ->get();

            $seenSeats = [];
            $seenUsers = [];
            $duplicateIds = [];

            foreach ($rows as $row) {
                $rowId = (int) $this->prop($row, 'id', 0);
                $seatNum = (int) $this->prop($row, 'seat_num', 0);
                $userId = (int) $this->prop($row, 'user_id', 0);
                $isDuplicate = false;

                if ($seatNum > 0) {
                    if (isset($seenSeats[$seatNum])) $isDuplicate = true;
                    else $seenSeats[$seatNum] = true;
                }

                if ($userId > 0) {
                    if (isset($seenUsers[$userId])) $isDuplicate = true;
                    else $seenUsers[$userId] = true;
                }

                if ($isDuplicate && $rowId > 0) {
                    $duplicateIds[] = $rowId;
                }
            }

            if (!empty($duplicateIds) && $this->columnExists('party_room_seats', 'id')) {
                $this->markSeatRowsInactive(
                    DB::table('party_room_seats')->whereIn('id', $duplicateIds)
                );
            }
        } catch (Throwable $e) {
            // Never break room loading because of cleanup on a legacy schema.
        }
    }

    private function roomUpdatePayload(array $values = []): array
    {
        $payload = [];
        foreach ($values as $column => $value) {
            if ($this->columnExists('party_rooms', $column)) {
                $payload[$column] = $value;
            }
        }
        if ($this->columnExists('party_rooms', 'updated_at')) {
            $payload['updated_at'] = now();
        }
        return $payload;
    }

    /**
     * Party room comments/reactions table. Kept self-healing so shared-host
     * installs that missed the SQL patch still sync emoji/comment state.
     */
    private function ensurePartyRoomCommentsTable(): bool
    {
        try {
            if (!$this->tableExists('party_room_comments')) {
                Schema::create('party_room_comments', function (Blueprint $table) {
                    $table->bigIncrements('id');
                    $table->unsignedBigInteger('room_id');
                    $table->unsignedBigInteger('user_id')->nullable();
                    $table->string('name', 120)->nullable();
                    $table->string('text', 500);
                    $table->string('kind', 20)->default('chat');
                    $table->integer('seat_num')->nullable();
                    $table->string('reply_to_name', 120)->nullable();
                    $table->timestamps();
                    $table->index(['room_id', 'id']);
                    $table->index(['room_id', 'kind', 'created_at']);
                });
            }

            $missing = [];
            foreach ([
                'room_id'       => fn (Blueprint $t) => $t->unsignedBigInteger('room_id')->nullable()->index(),
                'user_id'       => fn (Blueprint $t) => $t->unsignedBigInteger('user_id')->nullable(),
                'name'          => fn (Blueprint $t) => $t->string('name', 120)->nullable(),
                'text'          => fn (Blueprint $t) => $t->string('text', 500)->nullable(),
                'kind'          => fn (Blueprint $t) => $t->string('kind', 20)->default('chat'),
                'seat_num'      => fn (Blueprint $t) => $t->integer('seat_num')->nullable(),
                'reply_to_name' => fn (Blueprint $t) => $t->string('reply_to_name', 120)->nullable(),
                'created_at'    => fn (Blueprint $t) => $t->timestamp('created_at')->nullable(),
                'updated_at'    => fn (Blueprint $t) => $t->timestamp('updated_at')->nullable(),
            ] as $column => $adder) {
                if (!$this->columnExists('party_room_comments', $column)) {
                    $missing[$column] = $adder;
                }
            }

            foreach ($missing as $adder) {
                Schema::table('party_room_comments', function (Blueprint $table) use ($adder) {
                    $adder($table);
                });
            }

            return true;
        } catch (Throwable $e) {
            return false;
        }
    }

    private function recentPartyChat(int $roomId): array
    {
        if (!$this->ensurePartyRoomCommentsTable()) return [];

        try {
            $rows = DB::table('party_room_comments')
                ->where('room_id', $roomId)
                ->where('kind', 'chat')
                ->orderByDesc('id')
                ->limit(50)
                ->get()
                ->reverse()
                ->values();

            return $rows->map(fn ($row) => [
                'id'          => (int) $row->id,
                'name'        => $row->name ?: 'Guest',
                'text'        => (string) ($row->text ?? ''),
                'replyToName' => $row->reply_to_name ?: null,
                'reply_to_name' => $row->reply_to_name ?: null,
                'kind'        => $row->kind ?: 'chat',
                'seatNum'     => $row->seat_num ? (int) $row->seat_num : null,
                'seat_num'    => $row->seat_num ? (int) $row->seat_num : null,
                'createdAt'   => $row->created_at ? strtotime($row->created_at) * 1000 : null,
            ])->all();
        } catch (Throwable $e) {
            return [];
        }
    }

    /** Latest live emoji per seat, derived from party_room_comments. */
    private function liveSeatReactions(int $roomId): array
    {
        if (!$this->ensurePartyRoomCommentsTable()) return [];

        try {
            $rows = DB::table('party_room_comments')
                ->where('room_id', $roomId)
                ->where('kind', 'emoji')
                ->whereNotNull('seat_num')
                ->where('created_at', '>=', now()->subSeconds(7))
                ->orderByDesc('id')
                ->limit(80)
                ->get();

            $map = [];
            foreach ($rows as $row) {
                $seatNum = (int) ($row->seat_num ?? 0);
                if ($seatNum <= 0 || isset($map[$seatNum])) continue;
                $map[$seatNum] = (string) ($row->text ?? '');
            }
            return $map;
        } catch (Throwable $e) {
            return [];
        }
    }

    private function roomThemeCode(object $room): ?string
    {
        $code = $this->prop($room, 'active_theme_code', $this->prop($room, 'room_theme'));
        if ($code) return (string) $code;

        $themeId = (int) $this->prop($room, 'active_theme_id', 0);
        if ($themeId > 0 && $this->tableExists('party_themes')) {
            $value = DB::table('party_themes')->where('id', $themeId)->value('code');
            return $value ? (string) $value : null;
        }
        return null;
    }

    private function shape(object $room): array
    {
        // Read requests must not remove anyone from a seat. Duplicates are
        // cleaned only during seat writes; here we only dedupe the response so
        // host + guest polling always render the same final owner per seat.

        // Always load a FRESH host row so hostAvatar cannot be stale on either side.
        $hostId = (int) $this->prop($room, 'host_id', 0);
        $host = ($hostId > 0 && $this->tableExists('users'))
            ? DB::table('users')->where('id', $hostId)->first()
            : null;

        // ---- Seats: dedupe by seat_num, keep only ACTIVE (left_at IS NULL) -----
        $rawSeats = collect();
        if ($this->tableExists('party_room_seats')) {
            $seatQuery = DB::table('party_room_seats')
                ->where('room_id', $this->prop($room, 'id'));
            if ($this->columnExists('party_room_seats', 'left_at')) {
                $seatQuery->whereNull('left_at');
            }
            if ($this->columnExists('party_room_seats', 'seat_num')) {
                $seatQuery->orderBy('seat_num');
            }
            if ($this->columnExists('party_room_seats', 'updated_at')) {
                $seatQuery->orderByDesc('updated_at');
            }
            if ($this->columnExists('party_room_seats', 'id')) {
                $seatQuery->orderByDesc('id');
            }
            $rawSeats = $seatQuery->get();
        }

        $roomId = (int) $this->prop($room, 'id', 0);
        $roomIdVal = $this->prop($room, 'id');
        $roomIds = array_values(array_filter(array_unique([(string)$roomIdVal, (string)(int)$roomIdVal])));

        // Per-receiver seat coins summary for this room (pre-calculated so each seat object has coins field)
        $seatCoinsMap = [];
        if ($this->tableExists('gift_transactions') && !empty($roomIds)) {
            try {
                $recExpr = $hostId > 0 ? "COALESCE(NULLIF(receiver_id, 0), {$hostId})" : "receiver_id";
                $seatCoinRows = DB::table('gift_transactions')
                    ->whereIn('room_type', ['party', 'party_room', 'partyRoom', 'partyroom'])
                    ->whereIn('room_id', $roomIds)
                    ->select(DB::raw("{$recExpr} as rec_id"), DB::raw('SUM(diamonds) as total_coins'))
                    ->groupBy(DB::raw($recExpr))
                    ->get();
                foreach ($seatCoinRows as $scr) {
                    $rId = (int) ($scr->rec_id ?? 0);
                    if ($rId > 0) {
                        $seatCoinsMap[$rId] = (int) $scr->total_coins;
                    }
                }
            } catch (Throwable $e) {
                $seatCoinsMap = [];
            }
        }

        // Batch-fetch equipped frames for host + all seat occupants (avoids N+1).
        $frameIds = [ $hostId ];
        foreach ($rawSeats as $seat) {
            $seatUserId = $this->prop($seat, 'user_id');
            if ($seatUserId) $frameIds[] = (int) $seatUserId;
        }
        $framesMap = $this->userFramesFor($frameIds);
        $hostFrame = $framesMap[$hostId] ?? null;
        $lockedSeats = $this->normalizeLockedSeats($this->prop($room, 'locked_seats', []));
        $liveReactions = $roomId > 0 ? $this->liveSeatReactions($roomId) : [];

        // Deduplicate: only ONE active row per seat_num AND per user_id.
        $seenSeatNums = [];
        $seenUserIds  = [];
        $seatsArr = [];
        foreach ($rawSeats as $seat) {
            $sn  = (int) $this->prop($seat, 'seat_num', 0);
            $uid = (int) ($this->prop($seat, 'user_id', 0) ?? 0);
            if ($sn <= 0) continue;
            if (isset($seenSeatNums[$sn])) continue;
            if ($uid > 0 && isset($seenUserIds[$uid])) continue;
            $seenSeatNums[$sn] = true;
            if ($uid > 0) $seenUserIds[$uid] = true;

            // Fresh avatar/name from users table so seat pic never goes stale.
            $u = ($uid > 0 && $this->tableExists('users'))
                ? DB::table('users')->where('id', $uid)->first()
                : null;

            $seatFrame = $uid > 0
                ? ($framesMap[$uid] ?? null)
                : null;

            $name   = $u->name ?? $this->prop($seat, 'occupant_name');
            $avatar = $this->prop($seat, 'occupant_avatar') ?: $this->pickAvatar($u);
            $muted  = (bool) $this->prop($seat, 'muted', false);
            $joined = $this->prop($seat, 'joined_at');
            $reactionEmoji = $liveReactions[$sn] ?? null;
            $userCoins = ($uid > 0 && isset($seatCoinsMap[$uid])) ? (int) $seatCoinsMap[$uid] : 0;

            // Emit BOTH camelCase and snake_case aliases so every code path
            // in the frontend (host + guest) can resolve seat data.
            $seatsArr[] = array_merge([
                'seatNum'        => $sn,
                'seat_num'       => $sn,
                'seat'           => $sn,
                'index'          => $sn,
                'userId'         => $uid > 0 ? $uid : null,
                'user_id'        => $uid > 0 ? $uid : null,
                'occupant'       => $name,
                'occupantName'   => $name,
                'occupant_name'  => $name,
                'name'           => $name,
                'icon'           => $avatar,
                'avatar'         => $avatar,
                'avatarUrl'      => $avatar,
                'avatar_url'     => $avatar,
                'occupant_avatar'=> $avatar,
                'muted'          => $muted,
                'isMuted'        => $muted,
                'joinedAt'       => $joined,
                'joined_at'      => $joined,
                'reactionEmoji'  => $reactionEmoji,
                'reaction_emoji' => $reactionEmoji,
                'isHost'         => ($uid > 0 && $uid === $hostId),
                'is_host'        => ($uid > 0 && $uid === $hostId),
                'coins'          => $userCoins,
                'r_coins'        => $userCoins,
                'received_coins' => $userCoins,
            ], $this->frameShape($seatFrame, $u));
        }
        usort($seatsArr, fn ($a, $b) => $a['seatNum'] <=> $b['seatNum']);

        // ---- Recent gift events (last 12 hours) for banner + wallet refresh ------
        $recentGiftEvents = [];
        $giftersSummary = [];
        if ($this->tableExists('gift_transactions')) {
            try {
                $avatarCols = $this->userAvatarColumns();

                $selects = [
                    'g.id',
                    'g.gift_name',
                    'g.gift_icon',
                    'g.diamonds',
                    'g.r_coins',
                    'g.sender_id',
                    'g.receiver_id',
                    'g.created_at',
                    'sender.name as sender_name',
                    'receiver.name as receiver_name',
                ];
                if (!empty($avatarCols)) {
                    $expr = 'COALESCE(' . implode(',', array_map(
                        fn ($c) => "NULLIF(sender.`{$c}`, '')", $avatarCols
                    )) . ')';
                    $selects[] = DB::raw("{$expr} as sender_avatar");
                } else {
                    $selects[] = DB::raw('NULL as sender_avatar');
                }

                $roomIdVal = $this->prop($room, 'id');
                $roomIds = array_values(array_filter(array_unique([(string)$roomIdVal, (string)(int)$roomIdVal])));

                $rows = DB::table('gift_transactions as g')
                    ->leftJoin('users as sender',   'sender.id',   '=', 'g.sender_id')
                    ->leftJoin('users as receiver', 'receiver.id', '=', 'g.receiver_id')
                    ->whereIn('g.room_type', ['party', 'party_room', 'partyRoom'])
                    ->whereIn('g.room_id', $roomIds)
                    ->where('g.created_at', '>=', now()->subHours(12))
                    ->orderByDesc('g.id')
                    ->limit(50)
                    ->select($selects)
                    ->get();

                foreach ($rows->reverse()->values() as $r) {
                    $recentGiftEvents[] = [
                        'id'           => (int) $r->id,
                        'kind'         => 'gift',
                        'giverName'    => $r->sender_name ?? 'Guest',
                        'giverAvatar'  => $r->sender_avatar ?? null,
                        'giftIcon'     => $r->gift_icon ?? '🎁',
                        'giftImage'    => null,
                        'giftName'     => $r->gift_name ?? 'Gift',
                        'coins'        => (int) $r->diamonds,
                        'receiverName' => $r->receiver_name,
                        'receiverId'   => $r->receiver_id ? (int) $r->receiver_id : null,
                        'createdAt'    => $r->created_at ? strtotime($r->created_at) * 1000 : null,
                    ];
                }

                // Cumulative Gifters Summary for this party room (all-time/session)
                $avatarExpr = !empty($avatarCols)
                    ? 'COALESCE(' . implode(',', array_map(fn ($c) => "NULLIF(sender.`{$c}`, '')", $avatarCols)) . ')'
                    : 'NULL';

                $summaryRows = DB::table('gift_transactions as g')
                    ->leftJoin('users as sender', 'sender.id', '=', 'g.sender_id')
                    ->whereIn('g.room_type', ['party', 'party_room', 'partyRoom'])
                    ->whereIn('g.room_id', $roomIds)
                    ->select([
                        'g.sender_id',
                        'sender.name as name',
                        DB::raw("{$avatarExpr} as avatar"),
                        DB::raw('SUM(g.diamonds) as totalSpent'),
                    ])
                    ->groupBy('g.sender_id', 'sender.name', DB::raw("{$avatarExpr}"))
                    ->orderByDesc('totalSpent')
                    ->get();

                foreach ($summaryRows as $sr) {
                    if (!empty($sr->name)) {
                        $giftersSummary[] = [
                            'name'       => (string) $sr->name,
                            'avatar'     => $sr->avatar ?? null,
                            'totalSpent' => (int) $sr->totalSpent,
                        ];
                    }
                }

            } catch (Throwable $e) {
                $recentGiftEvents = [];
                $giftersSummary = [];
            }
        }

        $calcTotalCoins = 0;
        if ($this->tableExists('gift_transactions') && !empty($roomIds)) {
            try {
                $calcTotalCoins = (int) DB::table('gift_transactions')
                    ->whereIn('room_type', ['party', 'party_room', 'partyRoom', 'partyroom'])
                    ->whereIn('room_id', $roomIds)
                    ->sum('diamonds');
            } catch (Throwable $e) {
                $calcTotalCoins = 0;
            }
        }

        $totalDiamondsVal = max((int) $this->prop($room, 'total_diamonds', 0), $calcTotalCoins);

        $presence = $roomId > 0 ? $this->roomPresence($roomId) : [];

        return array_merge([
            'id'               => (int) $room->id,
            'hostId'           => $hostId,
            'host_id'          => $hostId,
            'hostName'         => $host->name ?? null,
            'hostAvatar'       => $this->pickAvatar($host),
            'hostFrame'        => $hostFrame['code'] ?? ($hostFrame['frameId'] ?? ($host->avatar_frame ?? null)),
            'hostFrameImg'     => $hostFrame['imageUrl'] ?? null,
            'hostEntryEffect'  => $host->entry_effect ?? null,
            'title'            => $this->prop($room, 'title', 'Party Room'),
            'privacy'          => (string) ($this->prop($room, 'privacy', 'public') ?: 'public'),
            'isPrivate'        => ((string) $this->prop($room, 'privacy', 'public')) === 'private',
            'maxGuestSeats'    => (int) $this->prop($room, 'max_guest_seats', 10),
            'max_guest_seats'  => (int) $this->prop($room, 'max_guest_seats', 10),
            'live'             => (bool) $this->prop($room, 'live', true),
            'viewerCount'      => max(1, count($seatsArr), count($presence)),
            'viewers'          => $presence,
            'totalDiamonds'    => $totalDiamondsVal,
            'total_diamonds'   => $totalDiamondsVal,
            'totalCoins'       => $totalDiamondsVal,
            'total_coins'      => $totalDiamondsVal,
            'seatCoinsMap'     => $seatCoinsMap,
            'seat_coins_map'   => $seatCoinsMap,
            'startedAt'        => $this->prop($room, 'started_at'),
            'endedAt'          => $this->prop($room, 'ended_at'),
            'updatedAt'        => $this->prop($room, 'updated_at'),
            'roomTheme'        => $this->roomThemeCode($room),
            'roomThemeImg'     => $this->prop($room, 'active_theme_img'),
            'seats'            => $seatsArr,
            'lockedSeats'      => $lockedSeats,
            'locked_seats'     => $lockedSeats,
            'recentGiftEvents' => $recentGiftEvents,
            'giftersSummary'   => $giftersSummary,
            'top_gifters'      => $giftersSummary,
            'recentChat'       => $roomId > 0 ? $this->recentPartyChat($roomId) : [],
        ]);
    }

    private function closeStaleRooms(): void
    {
        if (!$this->tableExists('party_rooms')) return;
        if (!$this->columnExists('party_rooms', 'live')) return;

        try {
            $update = ['live' => false];
            if ($this->columnExists('party_rooms', 'ended_at')) {
                $update['ended_at'] = now();
            }
            if ($this->columnExists('party_rooms', 'updated_at')) {
                $update['updated_at'] = now();
            }

            $query = DB::table('party_rooms')->where('live', true);
            if ($this->columnExists('party_rooms', 'updated_at')) {
                $query->where('updated_at', '<', now()->subMinutes(15));
            }

            $query->update($update);
        } catch (Throwable $e) {
            // Silent — listing must not fail due to cleanup.
        }
    }

    private function safeShape(object $room): ?array
    {
        try {
            return $this->shape($room);
        } catch (Throwable $e) {
            return [
                'id'               => (int) $this->prop($room, 'id', 0),
                'hostId'           => (int) $this->prop($room, 'host_id', 0),
                'hostName'         => null,
                'hostAvatar'       => null,
                'hostFrame'        => null,
                'hostFrameImg'     => null,
                'title'            => $this->prop($room, 'title', 'Party Room'),
                'privacy'          => (string) ($this->prop($room, 'privacy', 'public') ?: 'public'),
                'isPrivate'        => ((string) $this->prop($room, 'privacy', 'public')) === 'private',
                'maxGuestSeats'    => (int) $this->prop($room, 'max_guest_seats', 10),
                'live'             => (bool) $this->prop($room, 'live', true),
                'viewerCount'      => (int) $this->prop($room, 'viewer_count', 0),
                'totalDiamonds'    => (int) $this->prop($room, 'total_diamonds', 0),
                'startedAt'        => $this->prop($room, 'started_at'),
                'endedAt'          => $this->prop($room, 'ended_at'),
                'updatedAt'        => $this->prop($room, 'updated_at'),
                'seats'            => [],
                'lockedSeats'      => $this->normalizeLockedSeats($this->prop($room, 'locked_seats', [])),
                'locked_seats'     => $this->normalizeLockedSeats($this->prop($room, 'locked_seats', [])),
                'recentGiftEvents' => [],
                'recentChat'       => [],
            ];
        }
    }

    public function index(Request $request)
    {
        if (!$this->tableExists('party_rooms')) {
            return ['data' => []];
        }

        $query = DB::table('party_rooms');
        if ($this->columnExists('party_rooms', 'live')) {
            $query->where('live', true);
        }
        if ($this->columnExists('party_rooms', 'id')) {
            $query->orderByDesc('id');
        }

        $rows = $query->limit($request->boolean('summary') ? 50 : 100)->get();

        if ($request->boolean('summary')) {
            $hostIds = $rows->pluck('host_id')->map(fn ($id) => (int) $id)->filter()->unique()->values();
            $hosts = $hostIds->isEmpty() || !$this->tableExists('users')
                ? collect()
                : DB::table('users')->whereIn('id', $hostIds->all())->get()->keyBy('id');
            $frames = $this->userFramesFor($hostIds->all());

            return ['data' => $rows->map(function ($room) use ($hosts, $frames) {
                $hostId = (int) $this->prop($room, 'host_id', 0);
                $host = $hosts->get($hostId);
                $frame = $frames[$hostId] ?? null;
                $privacy = (string) ($this->prop($room, 'privacy', 'public') ?: 'public');
                return array_merge([
                    'id' => (int) $this->prop($room, 'id', 0),
                    'hostId' => $hostId,
                    'host_id' => $hostId,
                    'hostName' => $host->name ?? null,
                    'hostAvatar' => $this->pickAvatar($host),
                    'hostFrame' => $frame['code'] ?? ($frame['frameId'] ?? ($host->avatar_frame ?? null)),
                    'hostFrameImg' => $frame['imageUrl'] ?? null,
                    'title' => $this->prop($room, 'title', 'Party Room'),
                    'privacy' => $privacy,
                    'isPrivate' => $privacy === 'private',
                    'maxGuestSeats' => (int) $this->prop($room, 'max_guest_seats', 10),
                    'live' => (bool) $this->prop($room, 'live', true),
                    'viewerCount' => (int) $this->prop($room, 'viewer_count', 0),
                    'totalDiamonds' => (int) $this->prop($room, 'total_diamonds', 0),
                    'startedAt' => $this->prop($room, 'started_at'),
                    'endedAt' => $this->prop($room, 'ended_at'),
                    'updatedAt' => $this->prop($room, 'updated_at'),
                    'roomTheme' => $this->prop($room, 'room_theme', $this->prop($room, 'active_theme_code')),
                    'seats' => [],
                    'lockedSeats' => $this->normalizeLockedSeats($this->prop($room, 'locked_seats', [])),
                ], $this->frameShape($frame, $host));
            })->values()];
        }

        return ['data' => $rows->map(fn ($room) => $this->safeShape($room))->filter()->values()];
    }

    public function show(Request $request, int $id)
    {
        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');

        // Keep alive on any authenticated poll (host OR guest).
        if ($this->prop($room, 'live', true)) {
            $touchPayload = $this->roomUpdatePayload();
            if (!empty($touchPayload)) {
                DB::table('party_rooms')->where('id', $id)->update($touchPayload);
            }
            $room = DB::table('party_rooms')->where('id', $id)->first();
        }

        return ['data' => $this->shape($room)];
    }

    public function start(Request $request)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $data = $request->validate([
            'title'         => 'nullable|string|max:200',
            'maxGuestSeats' => 'nullable|integer|min:5|max:30',
            'privacy'       => 'nullable|in:public,private',
        ]);

        // Close any previous live rooms of this host.
        $previousClosePayload = $this->roomUpdatePayload(['live' => false, 'ended_at' => now()]);
        if (!empty($previousClosePayload)) {
            $previousRooms = DB::table('party_rooms')->where('host_id', $user->id);
            if ($this->columnExists('party_rooms', 'live')) {
                $previousRooms->where('live', true);
            }
            $previousRooms->update($previousClosePayload);
        }

        $createPayload = [];
        foreach ([
            'host_id'         => $user->id,
            'title'           => $data['title'] ?? "{$user->name}'s Party Room",
            'max_guest_seats' => (int) ($data['maxGuestSeats'] ?? 10),
            'privacy'         => ($data['privacy'] ?? 'public') === 'private' ? 'private' : 'public',
            'live'            => true,
            'viewer_count'    => 1,
            'started_at'      => now(),
            'created_at'      => now(),
            'updated_at'      => now(),
        ] as $column => $value) {
            if ($this->columnExists('party_rooms', $column)) {
                $createPayload[$column] = $value;
            }
        }

        $roomId = DB::table('party_rooms')->insertGetId($createPayload);
        $this->touchPresence($roomId, $user);

        // NOTE: Host is NOT auto-seated. New design: crown seat stays empty until
        // the host taps to sit. Host leaving the crown seat ends the room.

        $room = DB::table('party_rooms')->where('id', $roomId)->first();
        return response()->json(['data' => $this->shape($room)], 201);
    }

    public function join(Request $request, int $id)
    {
        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');
        if (!$room->live) abort(410, 'Party room is closed');
        $user = $request->user();
        $presence = $user ? $this->touchPresence($id, $user) : $this->roomPresence($id);

        $count = $this->tableExists('party_room_seats')
            ? $this->activeSeatQuery($id)->count()
            : 0;

        $viewerPayload = $this->roomUpdatePayload([
            'viewer_count' => max(1, $count, count($presence)),
        ]);
        if (!empty($viewerPayload)) {
            DB::table('party_rooms')->where('id', $id)->update($viewerPayload);
        }

        $room = DB::table('party_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($room)];
    }

    /**
     * Keep an active audio-board session and the caller's occupied seat fresh.
     * Only the room host may revive a room that was transiently marked closed;
     * guests can never reopen an explicitly ended room.
     */
    public function heartbeat(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');

        $isHost = (int) $this->prop($room, 'host_id', 0) === (int) $user->id;
        $revive = $request->boolean('revive') && $isHost;
        $roomValues = [];
        if ($revive) {
            $roomValues['live'] = true;
            $roomValues['ended_at'] = null;
        }
        $roomPayload = $this->roomUpdatePayload($roomValues);
        if (!empty($roomPayload)) {
            DB::table('party_rooms')->where('id', $id)->update($roomPayload);
        }

        $seatActive = false;
        if ($this->tableExists('party_room_seats')) {
            $seatQuery = $this->activeSeatQuery($id)->where('user_id', $user->id);
            $seatActive = $seatQuery->exists();
            $seatUpdate = $this->seatTimestampUpdate();
            if ($seatActive && !empty($seatUpdate)) {
                $seatQuery->update($seatUpdate);
            }
        }

        $presence = $this->touchPresence($id, $user);
        if ($this->columnExists('party_rooms', 'viewer_count')) {
            DB::table('party_rooms')->where('id', $id)->update(['viewer_count' => max(1, count($presence))]);
        }

        $freshRoom = DB::table('party_rooms')->where('id', $id)->first();
        return [
            'ok' => true,
            'live' => (bool) $this->prop($freshRoom, 'live', true),
            'seatActive' => $seatActive,
            'viewerCount' => count($presence),
            'viewers' => $presence,
            'updatedAt' => $this->prop($freshRoom, 'updated_at'),
        ];
    }

    public function setTheme(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');
        if ((int) $this->prop($room, 'host_id', 0) !== (int) $user->id && !($user->is_admin ?? false)) {
            abort(403, 'Only the room host can change the theme');
        }

        $data = $request->validate(['theme' => 'nullable|string|max:64']);
        $code = isset($data['theme']) && $data['theme'] !== '' ? $data['theme'] : null;
        $theme = null;
        if ($code && $this->tableExists('party_themes')) {
            $theme = DB::table('party_themes')->where('code', $code)->where('active', true)->first();
            if (!$theme) abort(404, 'Theme not found');
        }

        $values = [];
        if ($this->columnExists('party_rooms', 'active_theme_id')) {
            $values['active_theme_id'] = $theme->id ?? null;
        }
        if ($this->columnExists('party_rooms', 'active_theme_img')) {
            $values['active_theme_img'] = $theme->image_url ?? null;
        }
        if ($this->columnExists('party_rooms', 'active_theme_code')) {
            $values['active_theme_code'] = $theme->code ?? null;
        }
        if ($this->columnExists('party_rooms', 'room_theme')) {
            $values['room_theme'] = $theme->code ?? null;
        }
        $payload = $this->roomUpdatePayload($values);
        if (!empty($payload)) {
            DB::table('party_rooms')->where('id', $id)->update($payload);
        }

        $fresh = DB::table('party_rooms')->where('id', $id)->first();
        return ['ok' => true, 'theme' => $theme->code ?? null, 'data' => $this->shape($fresh)];
    }

    public function joinSeat(Request $request, int $id, int $seatNum)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $data = $request->validate([
            'avatarIcon' => 'nullable|string|max:512',
        ]);

        // Race-safe seat claim: first use a DB named lock when available, then
        // lock the room row so concurrent joins serialize inside one section.
        $seatWriteLock = $this->acquireSeatWriteLock($id);
        try {
            DB::transaction(function () use ($id, $seatNum, $user, $data) {
                $room = DB::table('party_rooms')->where('id', $id)->lockForUpdate()->first();
                if (!$room) abort(404, 'Party room not found');
                if (!$room->live) abort(410, 'Party room is closed');

                $maxSeat = (int) $room->max_guest_seats + 1; // +1 for host/crown seat
                if ($seatNum < 1 || $seatNum > $maxSeat) {
                    abort(422, 'Invalid seat number');
                }

                $lockedSeats = $this->normalizeLockedSeats($this->prop($room, 'locked_seats', []));
                if (in_array($seatNum - 1, $lockedSeats, true)) {
                    // Host bypass, plus accepted-join-request bypass for private rooms.
                    $isHost = (int) $room->host_id === (int) $user->id;
                    $accepted = false;
                    if (!$isHost && Schema::hasTable('party_join_requests')) {
                        $accepted = DB::table('party_join_requests')
                            ->where('room_id', $id)
                            ->where('guest_id', $user->id)
                            ->where('status', 'accepted')
                            ->exists();
                    }
                    if (!$isHost && !$accepted) {
                        abort(423, 'Seat is locked by the host');
                    }
                }

                // Crown seat (host seat) is reserved for the host only.
                if ($seatNum === $this->hostSeatNum()
                    && (int) $room->host_id !== (int) $user->id
                    && !($user->is_admin ?? false)) {
                    abort(403, 'Only the host can take the host seat');
                }

                if (!$this->tableExists('party_room_seats')) {
                    abort(500, 'Party room seats table is missing');
                }

                // Lock all active seats of this room to prevent races.
                $activeSeats = $this->activeSeatQuery($id)
                    ->lockForUpdate()
                    ->get();

                // Before checking conflicts, collapse impossible duplicate
                // active rows left by older controller versions. No time-based
                // stale eviction here — a real seated guest must NEVER be
                // kicked just because updated_at/joined_at is old.
                $this->cleanupDuplicateActiveSeats($id);

                $activeSeats = $this->activeSeatQuery($id)
                    ->lockForUpdate()
                    ->get();

                // FIX (Batch 1): re-entrant fast path — যদি এই user
                // এই seat এই এখনই active থাকে, কিছু না করেই success return
                // করি। পুরনো code duplicate cleanup + upsert চালাত, যেটা
                // rare race এ user-এর নিজের row কে-ই stale ভেবে delete
                // করে ফেলত এবং guest ১ সেকেন্ডেই "kicked" হয়ে যেত।
                foreach ($activeSeats as $s) {
                    if ((int) $s->seat_num === $seatNum
                        && (int) $s->user_id === (int) $user->id) {
                        return; // already seated, no-op
                    }
                }

                // If the requested seat is already held by another active user,
                // reject the join. This is what prevents two guests booking the
                // same seat across host + guest views.
                foreach ($activeSeats as $s) {
                    if ((int) $s->seat_num !== $seatNum) continue;
                    if ((int) $s->user_id === (int) $user->id) continue;
                    abort(409, 'Seat already occupied');
                }

                // Vacate any OTHER active seat this user already holds.
                $this->markSeatRowsInactive(
                    $this->activeSeatQuery($id)
                        ->where('user_id', $user->id)
                        ->where('seat_num', '!=', $seatNum)
                );

                $this->upsertSeat($id, $seatNum, $user, $data['avatarIcon'] ?? null);
            });


        } catch (Throwable $e) {
            // Re-throw HTTP aborts as-is; wrap unexpected DB errors as 409.
            if (method_exists($e, 'getStatusCode')) throw $e;
            abort(409, 'Seat conflict, please try again');
        } finally {
            $this->releaseSeatWriteLock($seatWriteLock);
        }

        $this->syncViewerCount($id);
        $room = DB::table('party_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($room)];
    }

    public function leaveSeat(Request $request, int $id, int $seatNum)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');

        if (!$this->tableExists('party_room_seats')) abort(404, 'Party room seats table is missing');

        $query = $this->activeSeatQuery($id)->where('seat_num', $seatNum);

        $isHost = (int) $room->host_id === (int) $user->id;
        if (!$isHost && !($user->is_admin ?? false)) {
            $query->where('user_id', $user->id);
        }

        $this->markSeatRowsInactive($query);

        // Host leaving the crown seat CLOSES the entire room.
        if ($isHost && $seatNum === $this->hostSeatNum()) {
            $closePayload = $this->roomUpdatePayload(['live' => false, 'ended_at' => now()]);
            if (!empty($closePayload)) {
                DB::table('party_rooms')->where('id', $id)->update($closePayload);
            }
            $this->markSeatRowsInactive($this->activeSeatQuery($id));
            return ['data' => $this->shape(DB::table('party_rooms')->where('id', $id)->first()), 'closed' => true];
        }

        $this->syncViewerCount($id);
        $room = DB::table('party_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($room)];
    }

    public function muteSeat(Request $request, int $id, int $seatNum)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');
        if ((int) $room->host_id !== (int) $user->id && !($user->is_admin ?? false)) abort(403);

        $data = $request->validate([
            'muted' => 'required|boolean',
        ]);

        if (Schema::hasColumn('party_room_seats', 'muted')) {
            $this->activeSeatQuery($id)
                ->where('seat_num', $seatNum)
                ->update(array_merge(['muted' => (bool) $data['muted']], $this->seatTimestampUpdate()));
        }

        $room = DB::table('party_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($room)];
    }

    /**
     * POST /api/party-rooms/{id}/seats/{seatNum}/react
     * Broadcast a short-lived seat emoji so every polling client renders it.
     */
    public function reactSeat(Request $request, int $id, int $seatNum)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');
        if (!$this->prop($room, 'live', true)) abort(410, 'Party room is closed');

        $data = $request->validate([
            'emoji' => 'required|string|max:20',
        ]);

        $maxSeat = (int) $this->prop($room, 'max_guest_seats', 10) + 1;
        if ($seatNum < 1 || $seatNum > $maxSeat) abort(422, 'Invalid seat number');

        $isHost = (int) $this->prop($room, 'host_id', 0) === (int) $user->id;
        if (!$isHost && !($user->is_admin ?? false)) {
            $ownsSeat = $this->tableExists('party_room_seats')
                ? $this->activeSeatQuery($id)
                    ->where('seat_num', $seatNum)
                    ->where('user_id', $user->id)
                    ->exists()
                : false;
            if (!$ownsSeat) abort(403, 'You can only react from your own seat');
        }

        if ($this->ensurePartyRoomCommentsTable()) {
            DB::table('party_room_comments')->insert([
                'room_id'    => $id,
                'user_id'    => $user->id,
                'name'       => $user->name ?? 'Guest',
                'text'       => $data['emoji'],
                'kind'       => 'emoji',
                'seat_num'   => $seatNum,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $room = DB::table('party_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($room)];
    }

    /**
     * POST /api/party-rooms/{id}/chat
     * Store party room comments so all users receive them through show()/polling.
     */
    public function postChat(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');
        if (!$this->prop($room, 'live', true)) abort(410, 'Party room is closed');

        $data = $request->validate([
            'text'        => 'required|string|max:500',
            'replyToName' => 'nullable|string|max:120',
        ]);

        $seatNum = null;
        if ($this->tableExists('party_room_seats')) {
            $seat = $this->activeSeatQuery($id)
                ->where('user_id', $user->id)
                ->when($this->columnExists('party_room_seats', 'updated_at'), fn ($q) => $q->orderByDesc('updated_at'))
                ->when($this->columnExists('party_room_seats', 'id'), fn ($q) => $q->orderByDesc('id'))
                ->first();
            $seatNum = $seat ? (int) $this->prop($seat, 'seat_num', 0) : null;
        }

        if (!$seatNum && (int) $this->prop($room, 'host_id', 0) === (int) $user->id) {
            $seatNum = $this->hostSeatNum();
        }

        if ($this->ensurePartyRoomCommentsTable()) {
            DB::table('party_room_comments')->insert([
                'room_id'       => $id,
                'user_id'       => $user->id,
                'name'          => $user->name ?? 'Guest',
                'text'          => trim($data['text']),
                'kind'          => 'chat',
                'seat_num'      => $seatNum ?: null,
                'reply_to_name' => $data['replyToName'] ?? null,
                'created_at'    => now(),
                'updated_at'    => now(),
            ]);
        }

        $room = DB::table('party_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($room)];
    }

    public function end(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');
        if ((int) $room->host_id !== (int) $user->id && !($user->is_admin ?? false)) abort(403);

        $closePayload = $this->roomUpdatePayload(['live' => false, 'ended_at' => now()]);
        if (!empty($closePayload)) {
            DB::table('party_rooms')->where('id', $id)->update($closePayload);
        }
        if ($this->tableExists('party_room_seats')) {
            $this->markSeatRowsInactive($this->activeSeatQuery($id));
        }
        Cache::forget("party_room_presence_{$id}");

        return ['ok' => true];
    }

    /**
     * Update mutable room settings (maxGuestSeats / title).
     *   POST /api/party-rooms/{id}/settings
     */
    public function updateSettings(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $room = DB::table('party_rooms')->where('id', $id)->first();
        if (!$room) abort(404, 'Party room not found');
        if ((int) $room->host_id !== (int) $user->id && !($user->is_admin ?? false)) {
            abort(403, 'Only the host can change room settings');
        }

        $data = $request->validate([
            'maxGuestSeats'   => 'nullable|integer|min:5|max:30',
            'max_guest_seats' => 'nullable|integer|min:5|max:30',
            'lockedSeats'     => 'nullable|array',
            'lockedSeats.*'   => 'integer|min:1|max:30',
            'locked_seats'    => 'nullable|array',
            'locked_seats.*'  => 'integer|min:1|max:30',
            'title'           => 'nullable|string|max:200',
        ]);

        $update = $this->roomUpdatePayload();

        $newMax = $data['maxGuestSeats'] ?? $data['max_guest_seats'] ?? null;
        if ($newMax !== null && $this->columnExists('party_rooms', 'max_guest_seats')) {
            $update['max_guest_seats'] = (int) $newMax;
        }
        if (!empty($data['title']) && $this->columnExists('party_rooms', 'title')) {
            $update['title'] = $data['title'];
        }
        $lockedSeats = $data['lockedSeats'] ?? $data['locked_seats'] ?? null;
        if ($lockedSeats !== null && $this->columnExists('party_rooms', 'locked_seats')) {
            $update['locked_seats'] = json_encode($this->normalizeLockedSeats($lockedSeats));
        }

        if (!empty($update)) {
            DB::table('party_rooms')->where('id', $id)->update($update);
        }

        $room = DB::table('party_rooms')->where('id', $id)->first();
        return ['data' => $this->shape($room)];
    }

    /**
     * Bullet-proof seat writer — always run INSIDE a transaction:
     *   1) mark ALL existing active rows for (room, seat) as left
     *   2) mark ALL existing active rows for (room, user)  as left
     *   3) INSERT a fresh active row for the joining user
     */
    private function upsertSeat(int $roomId, int $seatNum, object $user, ?string $avatarIcon = null): void
    {
        $this->markSeatRowsInactive(
            $this->activeSeatQuery($roomId)
                ->where(function ($q) use ($seatNum, $user) {
                    $q->where('seat_num', $seatNum)
                      ->orWhere('user_id', $user->id);
                })
        );

        $payload = [];
        foreach ([
            'room_id'         => $roomId,
            'seat_num'        => $seatNum,
            'user_id'         => $user->id,
            'occupant_name'   => $user->name,
            'occupant_avatar' => $avatarIcon ?: $this->pickAvatar($user),
            'joined_at'       => now(),
            'left_at'         => null,
            'created_at'      => now(),
            'updated_at'      => now(),
        ] as $column => $value) {
            if ($this->columnExists('party_room_seats', $column)) {
                $payload[$column] = $value;
            }
        }
        if (Schema::hasColumn('party_room_seats', 'muted')) {
            $payload['muted'] = false;
        }

        $table = DB::table('party_room_seats');
        $targetRow = $table->where('room_id', $roomId)->where('seat_num', $seatNum)->first();
        $userRow = $targetRow ?: DB::table('party_room_seats')
            ->where('room_id', $roomId)->where('user_id', $user->id)->first();

        if ($userRow) {
            $update = $payload;
            unset($update['room_id'], $update['created_at']);
            $rowQuery = DB::table('party_room_seats');
            if ($this->columnExists('party_room_seats', 'id') && $this->prop($userRow, 'id')) {
                $rowQuery->where('id', $this->prop($userRow, 'id'));
            } else {
                $rowQuery->where('room_id', $roomId)
                    ->where('seat_num', $this->prop($userRow, 'seat_num', $seatNum));
            }
            $rowQuery->update($update);
        } else {
            DB::table('party_room_seats')->insert($payload);
        }

        $confirmed = $this->activeSeatQuery($roomId)
            ->where('seat_num', $seatNum)
            ->where('user_id', $user->id)
            ->exists();
        if (!$confirmed) {
            throw new \RuntimeException('Seat write was not persisted');
        }
    }

    private function syncViewerCount(int $roomId): void
    {
        $count = $this->tableExists('party_room_seats')
            ? $this->activeSeatQuery($roomId)->count()
            : 0;
        $payload = $this->roomUpdatePayload(['viewer_count' => $count]);
        if (!empty($payload)) {
            DB::table('party_rooms')->where('id', $roomId)->update($payload);
        }
    }
}

// Last Updated: 2026-08-06 00:07:00 UTC | Fix party room seat coins and total coins dynamic aggregation from gift_transactions
