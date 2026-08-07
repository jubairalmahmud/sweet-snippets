<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuditLogController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) abort(403, 'Admin only');
    }

    public function index(Request $request)
    {
        $this->authorizeAdmin($request);
        $q = DB::table('audit_logs as l')
            ->leftJoin('users as u', 'u.id', '=', 'l.admin_id');
        if ($a = $request->query('action'))   $q->where('l.action', $a);
        if ($t = $request->query('admin_id')) $q->where('l.admin_id', (int) $t);
        $rows = $q->orderByDesc('l.id')->limit(500)
            ->get(['l.*','u.name as admin_name']);
        return ['data' => $rows->map(fn ($r) => [
            'id'         => (int) $r->id,
            'adminId'    => (int) $r->admin_id,
            'adminName'  => $r->admin_name,
            'action'     => $r->action,
            'targetType' => $r->target_type,
            'targetId'   => $r->target_id ? (int) $r->target_id : null,
            'meta'       => $r->meta ? json_decode($r->meta, true) : null,
            'ip'         => $r->ip,
            'createdAt'  => $r->created_at,
        ])->values()];
    }
}
