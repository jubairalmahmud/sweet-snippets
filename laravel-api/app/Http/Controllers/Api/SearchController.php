<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
    public function users(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '') return ['data' => []];
        $rows = DB::table('users')
            ->where(function ($w) use ($q) {
                $w->where('name', 'like', "%{$q}%")
                  ->orWhere('email', 'like', "%{$q}%");
            })
            ->orderByDesc('id')->limit(50)
            ->get(['id','name','email','avatar','bio']);
        return ['data' => $rows->map(fn ($u) => [
            'id'     => (int) $u->id,
            'name'   => $u->name,
            'email'  => $u->email,
            'avatar' => $u->avatar ?? null,
            'bio'    => $u->bio ?? null,
        ])->values()];
    }

    public function rooms(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $query = DB::table('live_rooms as r')
            ->leftJoin('users as u', 'u.id', '=', 'r.host_id')
            ->where('r.live', true);
        if ($q !== '') {
            $query->where(function ($w) use ($q) {
                $w->where('r.title', 'like', "%{$q}%")
                  ->orWhere('u.name', 'like', "%{$q}%");
            });
        }
        $rows = $query->orderByDesc('r.viewer_count')->limit(50)
            ->get(['r.id','r.title','r.cover','r.category','r.viewer_count','u.name as host_name','u.avatar_url as host_avatar','r.host_id']);
        return ['data' => $rows->map(fn ($r) => [
            'id'          => (int) $r->id,
            'title'       => $r->title,
            'cover'       => $r->cover,
            'category'    => $r->category,
            'viewerCount' => (int) $r->viewer_count,
            'hostId'      => (int) $r->host_id,
            'hostName'    => $r->host_name,
            'hostAvatar'  => $r->host_avatar,
        ])->values()];
    }
}
