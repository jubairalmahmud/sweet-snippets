<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;

class EntryEffectController extends Controller
{
    private function ensureTables(): void
    {
        if (!Schema::hasTable('entry_effect_catalog')) {
            try {
                Schema::create('entry_effect_catalog', function ($table) {
                    $table->id();
                    $table->string('code', 64)->unique();
                    $table->string('name', 120);
                    $table->string('animation_url', 500)->nullable();
                    $table->string('preview_url', 500)->nullable();
                    $table->unsignedInteger('price_coins')->default(0);
                    $table->unsignedInteger('vip_level_required')->default(0);
                    $table->string('rarity', 32)->default('common');
                    $table->unsignedInteger('duration_days')->default(30);
                    $table->boolean('is_active')->default(true);
                    $table->unsignedInteger('sort_order')->default(0);
                    $table->timestamps();
                });
            } catch (\Throwable $e) {}
        }

        if (!Schema::hasTable('user_entry_effects')) {
            try {
                Schema::create('user_entry_effects', function ($table) {
                    $table->id();
                    $table->unsignedBigInteger('user_id');
                    $table->unsignedBigInteger('effect_id');
                    $table->timestamp('acquired_at')->nullable();
                    $table->timestamp('expires_at')->nullable();
                    $table->boolean('is_equipped')->default(false);
                    $table->timestamps();
                });
            } catch (\Throwable $e) {}
        }
    }

    public function index()
    {
        $this->ensureTables();
        $rows = DB::table('entry_effect_catalog')
            ->where('is_active', 1)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        return response()->json(['data' => $rows]);
    }

    public function myEffects(Request $r)
    {
        $this->ensureTables();
        $userId = $r->user()->id;
        $rows = DB::table('user_entry_effects as ue')
            ->join('entry_effect_catalog as ec', 'ec.id', '=', 'ue.effect_id')
            ->where('ue.user_id', $userId)
            ->where(function ($q) {
                $q->whereNull('ue.expires_at')->orWhere('ue.expires_at', '>', now());
            })
            ->select('ue.id', 'ue.effect_id', 'ue.is_equipped', 'ue.expires_at',
                     'ec.code', 'ec.name', 'ec.animation_url', 'ec.preview_url', 'ec.rarity')
            ->orderByDesc('ue.is_equipped')
            ->get();
        return response()->json(['data' => $rows]);
    }

    public function equip(Request $r, $id)
    {
        $this->ensureTables();
        $userId = $r->user()->id;
        $codeParam = $r->input('code') ?: $r->input('effect_id') ?: $id;

        $catalog = DB::table('entry_effect_catalog')
            ->where('id', is_numeric($id) ? (int)$id : 0)
            ->orWhere('code', (string)$codeParam)
            ->orWhere('name', (string)$codeParam)
            ->first();

        $effectId = $catalog ? $catalog->id : (is_numeric($id) ? (int)$id : 0);
        $codeToSave = $catalog ? $catalog->code : (string)$codeParam;

        DB::transaction(function () use ($userId, $effectId, $codeToSave) {
            if (Schema::hasTable('user_entry_effects')) {
                DB::table('user_entry_effects')->where('user_id', $userId)->update(['is_equipped' => 0, 'updated_at' => now()]);
                if ($effectId > 0) {
                    DB::table('user_entry_effects')->where('user_id', $userId)->where('effect_id', $effectId)->update(['is_equipped' => 1, 'updated_at' => now()]);
                }
            }
            if (Schema::hasColumn('users', 'entry_effect')) {
                DB::table('users')->where('id', $userId)->update(['entry_effect' => $codeToSave]);
            }
        });

        return response()->json(['ok' => true, 'entry_effect' => $codeToSave]);
    }

    public function unequip(Request $r)
    {
        $this->ensureTables();
        $userId = $r->user()->id;
        DB::transaction(function () use ($userId) {
            if (Schema::hasTable('user_entry_effects')) {
                DB::table('user_entry_effects')->where('user_id', $userId)->update(['is_equipped' => 0, 'updated_at' => now()]);
            }
            if (Schema::hasColumn('users', 'entry_effect')) {
                DB::table('users')->where('id', $userId)->update(['entry_effect' => null]);
            }
        });
        return response()->json(['ok' => true]);
    }

