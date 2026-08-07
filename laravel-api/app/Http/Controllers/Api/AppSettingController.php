<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AppSettingController extends Controller
{
    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) abort(403, 'Admin only');
    }

    private function decode($v)
    {
        if ($v === null) return null;
        $d = json_decode($v, true);
        return json_last_error() === JSON_ERROR_NONE ? $d : $v;
    }

    // Public read of all settings (safe values only — admin uses adminIndex for full)
    public function index()
    {
        $rows = DB::table('app_settings')->get();
        $out = [];
        foreach ($rows as $r) $out[$r->key] = $this->decode($r->value);
        return ['data' => $out];
    }

    public function adminIndex(Request $request)
    {
        $this->authorizeAdmin($request);
        $rows = DB::table('app_settings')->get();
        $out = [];
        foreach ($rows as $r) {
            $out[] = [
                'key' => $r->key,
                'value' => $this->decode($r->value),
                'created_at' => $r->created_at,
                'updated_at' => $r->updated_at,
            ];
        }
        return ['data' => $out];
    }

    public function upsert(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'key'   => 'required|string|max:64',
            'value' => 'nullable',
        ]);
        $val = is_scalar($data['value']) ? (string) $data['value'] : json_encode($data['value']);
        DB::table('app_settings')->updateOrInsert(
            ['key' => $data['key']],
            ['value' => $val, 'updated_at' => now(), 'created_at' => now()]
        );

        DB::table('audit_logs')->insert([
            'admin_id'    => $request->user()->id,
            'action'      => 'set_setting',
            'target_type' => 'setting',
            'target_id'   => null,
            'meta'        => json_encode(['key' => $data['key']]),
            'ip'          => $request->ip(),
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        return ['ok' => true, 'key' => $data['key'], 'value' => $this->decode($val)];
    }

    public function destroy(Request $request, string $key)
    {
        $this->authorizeAdmin($request);
        DB::table('app_settings')->where('key', $key)->delete();
        return ['ok' => true];
    }
}
