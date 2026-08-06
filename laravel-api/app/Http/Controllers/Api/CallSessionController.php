<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CallSessionController extends Controller
{
    private function shape(object $row): array
    {
        return [
            'id' => (int) $row->id,
            'callerId' => (int) $row->caller_id,
            'hostUserId' => $row->host_user_id ? (int) $row->host_user_id : null,
            'hostName' => $row->host_name,
            'ratePerMinute' => (int) $row->rate_per_minute,
            'chargedDiamonds' => (int) $row->charged_diamonds,
            'durationSeconds' => (int) $row->duration_seconds,
            'status' => $row->status,
            'startedAt' => $row->started_at,
            'endedAt' => $row->ended_at,
        ];
    }

    public function start(Request $request)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $data = $request->validate([
            'host_user_id' => 'nullable|integer|min:1',
            'host_name' => 'required|string|max:120',
            'rate_per_minute' => 'required|integer|min:1|max:100000',
        ]);

        $rate = (int) $data['rate_per_minute'];
        if ((int) $user->diamonds < $rate) {
            abort(422, 'Insufficient diamonds for this call.');
        }

        $session = DB::transaction(function () use ($user, $data, $rate) {
            DB::table('users')->where('id', $user->id)->update([
                'diamonds' => DB::raw('GREATEST(diamonds - ' . $rate . ', 0)'),
                'updated_at' => now(),
            ]);

            $id = DB::table('call_sessions')->insertGetId([
                'caller_id' => $user->id,
                'host_user_id' => $data['host_user_id'] ?? null,
                'host_name' => $data['host_name'],
                'rate_per_minute' => $rate,
                'charged_diamonds' => $rate,
                'duration_seconds' => 0,
                'status' => 'connected',
                'started_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return DB::table('call_sessions')->where('id', $id)->first();
        });

        $wallet = DB::table('users')->where('id', $user->id)->first(['diamonds', 'r_coins']);

        return [
            'data' => $this->shape($session),
            'wallet' => [
                'diamonds' => (int) $wallet->diamonds,
                'rCoins' => (int) $wallet->r_coins,
            ],
        ];
    }

    public function end(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user) abort(401);

        $row = DB::table('call_sessions')->where('id', $id)->first();
        if (!$row) abort(404, 'Call session not found.');
        if ((int) $row->caller_id !== (int) $user->id && !($user->is_admin ?? false)) {
            abort(403, 'Not allowed to end this call.');
        }

        $data = $request->validate([
            'duration_seconds' => 'nullable|integer|min:0|max:86400',
        ]);

        DB::table('call_sessions')->where('id', $id)->update([
            'status' => 'ended',
            'duration_seconds' => (int) ($data['duration_seconds'] ?? $row->duration_seconds ?? 0),
            'ended_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('call_sessions')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }
}