    public function buy(Request $r, $id)
    {
        $this->ensureTables();
        $user = $r->user();
        $codeParam = $r->input('code') ?: $id;

        $catalog = DB::table('entry_effect_catalog')
            ->where('id', is_numeric($id) ? (int)$id : 0)
            ->orWhere('code', (string)$codeParam)
            ->orWhere('name', (string)$codeParam)
            ->first();

        if (!$catalog) {
            $catId = DB::table('entry_effect_catalog')->insertGetId([
                'code' => (string)$codeParam,
                'name' => (string)$codeParam,
                'animation_url' => '',
                'price_coins' => (int)$r->input('price', 10000),
                'duration_days' => (int)$r->input('days', 30),
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $catalog = DB::table('entry_effect_catalog')->where('id', $catId)->first();
        }

        return DB::transaction(function () use ($user, $catalog, $r) {
            $u = \App\Models\User::lockForUpdate()->find($user->id);

            $price = (int) ($catalog->price_coins ?? $r->input('price', 10000));
            $days = (int) ($catalog->duration_days ?? 30);

            $useWalletTable = Schema::hasTable('wallets');
            if ($useWalletTable) {
                $wallet = DB::table('wallets')->where('user_id', $u->id)->lockForUpdate()->first();
                if ($wallet && $wallet->r_coins >= $price) {
                    DB::table('wallets')->where('user_id', $u->id)
                        ->update(['r_coins' => $wallet->r_coins - $price, 'updated_at' => now()]);
                } else if ($u->diamonds >= $price) {
                    $u->diamonds = $u->diamonds - $price;
                }
            } else {
                if ($u->diamonds >= $price) {
                    $u->diamonds = $u->diamonds - $price;
                }
            }

            $expires = $days > 0 ? Carbon::now()->addDays($days) : null;

            DB::table('user_entry_effects')
                ->where('user_id', $u->id)
                ->update(['is_equipped' => 0, 'updated_at' => now()]);

            $existing = DB::table('user_entry_effects')
                ->where('user_id', $u->id)
                ->where('effect_id', $catalog->id)
                ->first();

            if ($existing) {
                DB::table('user_entry_effects')->where('id', $existing->id)->update([
                    'is_equipped' => 1,
                    'expires_at' => $expires,
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('user_entry_effects')->insert([
                    'user_id' => $u->id,
                    'effect_id' => $catalog->id,
                    'is_equipped' => 1,
                    'acquired_at' => now(),
                    'expires_at' => $expires,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            if (Schema::hasColumn('users', 'entry_effect')) {
                $u->entry_effect = $catalog->code ?: $catalog->name;
            }
            $u->save();

            return response()->json([
                'ok' => true,
                'entry_effect' => $catalog->code ?: $catalog->name,
                'activeRide' => $catalog->code ?: $catalog->name,
                'expires_at' => $expires,
            ]);
        });
    }

    public function store(Request $r)
    {
        $this->ensureTables();
        $data = $r->validate([
            'code' => 'required|string|max:64|unique:entry_effect_catalog,code',
            'name' => 'required|string|max:120',
            'animation_url' => 'required|string|max:500',
            'preview_url' => 'nullable|string|max:500',
            'price_coins' => 'integer|min:0',
            'vip_level_required' => 'integer|min:0',
            'rarity' => 'in:common,rare,epic,legendary',
            'duration_days' => 'integer|min:0',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ]);
        $id = DB::table('entry_effect_catalog')->insertGetId($data + ['created_at' => now(), 'updated_at' => now()]);
        return response()->json(['id' => $id], 201);
    }

    public function update(Request $r, $id)
    {
        $this->ensureTables();
        $data = $r->validate([
            'name' => 'sometimes|string|max:120',
            'animation_url' => 'sometimes|string|max:500',
            'preview_url' => 'nullable|string|max:500',
            'price_coins' => 'sometimes|integer|min:0',
            'vip_level_required' => 'sometimes|integer|min:0',
            'rarity' => 'sometimes|in:common,rare,epic,legendary',
            'duration_days' => 'sometimes|integer|min:0',
            'is_active' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer',
        ]);
        DB::table('entry_effect_catalog')->where('id', $id)->update($data + ['updated_at' => now()]);
        return response()->json(['ok' => true]);
    }

    public function destroy($id)
    {
        $this->ensureTables();
        DB::table('entry_effect_catalog')->where('id', $id)->delete();
        return response()->json(['ok' => true]);
    }
}
