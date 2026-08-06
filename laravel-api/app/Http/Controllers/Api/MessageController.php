<?php

namespace App\Http\Controllers\Api;

use App\Events\NewMessage;
use App\Events\NewRoomMessage;
use App\Http\Controllers\Controller;
use App\Services\FcmService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MessageController extends Controller
{
    private function convKey(int $a, int $b): string
    {
        return $a < $b ? "{$a}:{$b}" : "{$b}:{$a}";
    }

    private function shape(object $m): array
    {
        return [
            'id'         => (int) $m->id,
            'senderId'   => (int) $m->sender_id,
            'receiverId' => (int) $m->receiver_id,
            'body'       => $m->body,
            'kind'       => $m->kind,
            'readAt'     => $m->read_at,
            'createdAt'  => $m->created_at,
        ];
    }

    // List conversations of current user (latest message per peer)
    public function conversations(Request $request)
    {
        $uid = $request->user()->id;
        $rows = DB::select("
            SELECT m.* FROM messages m
            INNER JOIN (
                SELECT conversation_key, MAX(id) AS mid
                FROM messages
                WHERE sender_id = ? OR receiver_id = ?
                GROUP BY conversation_key
            ) x ON x.mid = m.id
            ORDER BY m.id DESC
            LIMIT 200
        ", [$uid, $uid]);

        $data = [];
        foreach ($rows as $m) {
            $peerId = $m->sender_id === $uid ? $m->receiver_id : $m->sender_id;
            $peer   = DB::table('users')->where('id', $peerId)->first();
            $unread = DB::table('messages')
                ->where('conversation_key', $m->conversation_key)
                ->where('receiver_id', $uid)
                ->whereNull('read_at')
                ->count();
            $data[] = [
                'peerId'      => (int) $peerId,
                'peerName'    => $peer->name ?? null,
                'peerAvatar'  => $peer->avatar ?? null,
                'lastMessage' => $this->shape($m),
                'unreadCount' => (int) $unread,
            ];
        }
        return ['data' => $data];
    }

    // Thread with a peer
    public function thread(Request $request, int $peerId)
    {
        $uid  = $request->user()->id;
        $key  = $this->convKey($uid, $peerId);
        $rows = DB::table('messages')->where('conversation_key', $key)
            ->orderByDesc('id')->limit(200)->get();

        // Mark received as read
        DB::table('messages')->where('conversation_key', $key)
            ->where('receiver_id', $uid)->whereNull('read_at')
            ->update(['read_at' => now()]);

        return ['data' => $rows->reverse()->values()->map(fn ($m) => $this->shape($m))];
    }

    public function send(Request $request)
    {
        $uid  = $request->user()->id;
        $data = $request->validate([
            'receiverId' => 'required|integer',
            'body'       => 'required|string|max:2000',
            'kind'       => 'nullable|string|in:text,image,gift,system',
        ]);
        if ($data['receiverId'] === $uid) abort(422, 'Cannot message self');

        $peer = DB::table('users')->where('id', $data['receiverId'])->first();
        if (!$peer) abort(404, 'User not found');

        $id = DB::table('messages')->insertGetId([
            'conversation_key' => $this->convKey($uid, $data['receiverId']),
            'sender_id'        => $uid,
            'receiver_id'      => $data['receiverId'],
            'body'             => $data['body'],
            'kind'             => $data['kind'] ?? 'text',
            'created_at'       => now(),
            'updated_at'       => now(),
        ]);

        $row     = DB::table('messages')->where('id', $id)->first();
        $shaped  = $this->shape($row);

        // Realtime broadcast
        try { event(new NewMessage($uid, (int) $data['receiverId'], $shaped)); } catch (\Throwable $e) {}

        // Notification + push
        DB::table('notifications')->insert([
            'user_id'    => $data['receiverId'],
            'type'       => 'message',
            'title'      => 'New message',
            'body'       => ($request->user()->name ?? 'Someone') . ': ' . mb_strimwidth($data['body'], 0, 80, '…'),
            'data'       => json_encode(['senderId' => $uid, 'messageId' => $id]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        try {
            FcmService::sendToUser($data['receiverId'], ($request->user()->name ?? 'New message'),
                mb_strimwidth($data['body'], 0, 120, '…'),
                ['type' => 'message', 'senderId' => $uid, 'messageId' => $id]);
        } catch (\Throwable $e) {}

        return ['data' => $shaped];
    }

    public function markRead(Request $request, int $peerId)
    {
        $uid = $request->user()->id;
        $key = $this->convKey($uid, $peerId);
        DB::table('messages')->where('conversation_key', $key)
            ->where('receiver_id', $uid)->whereNull('read_at')
            ->update(['read_at' => now()]);
        return ['ok' => true];
    }

    public function unreadCount(Request $request)
    {
        $uid = $request->user()->id;
        $n = DB::table('messages')->where('receiver_id', $uid)->whereNull('read_at')->count();
        return ['count' => (int) $n];
    }

    // ===== Room chat =====
    public function roomList(Request $request, int $roomId)
    {
        $afterId = (int) $request->query('after_id', 0);
        $q = DB::table('room_messages as m')
            ->join('users as u', 'u.id', '=', 'm.user_id')
            ->where('m.room_id', $roomId);
        if ($afterId > 0) $q->where('m.id', '>', $afterId);
        $rows = $q->orderBy('m.id')->limit(200)
            ->get(['m.id','m.room_id','m.user_id','m.body','m.kind','m.created_at','u.name','u.avatar']);
        return ['data' => $rows->map(fn ($r) => [
            'id'        => (int) $r->id,
            'roomId'    => (int) $r->room_id,
            'userId'    => (int) $r->user_id,
            'name'      => $r->name,
            'avatar'    => $r->avatar ?? null,
            'body'      => $r->body,
            'kind'      => $r->kind,
            'createdAt' => $r->created_at,
        ])->values()];
    }

    public function roomSend(Request $request, int $roomId)
    {
        $uid  = $request->user()->id;
        $room = DB::table('live_rooms')->where('id', $roomId)->first();
        if (!$room) abort(404, 'Room not found');
        if (!$room->live) abort(410, 'Room is not live');

        $data = $request->validate([
            'body' => 'required|string|max:500',
            'kind' => 'nullable|string|in:text,gift,system,reaction',
        ]);

        $id = DB::table('room_messages')->insertGetId([
            'room_id'    => $roomId,
            'user_id'    => $uid,
            'body'       => $data['body'],
            'kind'       => $data['kind'] ?? 'text',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('room_messages')->where('id', $id)->first();
        $user = DB::table('users')->where('id', $uid)->first();
        $shaped = [
            'id'        => (int) $row->id,
            'roomId'    => (int) $row->room_id,
            'userId'    => $uid,
            'name'      => $user->name ?? null,
            'avatar'    => $user->avatar ?? null,
            'body'      => $row->body,
            'kind'      => $row->kind,
            'createdAt' => $row->created_at,
        ];

        try { event(new NewRoomMessage($roomId, $shaped)); } catch (\Throwable $e) {}

        return ['data' => $shaped];
    }
}
