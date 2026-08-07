<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VipPriceController extends Controller
{
    // GET /api/vip-prices — list all configured VIP level prices.
    public function index()
    {
        $prices = DB::table('vip_prices')->orderBy('level')->get(['level', 'price']);
        return response()->json(['prices' => $prices]);
    }

    // POST /api/admin/vip-prices — bulk upsert prices.
    // Body: { prices: [ { level:int, price:int }, ... ] }
    public function update(Request $request)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'prices'           => 'required|array|min:1',
            'prices.*.level'   => 'required|integer|min:1|max:50',
            'prices.*.price'   => 'required|integer|min:0',
        ]);

        DB::transaction(function () use ($data) {
            foreach ($data['prices'] as $row) {
                DB::table('vip_prices')->updateOrInsert(
                    ['level' => $row['level']],
                    ['price' => $row['price'], 'updated_at' => now(), 'created_at' => now()]
                );
            }
        });

        $prices = DB::table('vip_prices')->orderBy('level')->get(['level', 'price']);
        return response()->json(['message' => 'Updated', 'prices' => $prices]);
    }

    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) {
            abort(403, 'Admin only');
        }
    }
}
