<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class RoleRequestController extends Controller
{
    // GET /api/role-requests/mine
    public function mine(Request $request)
    {
        $user = $request->user();
        $requests = DB::table('role_requests')
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->limit(20)
            ->get();

        return response()->json(['requests' => $requests]);
    }

    // POST /api/role-requests
    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'requested_role' => 'required|string|in:agent,reseller',
            'referral_code' => 'nullable|string|max:64',
            'phone' => 'nullable|string|max:32',
            'message' => 'nullable|string|max:255',
        ]);

        $currentRole = $this->resolveRole($user);
        if ($currentRole === $data['requested_role'] || $currentRole === 'admin') {
            return response()->json(['message' => 'This role is already active on your account.'], 422);
        }

        if ($data['requested_role'] === 'agent' && trim((string) ($data['referral_code'] ?? '')) === '') {
            return response()->json(['message' => 'Agency/referral code is required for agency request.'], 422);
        }

        $pending = DB::table('role_requests')
            ->where('user_id', $user->id)
            ->where('requested_role', $data['requested_role'])
            ->where('status', 'pending')
            ->first();

        if ($pending) {
            return response()->json([
                'message' => 'You already have a pending request for this role.',
                'request' => $pending,
            ], 409);
        }

        $id = DB::table('role_requests')->insertGetId([
            'user_id' => $user->id,
            'requested_role' => $data['requested_role'],
            'status' => 'pending',
            'referral_code' => $data['referral_code'] ?? null,
            'phone' => $data['phone'] ?? null,
            'message' => $data['message'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Request submitted. Admin will review it.',
            'request' => DB::table('role_requests')->find($id),
        ], 201);
    }

    // GET /api/admin/role-requests
    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        $status = $request->query('status', 'pending');

        $query = DB::table('role_requests')
            ->join('users', 'role_requests.user_id', '=', 'users.id')
            ->leftJoin('users as reviewers', 'role_requests.reviewed_by', '=', 'reviewers.id')
            ->orderByDesc('role_requests.id');

        if ($status !== 'all') {
            $query->where('role_requests.status', $status);
        }

        $requests = $query->limit(200)->get([
            'role_requests.*',
            'users.name as user_name',
            'users.email as user_email',
            'users.role as current_role',
            'users.is_admin',
            'users.diamonds',
            'users.r_coins',
            'reviewers.name as reviewer_name',
        ]);

        return response()->json(['requests' => $requests]);
    }

    // POST /api/admin/role-requests/{id}/respond
    public function respond(Request $request, int $id)
    {
        $admin = $request->user();
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'status' => 'required|string|in:approved,rejected',
        ]);

        $roleRequest = DB::table('role_requests')->where('id', $id)->first();
        if (! $roleRequest) {
            return response()->json(['message' => 'Role request not found.'], 404);
        }
        if ($roleRequest->status !== 'pending') {
            return response()->json(['message' => 'This request is already processed.'], 422);
        }

        return DB::transaction(function () use ($admin, $roleRequest, $data) {
            $updatedUser = null;
            if ($data['status'] === 'approved') {
                if (! Schema::hasColumn('users', 'role')) {
                    return response()->json(['message' => 'User roles migration is not installed yet.'], 409);
                }

                $user = User::lockForUpdate()->findOrFail($roleRequest->user_id);
                $user->role = $roleRequest->requested_role;
                $user->is_admin = false;
                $user->save();
                $updatedUser = $user;
            }

            DB::table('role_requests')->where('id', $roleRequest->id)->update([
                'status' => $data['status'],
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'message' => $data['status'] === 'approved' ? 'Request approved.' : 'Request rejected.',
                'request' => DB::table('role_requests')->find($roleRequest->id),
                'user' => $updatedUser,
            ]);
        });
    }

    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (! $u || ! ($u->is_admin ?? false)) {
            abort(403, 'Admin only');
        }
    }

    private function resolveRole(User $user): string
    {
        if ((bool) $user->is_admin) return 'admin';
        if (Schema::hasColumn('users', 'role')) {
            $role = (string) ($user->role ?: 'user');
            if (in_array($role, ['user', 'agent', 'reseller', 'admin'], true)) return $role;
        }
        return 'user';
    }
}
