<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CashoutController extends Controller
{
    /**
     * Current user's own cashout history.
     */
    public function mine(Request $request)
    {
        $rows = DB::table('cashouts')
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->limit(100)
            ->get();
        return response()->json(['cashouts' => $rows]);
    }

    /**
     * Admin: list cashouts, optional ?status=pending|paid|rejected
     */
    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        $q = DB::table('cashouts as c')
            ->leftJoin('users as u', 'u.id', '=', 'c.user_id')
            ->select('c.*', 'u.name as user_name', 'u.email as user_email')
            ->orderByDesc('c.id');
        if ($status = $request->query('status')) {
            $q->where('c.status', $status);
        }
        return response()->json(['cashouts' => $q->limit(200)->get()]);
    }

    /**
     * Admin: mark cashout as paid (money sent).
     */
    public function approve(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        return DB::transaction(function () use ($id) {
            $row = DB::table('cashouts')->where('id', $id)->lockForUpdate()->first();
            if (!$row) return response()->json(['message' => 'Not found'], 404);
            if ($row->status !== 'pending') {
                return response()->json(['message' => 'Already processed'], 409);
            }
            DB::table('cashouts')->where('id', $id)->update([
                'status' => 'paid',
                'processed_at' => now(),
                'updated_at' => now(),
            ]);
            return response()->json(['message' => 'Cashout marked paid', 'id' => $id]);
        });
    }

    /**
     * Admin: reject and refund the R-Coins back to the user.
     */
    public function reject(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        return DB::transaction(function () use ($id) {
            $row = DB::table('cashouts')->where('id', $id)->lockForUpdate()->first();
            if (!$row) return response()->json(['message' => 'Not found'], 404);
            if ($row->status !== 'pending') {
                return response()->json(['message' => 'Already processed'], 409);
            }
            $user = User::lockForUpdate()->find($row->user_id);
            if ($user) {
                $user->r_coins = (int) $user->r_coins + (int) $row->amount;
                $user->save();
            }
            DB::table('cashouts')->where('id', $id)->update([
                'status' => 'rejected',
                'processed_at' => now(),
                'updated_at' => now(),
            ]);
            return response()->json(['message' => 'Cashout rejected & refunded', 'id' => $id]);
        });
    }

    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) {
            abort(403, 'Admin only');
        }
    }
}
