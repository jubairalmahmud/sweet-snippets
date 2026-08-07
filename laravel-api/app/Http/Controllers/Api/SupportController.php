<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportController extends Controller
{
    public function mine(Request $request)
    {
        $conversation = $this->conversationForUser((int) $request->user()->id);
        return response()->json([
            'conversation' => $conversation,
            'messages' => $this->messages((int) $conversation->id),
        ]);
    }

    public function send(Request $request)
    {
        $data = $request->validate([
            'message' => 'required|string|max:2000',
        ]);
        $user = $request->user();
        $conversation = $this->conversationForUser((int) $user->id);

        $messageId = DB::table('support_messages')->insertGetId([
            'conversation_id' => $conversation->id,
            'sender_id' => $user->id,
            'sender_role' => 'user',
            'message' => $data['message'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('support_conversations')->where('id', $conversation->id)->update([
            'status' => 'open',
            'last_message_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => DB::table('support_messages')->find($messageId),
            'conversation' => DB::table('support_conversations')->find($conversation->id),
        ], 201);
    }

    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        $rows = DB::table('support_conversations as c')
            ->join('users as u', 'u.id', '=', 'c.user_id')
            ->select('c.*', 'u.name as user_name', 'u.email as user_email')
            ->orderByDesc(DB::raw('COALESCE(c.last_message_at, c.updated_at)'))
            ->limit(200)
            ->get();

        return response()->json(['conversations' => $rows]);
    }

    public function adminShow(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $conversation = DB::table('support_conversations as c')
            ->join('users as u', 'u.id', '=', 'c.user_id')
            ->select('c.*', 'u.name as user_name', 'u.email as user_email')
            ->where('c.id', $id)
            ->first();
        if (!$conversation) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json([
            'conversation' => $conversation,
            'messages' => $this->messages($id),
        ]);
    }

    public function adminReply(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'message' => 'required|string|max:2000',
        ]);
        $conversation = DB::table('support_conversations')->where('id', $id)->first();
        if (!$conversation) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $messageId = DB::table('support_messages')->insertGetId([
            'conversation_id' => $id,
            'sender_id' => $request->user()->id,
            'sender_role' => 'admin',
            'message' => $data['message'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('support_conversations')->where('id', $id)->update([
            'status' => 'open',
            'last_message_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => DB::table('support_messages')->find($messageId)], 201);
    }

    private function conversationForUser(int $userId)
    {
        $conversation = DB::table('support_conversations')->where('user_id', $userId)->first();
        if ($conversation) {
            return $conversation;
        }
        $id = DB::table('support_conversations')->insertGetId([
            'user_id' => $userId,
            'status' => 'open',
            'last_message_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('support_messages')->insert([
            'conversation_id' => $id,
            'sender_id' => null,
            'sender_role' => 'admin',
            'message' => 'Hello! How can we help you today?',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return DB::table('support_conversations')->find($id);
    }

    private function messages(int $conversationId)
    {
        return DB::table('support_messages')
            ->where('conversation_id', $conversationId)
            ->orderBy('id')
            ->limit(500)
            ->get();
    }

    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) {
            abort(403, 'Admin only');
        }
    }
}
