<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GiftCatalogController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || !($user->is_admin ?? false)) {
            abort(403, 'Admin only');
        }
    }

    private function shape(object $g): array
    {
        return [
            'id'        => (int) $g->id,
            'name'      => $g->name,
            'emoji'     => $g->emoji,
            'image'     => $g->image,
            'price'     => (int) $g->price,
            'category'  => $g->category,
            'sortOrder' => (int) $g->sort_order,
            'active'    => (bool) $g->active,
            'createdAt' => $g->created_at,
            'updatedAt' => $g->updated_at,
        ];
    }

    private function assertImage(?string $img): void
    {
        if (!$img) return;
        if (preg_match('#^https?://#i', $img)) return;
        if (preg_match('#^data:image/(png|jpe?g|webp|gif);base64,#i', $img)) {
            if (strlen($img) > 2 * 1024 * 1024 * 1.4) abort(422, 'Image too large (max 2MB)');
            return;
        }
        abort(422, 'Invalid image format');
    }

    // Public — active gifts only
    public function index(Request $request)
    {
        $q = DB::table('gift_catalog')->where('active', true);
        if ($c = $request->query('category')) $q->where('category', $c);
        $rows = $q->orderBy('sort_order')->orderBy('price')->limit(500)->get();
        return ['data' => $rows->map(fn ($r) => $this->shape($r))->values()];
    }

    // Admin — all gifts
    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        $rows = DB::table('gift_catalog')
            ->orderBy('category')->orderBy('sort_order')->orderBy('price')
            ->limit(1000)->get();
        return ['data' => $rows->map(fn ($r) => $this->shape($r))->values()];
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'emoji'     => 'nullable|string|max:16',
            'image'     => 'nullable|string',
            'price'     => 'required|integer|min:0',
            'category'  => 'nullable|string|max:32',
            'sortOrder' => 'nullable|integer',
            'active'    => 'nullable|boolean',
        ]);
        $this->assertImage($data['image'] ?? null);

        $id = DB::table('gift_catalog')->insertGetId([
            'name'       => $data['name'],
            'emoji'      => $data['emoji'] ?? null,
            'image'      => $data['image'] ?? null,
            'price'      => (int) $data['price'],
            'category'   => $data['category'] ?? 'basic',
            'sort_order' => $data['sortOrder'] ?? 0,
            'active'     => $data['active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('gift_catalog')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    public function update(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $row = DB::table('gift_catalog')->where('id', $id)->first();
        if (!$row) abort(404, 'Gift not found');

        $data = $request->validate([
            'name'      => 'nullable|string|max:100',
            'emoji'     => 'nullable|string|max:16',
            'image'     => 'nullable|string',
            'price'     => 'nullable|integer|min:0',
            'category'  => 'nullable|string|max:32',
            'sortOrder' => 'nullable|integer',
            'active'    => 'nullable|boolean',
        ]);

        $patch = ['updated_at' => now()];
        foreach (['name','emoji','category'] as $k) {
            if (array_key_exists($k, $data)) $patch[$k] = $data[$k];
        }
        if (array_key_exists('price', $data))     $patch['price']      = (int) $data['price'];
        if (array_key_exists('sortOrder', $data)) $patch['sort_order'] = (int) $data['sortOrder'];
        if (array_key_exists('active', $data))    $patch['active']     = (bool) $data['active'];
        if (array_key_exists('image', $data)) {
            $this->assertImage($data['image']);
            $patch['image'] = $data['image'];
        }

        DB::table('gift_catalog')->where('id', $id)->update($patch);
        $row = DB::table('gift_catalog')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    public function destroy(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $deleted = DB::table('gift_catalog')->where('id', $id)->delete();
        if (!$deleted) abort(404, 'Gift not found');
        return ['ok' => true];
    }
}
