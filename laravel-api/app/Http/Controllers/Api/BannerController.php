<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BannerController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || !($user->is_admin ?? false)) {
            abort(403, 'Admin only');
        }
    }

    private function shape(object $b): array
    {
        return [
            'id'         => (int) $b->id,
            'title'      => $b->title,
            'subtitle'   => $b->subtitle,
            'image'      => $b->image,
            'link'       => $b->link,
            'placement'  => $b->placement,
            'sortOrder'  => (int) $b->sort_order,
            'active'     => (bool) $b->active,
            'createdAt'  => $b->created_at,
            'updatedAt'  => $b->updated_at,
        ];
    }

    private function assertMedia(string $img): void
    {
        if (preg_match('#^https?://#i', $img)) return;
        if (preg_match('#^data:image/(png|jpe?g|webp|gif);base64,#i', $img)) {
            // ~3MB cap on banner
            if (strlen($img) > 3 * 1024 * 1024 * 1.4) abort(422, 'Image too large (max 3MB)');
            return;
        }
        if (preg_match('#^data:video/mp4;base64,#i', $img)) {
            // ~8MB cap on short promo clips
            if (strlen($img) > 8 * 1024 * 1024 * 1.4) abort(422, 'Video too large (max 8MB)');
            return;
        }
        abort(422, 'Invalid media format');
    }

    // Public (any auth user) list — only active, optional placement filter
    public function index(Request $request)
    {
        $q = DB::table('banners')->where('active', true);
        if ($p = $request->query('placement')) $q->where('placement', $p);
        $rows = $q->orderBy('sort_order')->orderByDesc('id')->limit(100)->get();
        return ['data' => $rows->map(fn ($r) => $this->shape($r))->values()];
    }

    // Admin list — all banners
    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        $q = DB::table('banners');
        if ($p = $request->query('placement')) $q->where('placement', $p);
        $rows = $q->orderBy('placement')->orderBy('sort_order')->orderByDesc('id')->limit(500)->get();
        return ['data' => $rows->map(fn ($r) => $this->shape($r))->values()];
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'title'      => 'nullable|string|max:200',
            'subtitle'   => 'nullable|string|max:300',
            'image'      => 'required|string',
            'link'       => 'nullable|string|max:500',
            'placement'  => 'nullable|string|max:32',
            'sortOrder'  => 'nullable|integer',
            'active'     => 'nullable|boolean',
        ]);
        $this->assertMedia($data['image']);

        $id = DB::table('banners')->insertGetId([
            'title'      => $data['title'] ?? null,
            'subtitle'   => $data['subtitle'] ?? null,
            'image'      => $data['image'],
            'link'       => $data['link'] ?? null,
            'placement'  => $data['placement'] ?? 'home',
            'sort_order' => $data['sortOrder'] ?? 0,
            'active'     => $data['active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $row = DB::table('banners')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    public function update(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $row = DB::table('banners')->where('id', $id)->first();
        if (!$row) abort(404, 'Banner not found');

        $data = $request->validate([
            'title'      => 'nullable|string|max:200',
            'subtitle'   => 'nullable|string|max:300',
            'image'      => 'nullable|string',
            'link'       => 'nullable|string|max:500',
            'placement'  => 'nullable|string|max:32',
            'sortOrder'  => 'nullable|integer',
            'active'     => 'nullable|boolean',
        ]);

        $patch = ['updated_at' => now()];
        foreach (['title','subtitle','link','placement'] as $k) {
            if (array_key_exists($k, $data)) $patch[$k] = $data[$k];
        }
        if (array_key_exists('sortOrder', $data)) $patch['sort_order'] = (int) $data['sortOrder'];
        if (array_key_exists('active', $data))    $patch['active']     = (bool) $data['active'];
        if (!empty($data['image'])) {
            $this->assertMedia($data['image']);
            $patch['image'] = $data['image'];
        }

        DB::table('banners')->where('id', $id)->update($patch);
        $row = DB::table('banners')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    public function destroy(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $deleted = DB::table('banners')->where('id', $id)->delete();
        if (!$deleted) abort(404, 'Banner not found');
        return ['ok' => true];
    }
}
