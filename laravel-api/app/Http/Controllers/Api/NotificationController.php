<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    private function shape(object $n): array
    {
        return [
            'id'        => (int) $n->id,
            'type'      => $n->type,
            'title'     => $n->title,
            'body'      => $n->body,
            'data'      => $n->data ? json_decode($n->data, true) : null,
            'readAt'    => $n->read_at,
            'createdAt' => $n->created_at,
        ];
    }

    public function index(Request $request)
    {
        $uid = $request->user()->id;
        $rows = DB::table('notifications')->where('user_id', $uid)
            ->orderByDesc('id')->limit(200)->get();
        return ['data' => $rows->map(fn ($n) => $this->shape($n))->values()];
    }

    public function unreadCount(Request $request)
    {
        $uid = $request->user()->id;
        $n = DB::table('notifications')->where('user_id', $uid)->whereNull('read_at')->count();
        return ['count' => (int) $n];
    }

    public function markRead(Request $request, int $id)
    {
        $uid = $request->user()->id;
        DB::table('notifications')->where('id', $id)->where('user_id', $uid)
            ->update(['read_at' => now()]);
        return ['ok' => true];
    }

    public function markAllRead(Request $request)
    {
        $uid = $request->user()->id;
        DB::table('notifications')->where('user_id', $uid)->whereNull('read_at')
            ->update(['read_at' => now()]);
        return ['ok' => true];
    }

    public function destroy(Request $request, int $id)
    {
        $uid = $request->user()->id;
        DB::table('notifications')->where('id', $id)->where('user_id', $uid)->delete();
        return ['ok' => true];
    }
}
