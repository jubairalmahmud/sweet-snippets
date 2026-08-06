<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminUserController extends Controller
{
    // GET /api/admin/users?q=
    public function index(Request $request)
    {
        $this->authorizeAdmin($request);
        $q = trim((string) $request->query('q', ''));

        $query = User::query()->orderByDesc('id');
        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('name', 'like', "%{$q}%")
                  ->orWhere('email', 'like', "%{$q}%")
                  ->orWhere('id', $q);
            });
        }
        $columns = [
            'id', 'name', 'email', 'diamonds', 'r_coins',
            'vip_level', 'is_banned', 'is_admin', 'bio', 'avatar', 'cover',
            'location', 'hometown', 'birthday', 'website', 'work', 'education', 'blood_group',
            'created_at',
        ];
        if (Schema::hasColumn('users', 'role')) {
            $columns[] = 'role';
        }
        $users = $query->limit(200)->get($columns)->map(function (User $user) {
            $user->role = $this->resolveRole($user);
            return $user;
        });
        return response()->json(['users' => $users]);
    }

    // POST /api/admin/users/{id}/ban
    public function ban(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $u = User::findOrFail($id);
        $u->is_banned = true;
        $u->save();
        return response()->json(['user' => $u]);
    }

    // POST /api/admin/users/{id}/unban
    public function unban(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $u = User::findOrFail($id);
        $u->is_banned = false;
        $u->save();
        return response()->json(['user' => $u]);
    }

    // POST /api/admin/users/{id}/role
    public function updateRole(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'role' => 'required|string|in:user,agent,reseller,admin',
        ]);

        if (! Schema::hasColumn('users', 'role')) {
            return response()->json(['message' => 'User roles migration is not installed yet.'], 409);
        }

        $u = User::findOrFail($id);
        $u->role = $data['role'];
        $u->is_admin = $data['role'] === 'admin';
        $u->save();

        return response()->json(['user' => $u]);
    }

    // POST /api/admin/wallet-transfer
    public function walletTransfer(Request $request)
    {
        $admin = $request->user();
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'receiver_id' => 'required|integer|exists:users,id',
            'diamonds' => 'nullable|integer|min:0',
            'r_coins' => 'nullable|integer|min:0',
            'note' => 'nullable|string|max:255',
        ]);

        $diamonds = (int) ($data['diamonds'] ?? 0);
        $rCoins = (int) ($data['r_coins'] ?? 0);
        if ($diamonds <= 0 && $rCoins <= 0) {
            return response()->json(['message' => 'Enter coins or diamonds to transfer.'], 422);
        }

        return DB::transaction(function () use ($admin, $data, $diamonds, $rCoins) {
            $receiver = User::lockForUpdate()->findOrFail((int) $data['receiver_id']);
            $receiver->diamonds = (int) $receiver->diamonds + $diamonds;
            $receiver->r_coins = (int) $receiver->r_coins + $rCoins;
            $receiver->save();

            $id = DB::table('wallet_transfers')->insertGetId([
                'sender_id' => $admin->id,
                'receiver_id' => $receiver->id,
                'sender_role' => 'admin',
                'receiver_role' => $this->resolveRole($receiver),
                'diamonds' => $diamonds,
                'r_coins' => $rCoins,
                'source' => 'admin',
                'note' => $data['note'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'message' => 'Wallet credited',
                'transferId' => $id,
                'user' => $receiver,
            ]);
        });
    }

    // POST /api/admin/users/{id}/adjust-coins
    // Body: { r_coins?, diamonds?, mode: 'add'|'remove', note? }
    // Increases (add) or decreases (remove) a user's coin/diamond balance.
    public function adjustCoins(Request $request, int $id)
    {
        $admin = $request->user();
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'r_coins'  => 'nullable|integer|min:0',
            'diamonds' => 'nullable|integer|min:0',
            'mode'     => 'required|string|in:add,remove',
            'note'     => 'nullable|string|max:255',
        ]);

        $rCoins   = (int) ($data['r_coins'] ?? 0);
        $diamonds = (int) ($data['diamonds'] ?? 0);
        if ($rCoins <= 0 && $diamonds <= 0) {
            return response()->json(['message' => 'Enter coins or diamonds to adjust.'], 422);
        }
        $sign = $data['mode'] === 'remove' ? -1 : 1;

        return DB::transaction(function () use ($admin, $id, $rCoins, $diamonds, $sign, $data) {
            $user = User::lockForUpdate()->findOrFail($id);
            $user->r_coins  = max(0, (int) $user->r_coins + $sign * $rCoins);
            $user->diamonds = max(0, (int) $user->diamonds + $sign * $diamonds);
            $user->save();

            // Ledger row (amounts are stored positive; `source` records the direction
            // because wallet_transfers.diamonds / r_coins are unsigned columns).
            if (Schema::hasTable('wallet_transfers')) {
                DB::table('wallet_transfers')->insert([
                    'sender_id'     => $admin->id,
                    'receiver_id'   => $user->id,
                    'sender_role'   => 'admin',
                    'receiver_role' => $this->resolveRole($user),
                    'diamonds'      => $diamonds,
                    'r_coins'       => $rCoins,
                    'source'        => $sign < 0 ? 'admin_debit' : 'admin_credit',
                    'note'          => $data['note'] ?? ($sign < 0 ? 'Admin debit' : 'Admin credit'),
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ]);
            }

            return response()->json([
                'message' => $sign < 0 ? 'Coins removed' : 'Coins added',
                'user'    => $user,
            ]);
        });
    }

    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) {
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
