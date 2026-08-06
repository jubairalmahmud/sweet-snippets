<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GiftController extends Controller
{
    /**
     * Recent gifts across all rooms (live feed). Optional ?roomType=&roomId=
     */
    public function recent(Request $request)
    {
        $q = DB::table('gift_transactions as g')
            ->leftJoin('users as s', 's.id', '=', 'g.sender_id')
            ->leftJoin('users as r', 'r.id', '=', 'g.receiver_id')
            ->select(
                'g.id', 'g.gift_name', 'g.gift_icon', 'g.diamonds', 'g.r_coins',
                'g.room_type', 'g.room_id', 'g.created_at',
                's.id as sender_id', 's.name as sender_name',
                'r.id as receiver_id', 'r.name as receiver_name'
            )
            ->orderByDesc('g.id')
            ->limit(50);

        if ($rt = $request->query('roomType')) $q->where('g.room_type', $rt);
        if ($rid = $request->query('roomId'))  $q->where('g.room_id', $rid);

        return response()->json(['gifts' => $q->get()]);
    }

    /**
     * Current user's gift history (sent + received).
     */
    public function mine(Request $request)
    {
        $uid = $request->user()->id;
        $rows = DB::table('gift_transactions')
            ->where('sender_id', $uid)
            ->orWhere('receiver_id', $uid)
            ->orderByDesc('id')
            ->limit(100)
            ->get();
        return response()->json(['gifts' => $rows]);
    }

    /**
     * Admin: paginated gift audit + 24h totals.
     */
    public function adminIndex(Request $request)
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) abort(403, 'Admin only');

        $rows = DB::table('gift_transactions as g')
            ->leftJoin('users as s', 's.id', '=', 'g.sender_id')
            ->leftJoin('users as r', 'r.id', '=', 'g.receiver_id')
            ->select(
                'g.*',
                's.name as sender_name',
                'r.name as receiver_name'
            )
            ->orderByDesc('g.id')
            ->limit(200)
            ->get();

        $totals = DB::table('gift_transactions')
            ->where('created_at', '>=', now()->subDay())
            ->selectRaw('COUNT(*) as count, COALESCE(SUM(diamonds),0) as diamonds, COALESCE(SUM(r_coins),0) as r_coins')
            ->first();

        return response()->json(['gifts' => $rows, 'last24h' => $totals]);
    }
}
