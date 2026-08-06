<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-only salary settings + per-agency share overrides.
 */
class SalarySettingsController extends Controller
{
    protected function ensureAdmin(): ?\Illuminate\Http\JsonResponse
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthenticated'], 401);
        $isAdmin = ($u->role ?? null) === 'admin' || ($u->is_admin ?? false);
        if (!$isAdmin && Schema::hasTable('user_roles')) {
            $isAdmin = DB::table('user_roles')->where('user_id', $u->id)->where('role', 'admin')->exists();
        }
        if (!$isAdmin) return response()->json(['message' => 'Forbidden'], 403);
        return null;
    }

    public function index()
    {
        if ($e = $this->ensureAdmin()) return $e;
        $s = DB::table('salary_settings')->where('active', true)->orderByDesc('id')->first();
        if (!$s) return response()->json(['settings' => null]);
        $s->bonus_rules = json_decode($s->bonus_rules ?? '[]', true) ?: [];
        return response()->json(['settings' => $s]);
    }

    public function update(Request $req)
    {
        if ($e = $this->ensureAdmin()) return $e;
        $data = $req->validate([
            'points_to_usd' => 'required|numeric|min:0',
            'default_agency_share_pct' => 'required|numeric|min:0|max:100',
            'min_days' => 'nullable|integer|min:0',
            'min_hours' => 'nullable|numeric|min:0',
            'points_source' => 'nullable|in:diamonds,coins',
            'bonus_rules' => 'nullable|array',
            'bonus_rules.*.min_points' => 'required_with:bonus_rules|integer|min:0',
            'bonus_rules.*.bonus_usd' => 'required_with:bonus_rules|numeric|min:0',
        ]);

        DB::table('salary_settings')->insert([
            'points_to_usd' => $data['points_to_usd'],
            'default_agency_share_pct' => $data['default_agency_share_pct'],
            'min_days' => $data['min_days'] ?? 0,
            'min_hours' => $data['min_hours'] ?? 0,
            'points_source' => $data['points_source'] ?? 'diamonds',
            'bonus_rules' => json_encode($data['bonus_rules'] ?? []),
            'active' => true,
            'updated_by' => Auth::id(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        // Deactivate older rows for cleanliness (keep the newest active).
        $latestId = DB::table('salary_settings')->max('id');
        DB::table('salary_settings')->where('id', '<', $latestId)->update(['active' => false]);

        return response()->json(['ok' => true]);
    }

    public function overrides(Request $req)
    {
        if ($e = $this->ensureAdmin()) return $e;
        $q = DB::table('agency_share_overrides');
        if ($req->query('agency_id')) $q->where('agency_id', (int) $req->query('agency_id'));
        return response()->json(['overrides' => $q->orderByDesc('effective_from')->get()]);
    }

    public function addOverride(Request $req)
    {
        if ($e = $this->ensureAdmin()) return $e;
        $data = $req->validate([
            'agency_id' => 'required|integer',
            'share_pct' => 'required|numeric|min:0|max:100',
            'effective_from' => 'required|date',
            'note' => 'nullable|string|max:255',
        ]);
        $id = DB::table('agency_share_overrides')->insertGetId([
            'agency_id' => $data['agency_id'],
            'share_pct' => $data['share_pct'],
            'effective_from' => $data['effective_from'],
            'note' => $data['note'] ?? null,
            'created_by' => Auth::id(),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        return response()->json(['ok' => true, 'id' => $id]);
    }

    public function deleteOverride($id)
    {
        if ($e = $this->ensureAdmin()) return $e;
        DB::table('agency_share_overrides')->where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }
}
