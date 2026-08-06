<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deposit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DepositController extends Controller
{
    // POST /api/deposits  – user submits a recharge request
    public function store(Request $request)
    {
        $data = $request->validate([
            'amount' => 'required|integer|min:1',
            'method' => 'required|string|max:32',
            'tx_id'  => 'required|string|max:64',
            'phone_number' => 'required|string|max:32',
        ]);
        $config = $this->rechargeConfig();
        $diamonds = (int) round($data['amount'] * (float) ($config['diamondRate'] ?? 1.1));
        $coins = (int) round($data['amount'] * (float) ($config['coinRate'] ?? 0));

        $deposit = Deposit::create([
            'user_id'  => $request->user()->id,
            'amount'   => $data['amount'],
            'method'   => $data['method'],
            'tx_id'    => $data['tx_id'],
            'phone_number' => $data['phone_number'],
            'payment_number' => $config['paymentNumber'] ?? null,
            'diamonds' => $diamonds,
            'coins' => $coins,
            'status'   => 'pending',
        ]);

        return response()->json(['deposit' => $deposit], 201);
    }

    // GET /api/deposits  – list current user's deposits
    public function index(Request $request)
    {
        $rows = Deposit::where('user_id', $request->user()->id)
            ->orderByDesc('id')->limit(100)->get();
        return response()->json(['deposits' => $rows]);
    }

    // GET /api/admin/deposits  – list all pending+recent (admin only)
    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        $rows = Deposit::orderByDesc('id')->limit(200)->get();
        return response()->json(['deposits' => $rows]);
    }

    // POST /api/admin/deposits/{id}/approve
    public function approve(Request $request, int $id)
    {
        $this->authorizeAdmin($request);

        return DB::transaction(function () use ($request, $id) {
            $dep = Deposit::lockForUpdate()->findOrFail($id);
            if ($dep->status !== 'pending') {
                return response()->json(['message' => 'Already processed'], 409);
            }
            $dep->status = 'approved';
            $dep->approved_by = $request->user()->id;
            $dep->approved_at = now();
            $dep->save();

            $user = $dep->user()->lockForUpdate()->first();
            $user->diamonds = $user->diamonds + $dep->diamonds;
            if (Schema::hasColumn('deposits', 'coins')) {
                $user->r_coins = $user->r_coins + (int) ($dep->coins ?? 0);
            }
            $user->save();

            return response()->json([
                'deposit' => $dep,
                'wallet'  => ['diamonds' => (int) $user->diamonds, 'rCoins' => (int) $user->r_coins],
            ]);
        });
    }

    // POST /api/admin/deposits/{id}/reject
    public function reject(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $dep = Deposit::findOrFail($id);
        if ($dep->status !== 'pending') {
            return response()->json(['message' => 'Already processed'], 409);
        }
        $dep->status = 'rejected';
        $dep->approved_by = $request->user()->id;
        $dep->approved_at = now();
        $dep->save();
        return response()->json(['deposit' => $dep]);
    }

    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) {
            abort(403, 'Admin only');
        }
    }

    private function rechargeConfig(): array
    {
        $value = DB::table('app_settings')->where('key', 'recharge_config')->value('value');
        $decoded = $value ? json_decode($value, true) : null;
        return is_array($decoded)
            ? $decoded
            : ['paymentNumber' => '01700000000', 'diamondRate' => 1.1, 'coinRate' => 0];
    }
}
