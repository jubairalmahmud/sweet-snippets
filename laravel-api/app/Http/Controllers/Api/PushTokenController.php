<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PushTokenController extends Controller
{
    public function register(Request $request)
    {
        $uid  = $request->user()->id;
        $data = $request->validate([
            'token'    => 'required|string|max:512',
            'platform' => 'nullable|string|in:android,ios,web',
            'device'   => 'nullable|string|max:128',
        ]);

        $existing = DB::table('push_tokens')->where('token', $data['token'])->first();
        if ($existing) {
            DB::table('push_tokens')->where('id', $existing->id)->update([
                'user_id'    => $uid,
                'platform'   => $data['platform'] ?? $existing->platform,
                'device'     => $data['device'] ?? $existing->device,
                'updated_at' => now(),
            ]);
            return ['ok' => true, 'id' => (int) $existing->id];
        }

        $id = DB::table('push_tokens')->insertGetId([
            'user_id'    => $uid,
            'token'      => $data['token'],
            'platform'   => $data['platform'] ?? 'android',
            'device'     => $data['device'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return ['ok' => true, 'id' => (int) $id];
    }

    public function unregister(Request $request)
    {
        $uid  = $request->user()->id;
        $data = $request->validate(['token' => 'required|string|max:512']);
        DB::table('push_tokens')->where('user_id', $uid)->where('token', $data['token'])->delete();
        return ['ok' => true];
    }

    public function mine(Request $request)
    {
        $uid = $request->user()->id;
        $rows = DB::table('push_tokens')->where('user_id', $uid)->orderByDesc('id')->get();
        return ['data' => $rows->map(fn ($r) => [
            'id'        => (int) $r->id,
            'token'     => $r->token,
            'platform'  => $r->platform,
            'device'    => $r->device,
            'createdAt' => $r->created_at,
        ])->values()];
    }
}
