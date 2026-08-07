<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminStatsController extends Controller
{
    public function overview(Request $request)
    {
        $user = $request->user();
        if (!$user || !($user->is_admin ?? false)) {
            abort(403, 'Admin only');
        }

        $approvedRevenue = 0;
        if (Schema::hasTable('deposits')) {
            $approvedRevenue = (int) DB::table('deposits')
                ->where('status', 'approved')
                ->sum('amount');
        }

        $activeAgencies = 0;
        if (Schema::hasTable('agencies')) {
            $activeAgencies = (int) DB::table('agencies')
                ->whereRaw('LOWER(status) = ?', ['active'])
                ->count();
        }

        $hostsVerified = 0;
        if (Schema::hasTable('agency_hosts')) {
            $hostsVerified = (int) DB::table('agency_hosts')
                ->whereRaw('LOWER(status) = ?', ['active'])
                ->count();
        }

        $pkBattlesLive = 0;
        if (Schema::hasTable('live_rooms')) {
            $pkBattlesLive = (int) DB::table('live_rooms')
                ->where('live', true)
                ->where(function ($query) {
                    $query->where('category', 'pk')
                        ->orWhere('category', 'PK')
                        ->orWhere('category', 'pk_battle');
                })
                ->count();
        }

        return response()->json([
            'approved_revenue_bdt' => $approvedRevenue,
            'active_agencies' => $activeAgencies,
            'hosts_verified' => $hostsVerified,
            'pk_battles_live' => $pkBattlesLive,
        ]);
    }
}
