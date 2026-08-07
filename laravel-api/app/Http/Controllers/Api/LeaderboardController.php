<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaderboardController extends Controller
{
    // role: sender|receiver, period: daily|weekly|monthly|all
    public function index(Request $request)
    {
        $role   = $request->query('role', 'sender');
        $period = $request->query('period', 'daily');
        $limit  = min(100, (int) $request->query('limit', 50));

        $since = match ($period) {
            'daily'   => now()->subDay(),
            'weekly'  => now()->subWeek(),
            'monthly' => now()->subMonth(),
            default   => null,
        };

        $col = $role === 'receiver' ? 'receiver_id' : 'sender_id';

        $q = DB::table('gift_transactions')
            ->selectRaw("$col as uid, SUM(diamonds) as total, COUNT(*) as cnt")
            ->groupBy('uid')
            ->orderByDesc('total')
            ->limit($limit);
        if ($since) $q->where('created_at', '>=', $since);

        $rows = $q->get();
        $data = [];
        $rank = 0;
        foreach ($rows as $r) {
            $rank++;
            $u = DB::table('users')->where('id', $r->uid)->first();
            $data[] = [
                'rank'    => $rank,
                'userId'  => (int) $r->uid,
                'name'    => $u->name ?? null,
                'avatar'  => $u->avatar_url ?? null,
                'total'   => (int) $r->total,
                'count'   => (int) $r->cnt,
            ];
        }
        return ['role' => $role, 'period' => $period, 'data' => $data];
    }
}
