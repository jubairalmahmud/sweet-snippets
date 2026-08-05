<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\HostReportHelper;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WalletController extends Controller
{
    public function show(Request $request)
    {
        $u = $request->user();
        $frameFields = \App\Support\UserFrames::shape($u->id);
        return response()->json([
            'diamonds'       => (int) $u->diamonds,
            'rCoins'         => (int) $u->r_coins,
            'earnings'       => (int) ($u->host_earnings ?? 0),
            'vipLevel'       => (int) $u->vip_level,
            'avatarFrame'    => $frameFields['activeFrame'] ?? ($u->avatar_frame ?? null),
            'activeFrame'    => $frameFields['activeFrame'] ?? ($u->avatar_frame ?? null),
            'activeFrameImg' => $frameFields['activeFrameImg'] ?? null,
            'entryEffect'    => Schema::hasColumn('users', 'entry_effect') ? ($u->entry_effect ?? null) : null,
            'entry_effect'   => Schema::hasColumn('users', 'entry_effect') ? ($u->entry_effect ?? null) : null,
        ]);
    }

    /**
     * Convert R-Coins to Diamonds (1:1).
     * Body: { amount: int }
     */
    public function convert(Request $request)
    {
        $data = $request->validate([
            'amount' => 'required|integer|min:1',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($user, $data) {
            $user = $user->lockForUpdate()->find($user->id);
            if ((int) $user->r_coins < $data['amount']) {
                return response()->json(['message' => 'Insufficient R-Coins'], 422);
            }
            $user->r_coins -= $data['amount'];
            $user->diamonds += $data['amount'];
            $user->save();

            return response()->json([
                'message'  => 'Converted successfully',
                'diamonds' => (int) $user->diamonds,
                'rCoins'   => (int) $user->r_coins,
            ]);
        });
    }

    /**
     * Submit a cashout request.
     * Body: { amount: int (rCoins), method: string, number: string }
     */
    public function cashout(Request $request)
    {
        $data = $request->validate([
            'amount' => 'required|integer|min:50',
            'method' => 'required|string|max:32',
            'number' => 'required|string|max:32',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($user, $data) {
            $user = $user->lockForUpdate()->find($user->id);
            if ((int) $user->r_coins < $data['amount']) {
                return response()->json(['message' => 'Insufficient R-Coins'], 422);
            }
            $user->r_coins -= $data['amount'];
            $user->save();

            $cashout = DB::table('cashouts')->insertGetId([
                'user_id'    => $user->id,
                'amount'     => $data['amount'],
                'bdt'        => $data['amount'] / 10,
                'method'     => $data['method'],
                'number'     => $data['number'],
                'status'     => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'message'  => 'Cashout request submitted',
                'id'       => $cashout,
                'rCoins'   => (int) $user->r_coins,
                'bdt'      => $data['amount'] / 10,
            ]);
        });
    }

    /**
     * Purchase / upgrade VIP level. Cost = level * 1000 diamonds.
     * Body: { level: int }
     */
    public function buyVip(Request $request)
    {
        $data = $request->validate([
            'level' => 'required|integer|min:1|max:10',
        ]);

        $user = $request->user();

        // Admin-configured price; fallback to level * 1000 if not set.
        $row  = DB::table('vip_prices')->where('level', $data['level'])->first();
        $cost = $row ? (int) $row->price : $data['level'] * 1000;

        return DB::transaction(function () use ($user, $data, $cost) {
            $user = $user->lockForUpdate()->find($user->id);
            if ($data['level'] <= (int) $user->vip_level) {
                return response()->json(['message' => 'You already have this VIP level or higher'], 422);
            }
            if ((int) $user->diamonds < $cost) {
                return response()->json(['message' => 'Insufficient diamonds'], 422);
            }
            $user->diamonds -= $cost;
            $user->vip_level = $data['level'];
            $user->save();

            return response()->json([
                'message'  => 'VIP upgraded',
                'vipLevel' => (int) $user->vip_level,
                'diamonds' => (int) $user->diamonds,
                'cost'     => $cost,
            ]);
        });
    }

    /**
     * Purchase a shop item (avatar frame / entry effect) with diamonds.
     * Body: { kind: 'frame'|'effect', name: string, price: int, imageUrl?: string }
     *
     * Persists the purchase to `user_frames` / `user_entry_effects` and marks
     * it as equipped so it survives login on any device and is visible to
     * every other user via profile/party/friend endpoints.
     */
    public function buyItem(Request $request)
    {
        $data = $request->validate([
            'kind'     => 'required|in:frame,effect',
            'name'     => 'required|string|max:120',
            'price'    => 'required|integer|min:1',
            'imageUrl' => 'nullable|string|max:500',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($user, $data) {
            $user = $user->lockForUpdate()->find($user->id);
            if ((int) $user->diamonds < $data['price']) {
                return response()->json(['message' => 'Insufficient diamonds'], 422);
            }
            $user->diamonds -= $data['price'];

            $activeFrame    = null;
            $activeFrameImg = null;

            if ($data['kind'] === 'frame') {
                // Resolve/auto-create the catalog entry so a user_frames row can be linked.
                $catalog = $this->resolveFrameCatalog($data['name'], $data['imageUrl'] ?? null, $data['price']);
                $expires = ($catalog->duration_days ?? 0) > 0
                    ? Carbon::now()->addDays((int) $catalog->duration_days)
                    : null;

                // Un-equip every other frame the user owns.
                DB::table('user_frames')
                    ->where('user_id', $user->id)
                    ->update(['is_equipped' => 0, 'updated_at' => now()]);

                // Insert or refresh the purchased row and mark it equipped.
                $existing = DB::table('user_frames')
                    ->where('user_id', $user->id)
                    ->where('frame_id', $catalog->id)
                    ->first();

                if ($existing) {
                    DB::table('user_frames')
                        ->where('id', $existing->id)
                        ->update([
                            'is_equipped' => 1,
                            'expires_at'  => $expires,
                            'acquired_at' => now(),
                            'updated_at'  => now(),
                        ]);
                } else {
                    DB::table('user_frames')->insert([
                        'user_id'     => $user->id,
                        'frame_id'    => $catalog->id,
                        'is_equipped' => 1,
                        'acquired_at' => now(),
                        'expires_at'  => $expires,
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                }

                // Backward-compat: keep users.avatar_frame / avatar_frame_id in sync.
                if (Schema::hasColumn('users', 'avatar_frame')) {
                    $user->avatar_frame = $catalog->code ?: $data['name'];
                }
                if (Schema::hasColumn('users', 'avatar_frame_id')) {
                    $user->avatar_frame_id = $catalog->id;
                }

                $activeFrame    = $catalog->code ?: $data['name'];
                $activeFrameImg = $this->absoluteUrl($catalog->image_url ?: ($data['imageUrl'] ?? null));
            } else {
                // Entry effect
                $catalog = $this->resolveEffectCatalog($data['name'], $data['imageUrl'] ?? null, $data['price']);
                $expires = ($catalog->duration_days ?? 0) > 0
                    ? Carbon::now()->addDays((int) $catalog->duration_days)
                    : null;

                DB::table('user_entry_effects')
                    ->where('user_id', $user->id)
                    ->update(['is_equipped' => 0, 'updated_at' => now()]);

                $existing = DB::table('user_entry_effects')
                    ->where('user_id', $user->id)
                    ->where('effect_id', $catalog->id)
                    ->first();

                if ($existing) {
                    DB::table('user_entry_effects')
                        ->where('id', $existing->id)
                        ->update([
                            'is_equipped' => 1,
                            'expires_at'  => $expires,
                            'acquired_at' => now(),
                            'updated_at'  => now(),
                        ]);
                } else {
                    DB::table('user_entry_effects')->insert([
                        'user_id'     => $user->id,
                        'effect_id'   => $catalog->id,
                        'is_equipped' => 1,
                        'acquired_at' => now(),
                        'expires_at'  => $expires,
                        'created_at'  => now(),
                        'updated_at'  => now(),
                    ]);
                }

                if (Schema::hasColumn('users', 'entry_effect')) {
                    $user->entry_effect = $catalog->code ?: $data['name'];
                }
                if (Schema::hasColumn('users', 'entry_effect_id')) {
                    $user->entry_effect_id = $catalog->id;
                }
            }

            $user->save();

            return response()->json([
                'message'        => 'Purchased',
                'diamonds'       => (int) $user->diamonds,
                'avatarFrame'    => Schema::hasColumn('users', 'avatar_frame') ? $user->avatar_frame : $activeFrame,
                'entryEffect'    => Schema::hasColumn('users', 'entry_effect') ? $user->entry_effect : null,
                'activeFrame'    => $activeFrame,
                'activeFrameImg' => $activeFrameImg,
            ]);
        });
    }

    /**
     * Equip a previously-purchased shop item.
     * Body: { kind: 'frame'|'effect', name: string }
     */
    public function equipItem(Request $request)
    {
        $data = $request->validate([
            'kind' => 'required|in:frame,effect',
            'name' => 'required|string|max:120',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($user, $data) {
            if ($data['kind'] === 'frame') {
                $catalog = DB::table('frame_catalog')
                    ->where('code', $data['name'])
                    ->orWhere('name', $data['name'])
                    ->first();
                if (!$catalog) return response()->json(['message' => 'Frame not found'], 404);

                $owned = DB::table('user_frames')
                    ->where('user_id', $user->id)
                    ->where('frame_id', $catalog->id)
                    ->first();
                if (!$owned) return response()->json(['message' => 'Not owned'], 403);

                DB::table('user_frames')->where('user_id', $user->id)->update(['is_equipped' => 0, 'updated_at' => now()]);
                DB::table('user_frames')->where('id', $owned->id)->update(['is_equipped' => 1, 'updated_at' => now()]);

                if (Schema::hasColumn('users', 'avatar_frame')) {
                    DB::table('users')->where('id', $user->id)->update(['avatar_frame' => $catalog->code ?: $data['name']]);
                }
                if (Schema::hasColumn('users', 'avatar_frame_id')) {
                    DB::table('users')->where('id', $user->id)->update(['avatar_frame_id' => $catalog->id]);
                }

                return response()->json([
                    'ok'             => true,
                    'activeFrame'    => $catalog->code ?: $data['name'],
                    'activeFrameImg' => $this->absoluteUrl($catalog->image_url),
                ]);
            }

            $catalog = DB::table('entry_effect_catalog')
                ->where('code', $data['name'])
                ->orWhere('name', $data['name'])
                ->first();
            if (!$catalog) return response()->json(['message' => 'Effect not found'], 404);

            $owned = DB::table('user_entry_effects')
                ->where('user_id', $user->id)
                ->where('effect_id', $catalog->id)
                ->first();
            if (!$owned) return response()->json(['message' => 'Not owned'], 403);

            DB::table('user_entry_effects')->where('user_id', $user->id)->update(['is_equipped' => 0, 'updated_at' => now()]);
            DB::table('user_entry_effects')->where('id', $owned->id)->update(['is_equipped' => 1, 'updated_at' => now()]);

            if (Schema::hasColumn('users', 'entry_effect')) {
                DB::table('users')->where('id', $user->id)->update(['entry_effect' => $catalog->code ?: $data['name']]);
            }

            return response()->json(['ok' => true]);
        });
    }

    /**
     * Resolve (or create) a frame_catalog row for the given name/code.
     * The frontend today posts the frame's display code (e.g. "egol", "king")
     * — we upsert into the catalog so a user_frames row can be linked.
     */
    private function resolveFrameCatalog(string $name, ?string $imageUrl, int $price)
    {
        $row = DB::table('frame_catalog')
            ->where('code', $name)
            ->orWhere('name', $name)
            ->first();

        if ($row) {
            // Refresh image_url if the client provided a newer one.
            if ($imageUrl && $imageUrl !== $row->image_url) {
                DB::table('frame_catalog')->where('id', $row->id)->update([
                    'image_url' => $imageUrl,
                    'updated_at' => now(),
                ]);
                $row->image_url = $imageUrl;
            }
            return $row;
        }

        $id = DB::table('frame_catalog')->insertGetId([
            'code'          => $name,
            'name'          => $name,
            'image_url'     => $imageUrl ?: '',
            'price_coins'   => $price,
            'rarity'        => 'common',
            'duration_days' => 30,
            'is_active'     => 1,
            'sort_order'    => 0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
        return DB::table('frame_catalog')->where('id', $id)->first();
    }

    private function resolveEffectCatalog(string $name, ?string $imageUrl, int $price)
    {
        $row = DB::table('entry_effect_catalog')
            ->where('code', $name)
            ->orWhere('name', $name)
            ->first();
        if ($row) return $row;

        $id = DB::table('entry_effect_catalog')->insertGetId([
            'code'          => $name,
            'name'          => $name,
            'animation_url' => $imageUrl ?: '',
            'preview_url'   => $imageUrl,
            'price_coins'   => $price,
            'rarity'        => 'common',
            'duration_days' => 30,
            'is_active'     => 1,
            'sort_order'    => 0,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
        return DB::table('entry_effect_catalog')->where('id', $id)->first();
    }

    private function absoluteUrl(?string $url): ?string
    {
        if (!$url) return null;
        if (preg_match('#^https?://#i', $url)) return $url;
        return url(ltrim($url, '/'));
    }

    /**
     * Send a gift. Deducts diamonds from sender, credits r_coins to receiver (if any),
     * and logs the transaction in gift_transactions.
     * Body: { giftName, giftIcon?, diamonds, rCoins, receiverId?, roomType?, roomId? }
     */
    public function sendGift(Request $request)
    {
        $data = $request->validate([
            'giftName'   => 'required|string|max:64',
            'giftIcon'   => 'nullable|string|max:16',
            'diamonds'   => 'required|integer|min:1',
            'rCoins'     => 'required|integer|min:0',
            'receiverId' => 'nullable|integer|exists:users,id',
            'roomType'   => 'nullable|string|max:32',
            'roomId'     => 'nullable|string|max:64',
        ]);

        $sender = $request->user();

        return DB::transaction(function () use ($sender, $data) {
            $sender = $sender->lockForUpdate()->find($sender->id);
            if ((int) $sender->diamonds < $data['diamonds']) {
                return response()->json(['message' => 'পর্যাপ্ত ব্যালেন্স না থাকায় গিফট সেন্ড করা সম্ভব হচ্ছে না।'], 422);
            }
            $sender->diamonds -= $data['diamonds'];
            if (Schema::hasColumn('users', 'coins')) {
                $sender->coins = max(0, (int) ($sender->coins ?? 0) - (int) $data['diamonds']);
            }
            $sender->save();

            $receiverWallet = null;
            if (!empty($data['receiverId']) && $data['receiverId'] !== $sender->id) {
                $receiver = \App\Models\User::lockForUpdate()->find($data['receiverId']);
                if ($receiver) {
                    $receiver->r_coins = (int) $receiver->r_coins + (int) $data['rCoins'];
                    // C-Coin / host earnings — credit receiver so their wallet card updates.
                    if (Schema::hasColumn('users', 'host_earnings')) {
                        $receiver->host_earnings = (int) ($receiver->host_earnings ?? 0) + (int) $data['rCoins'];
                    }
                    $receiver->save();
                    $receiverWallet = [
                        'id'       => $receiver->id,
                        'rCoins'   => (int) $receiver->r_coins,
                        'earnings' => (int) ($receiver->host_earnings ?? 0),
                    ];

                    // Credit host_reports so target/salary logic sees this earning.
                    try {
                        HostReportHelper::addCoins(
                            (int) $receiver->id,
                            (int) $data['rCoins'],
                            (int) $data['diamonds']
                        );
                    } catch (\Throwable $e) {
                        \Log::warning('HostReportHelper gift upsert failed: '.$e->getMessage());
                    }
                }
            }

            $id = DB::table('gift_transactions')->insertGetId([
                'sender_id'   => $sender->id,
                'receiver_id' => $data['receiverId'] ?? null,
                'gift_name'   => $data['giftName'],
                'gift_icon'   => $data['giftIcon'] ?? null,
                'diamonds'    => $data['diamonds'],
                'r_coins'     => $data['rCoins'],
                'room_type'   => $data['roomType'] ?? null,
                'room_id'     => $data['roomId'] ?? null,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);

            if (($data['roomType'] ?? null) === 'party' && !empty($data['roomId'])) {
                DB::table('party_rooms')
                    ->where('id', $data['roomId'])
                    ->increment('total_diamonds', (int) $data['diamonds'], ['updated_at' => now()]);
            }

            if (($data['roomType'] ?? null) === 'live' && !empty($data['roomId'])) {
                DB::table('live_rooms')
                    ->where('id', $data['roomId'])
                    ->increment('total_diamonds', (int) $data['diamonds'], ['updated_at' => now()]);
            }

            return response()->json([
                'message'    => 'Gift sent',
                'id'         => $id,
                'diamonds'   => (int) $sender->diamonds,
                'rCoins'     => (int) $sender->r_coins,
                'earnings'   => (int) ($sender->host_earnings ?? 0),
                'receiver'   => $receiverWallet,
            ]);
        });
    }

    // GET /api/reseller/dashboard
    public function resellerDashboard(Request $request)
    {
        $reseller = $request->user();
        $this->authorizeReseller($reseller);

        $transfers = DB::table('wallet_transfers')
            ->leftJoin('users as receivers', 'wallet_transfers.receiver_id', '=', 'receivers.id')
            ->where('wallet_transfers.sender_id', $reseller->id)
            ->orderByDesc('wallet_transfers.id')
            ->limit(50)
            ->get([
                'wallet_transfers.id',
                'wallet_transfers.receiver_id',
                'receivers.name as receiver_name',
                'receivers.email as receiver_email',
                'wallet_transfers.receiver_role',
                'wallet_transfers.diamonds',
                'wallet_transfers.r_coins',
                'wallet_transfers.note',
                'wallet_transfers.created_at',
            ]);

        return response()->json([
            'wallet' => [
                'diamonds' => (int) $reseller->diamonds,
                'rCoins' => (int) $reseller->r_coins,
            ],
            'transfers' => $transfers,
        ]);
    }

    // POST /api/reseller/transfer
    public function resellerTransfer(Request $request)
    {
        $sender = $request->user();
        $this->authorizeReseller($sender);

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

        if ((int) $data['receiver_id'] === (int) $sender->id) {
            return response()->json(['message' => 'You cannot transfer to yourself.'], 422);
        }

        return DB::transaction(function () use ($sender, $data, $diamonds, $rCoins) {
            $sender = User::lockForUpdate()->findOrFail($sender->id);
            $receiver = User::lockForUpdate()->findOrFail((int) $data['receiver_id']);

            if ((int) $sender->diamonds < $diamonds || (int) $sender->r_coins < $rCoins) {
                return response()->json(['message' => 'Insufficient reseller wallet balance.'], 422);
            }

            $sender->diamonds = (int) $sender->diamonds - $diamonds;
            $sender->r_coins = (int) $sender->r_coins - $rCoins;
            $sender->save();

            $receiver->diamonds = (int) $receiver->diamonds + $diamonds;
            $receiver->r_coins = (int) $receiver->r_coins + $rCoins;
            $receiver->save();

            $id = DB::table('wallet_transfers')->insertGetId([
                'sender_id' => $sender->id,
                'receiver_id' => $receiver->id,
                'sender_role' => $this->resolveRole($sender),
                'receiver_role' => $this->resolveRole($receiver),
                'diamonds' => $diamonds,
                'r_coins' => $rCoins,
                'source' => 'reseller',
                'note' => $data['note'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'message' => 'Transfer complete',
                'transferId' => $id,
                'wallet' => [
                    'diamonds' => (int) $sender->diamonds,
                    'rCoins' => (int) $sender->r_coins,
                ],
                'receiver' => [
                    'id' => $receiver->id,
                    'name' => $receiver->name,
                    'diamonds' => (int) $receiver->diamonds,
                    'rCoins' => (int) $receiver->r_coins,
                    'role' => $this->resolveRole($receiver),
                ],
            ]);
        });
    }

    private function authorizeReseller(User $user): void
    {
        $role = $this->resolveRole($user);
        if (! in_array($role, ['admin', 'reseller'], true)) {
            abort(403, 'Reseller only');
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
