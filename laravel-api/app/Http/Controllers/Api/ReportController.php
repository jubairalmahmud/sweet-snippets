<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FcmService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) abort(403, 'Admin only');
    }

    private function shape(object $r): array
    {
        return [
            'id'          => (int) $r->id,
            'reporterId'  => (int) $r->reporter_id,
            'targetType'  => $r->target_type,
            'targetId'    => (int) $r->target_id,
            'reason'      => $r->reason,
            'description' => $r->description,
            'status'      => $r->status,
            'reviewedBy'  => $r->reviewed_by ? (int) $r->reviewed_by : null,
            'reviewedAt'  => $r->reviewed_at,
            'createdAt'   => $r->created_at,
        ];
    }

    public function store(Request $request)
    {
        $uid  = $request->user()->id;
        $data = $request->validate([
            'targetType'  => 'required|string|in:user,room,message',
            'targetId'    => 'required|integer',
            'reason'      => 'required|string|max:64',
            'description' => 'nullable|string|max:1000',
        ]);

        $id = DB::table('reports')->insertGetId([
            'reporter_id' => $uid,
            'target_type' => $data['targetType'],
            'target_id'   => $data['targetId'],
            'reason'      => $data['reason'],
            'description' => $data['description'] ?? null,
            'status'      => 'pending',
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        $row = DB::table('reports')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }

    public function mine(Request $request)
    {
        $uid = $request->user()->id;
        $rows = DB::table('reports')->where('reporter_id', $uid)
            ->orderByDesc('id')->limit(200)->get();
        return ['data' => $rows->map(fn ($r) => $this->shape($r))->values()];
    }

    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        $q = DB::table('reports');
        if ($s = $request->query('status')) $q->where('status', $s);
        $rows = $q->orderByDesc('id')->limit(500)->get();
        return ['data' => $rows->map(fn ($r) => $this->shape($r))->values()];
    }

    public function review(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'status' => 'required|string|in:reviewed,dismissed,actioned',
        ]);
        $row = DB::table('reports')->where('id', $id)->first();
        if (!$row) abort(404, 'Report not found');

        DB::table('reports')->where('id', $id)->update([
            'status'      => $data['status'],
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'updated_at'  => now(),
        ]);

        DB::table('audit_logs')->insert([
            'admin_id'    => $request->user()->id,
            'action'      => 'review_report',
            'target_type' => 'report',
            'target_id'   => $id,
            'meta'        => json_encode(['status' => $data['status']]),
            'ip'          => $request->ip(),
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        // Notify reporter of the outcome
        DB::table('notifications')->insert([
            'user_id'    => $row->reporter_id,
            'type'       => 'report_reviewed',
            'title'      => 'Report ' . $data['status'],
            'body'       => 'Your report has been ' . $data['status'],
            'data'       => json_encode(['reportId' => $id, 'status' => $data['status']]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        try {
            FcmService::sendToUser($row->reporter_id, 'Report ' . $data['status'],
                'Your report has been ' . $data['status'],
                ['type' => 'report_reviewed', 'reportId' => $id]);
        } catch (\Throwable $e) {}

        $row = DB::table('reports')->where('id', $id)->first();
        return ['data' => $this->shape($row)];
    }
}
