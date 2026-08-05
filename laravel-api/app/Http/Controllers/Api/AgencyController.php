<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AgencyController extends Controller
{
    // GET /api/agencies — public list for hosts to discover codes
    public function index()
    {
        $agencies = DB::table('agencies')->orderByDesc('id')->get();
        return response()->json(['agencies' => $agencies]);
    }

    // POST /api/admin/agencies
    public function store(Request $request)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'name'             => 'required|string|max:120',
            'code'             => 'required|string|max:32|unique:agencies,code',
            'commission'       => 'nullable|integer|min:0|max:100',
            'monthlyTarget'    => 'nullable|integer|min:0',
            'targetHours'      => 'nullable|integer|min:0',
            'baseSalaryRules'  => 'nullable|string|max:500',
        ]);

        $id = DB::table('agencies')->insertGetId([
            'name'              => $data['name'],
            'code'              => strtoupper($data['code']),
            'commission'        => $data['commission'] ?? 10,
            'hosts_count'       => 0,
            'status'            => 'active',
            'monthly_target'    => $data['monthlyTarget'] ?? 100000,
            'target_hours'      => $data['targetHours'] ?? 40,
            'base_salary_rules' => $data['baseSalaryRules'] ?? null,
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);

        return response()->json(['agency' => DB::table('agencies')->find($id)], 201);
    }

    // PATCH /api/admin/agencies/{id}
    public function update(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'name'             => 'sometimes|string|max:120',
            'commission'       => 'sometimes|integer|min:0|max:100',
            'status'           => 'sometimes|in:active,suspended',
            'monthlyTarget'    => 'sometimes|integer|min:0',
            'targetHours'      => 'sometimes|integer|min:0',
            'baseSalaryRules'  => 'sometimes|string|max:500',
        ]);

        $patch = [];
        foreach (['name', 'commission', 'status'] as $k) if (isset($data[$k])) $patch[$k] = $data[$k];
        if (isset($data['monthlyTarget']))   $patch['monthly_target']    = $data['monthlyTarget'];
        if (isset($data['targetHours']))     $patch['target_hours']      = $data['targetHours'];
        if (isset($data['baseSalaryRules'])) $patch['base_salary_rules'] = $data['baseSalaryRules'];
        $patch['updated_at'] = now();

        DB::table('agencies')->where('id', $id)->update($patch);
        return response()->json(['agency' => DB::table('agencies')->find($id)]);
    }

    // DELETE /api/admin/agencies/{id}
    public function destroy(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        DB::table('agencies')->where('id', $id)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    // ---------- Hosts ----------

    // GET /api/admin/agencies/{code}/hosts
    public function hosts(Request $request, string $code)
    {
        $this->authorizeAdmin($request);
        $hosts = DB::table('agency_hosts')->where('agency_code', strtoupper($code))->orderByDesc('id')->get();
        return response()->json(['hosts' => $hosts]);
    }

    // POST /api/admin/agencies/{code}/hosts
    public function addHost(Request $request, string $code)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'name'     => 'required|string|max:120',
            'username' => 'required|string|max:64',
            'userId'   => 'nullable|integer|exists:users,id',
        ]);
        $code = strtoupper($code);

        return DB::transaction(function () use ($code, $data) {
            $id = DB::table('agency_hosts')->insertGetId([
                'user_id'           => $data['userId'] ?? null,
                'name'              => $data['name'],
                'username'          => $data['username'],
                'status'            => 'Active',
                'live_hours'        => 0,
                'diamonds_received' => 0,
                'agency_code'       => $code,
                'salary_released'   => false,
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);
            DB::table('agencies')->where('code', $code)->increment('hosts_count');
            return response()->json(['host' => DB::table('agency_hosts')->find($id)], 201);
        });
    }

    // PATCH /api/admin/hosts/{id}
    public function updateHost(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        $data = $request->validate([
            'status'           => 'sometimes|in:Pending,Active,Suspended',
            'liveHours'        => 'sometimes|integer|min:0',
            'diamondsReceived' => 'sometimes|integer|min:0',
            'salaryReleased'   => 'sometimes|boolean',
        ]);
        $patch = [];
        if (isset($data['status']))           $patch['status']            = $data['status'];
        if (isset($data['liveHours']))        $patch['live_hours']        = $data['liveHours'];
        if (isset($data['diamondsReceived'])) $patch['diamonds_received'] = $data['diamondsReceived'];
        if (isset($data['salaryReleased']))   $patch['salary_released']   = $data['salaryReleased'];
        $patch['updated_at'] = now();

        DB::table('agency_hosts')->where('id', $id)->update($patch);
        $host = DB::table('agency_hosts')->find($id);
        if (($data['status'] ?? null) === 'Active' && $host && $host->user_id) {
            DB::table('agency_hosts')
                ->where('user_id', $host->user_id)
                ->where('id', '!=', $id)
                ->update(['status' => 'Active', 'updated_at' => now()]);
        }
        return response()->json(['host' => DB::table('agency_hosts')->find($id)]);
    }

    // DELETE /api/admin/hosts/{id}
    public function removeHost(Request $request, int $id)
    {
        $this->authorizeAdmin($request);
        return DB::transaction(function () use ($id) {
            $host = DB::table('agency_hosts')->find($id);
            if (!$host) return response()->json(['message' => 'Not found'], 404);
            DB::table('agency_hosts')->where('id', $id)->delete();
            DB::table('agencies')->where('code', $host->agency_code)->where('hosts_count', '>', 0)->decrement('hosts_count');
            return response()->json(['message' => 'Removed']);
        });
    }

    // ---------- Self-bind (host) ----------

    // GET /api/me/agency
    public function me(Request $request)
    {
        $user = $request->user();
        $host = DB::table('agency_hosts')
            ->where('user_id', $user->id)
            ->orderByRaw("CASE status WHEN 'Active' THEN 0 WHEN 'Pending' THEN 1 ELSE 2 END")
            ->orderByDesc('id')
            ->first();
        return response()->json(['host' => $host]);
    }

    // POST /api/me/agency  body: { code }
    public function bindMe(Request $request)
    {
        $data = $request->validate([
            'code' => 'required|string|max:32',
        ]);
        $user = $request->user();
        $code = strtoupper($data['code']);

        $agency = DB::table('agencies')->where('code', $code)->first();
        if (!$agency) return response()->json(['message' => 'Invalid agency code'], 404);

        $exists = DB::table('agency_hosts')->where('user_id', $user->id)->first();
        if ($exists) {
            DB::table('agency_hosts')->where('user_id', $user->id)->update([
                'agency_code' => $code,
                'status'      => 'Pending',
                'updated_at'  => now(),
            ]);
        } else {
            DB::table('agency_hosts')->insert([
                'user_id'           => $user->id,
                'name'              => $user->name,
                'username'          => $user->email ? explode('@', $user->email)[0] : 'user' . $user->id,
                'status'            => 'Pending',
                'live_hours'        => 0,
                'diamonds_received' => 0,
                'agency_code'       => $code,
                'salary_released'   => false,
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);
            DB::table('agencies')->where('code', $code)->increment('hosts_count');
        }
        return response()->json(['message' => 'Host request submitted for admin approval', 'code' => $code, 'status' => 'Pending']);
    }

    // DELETE /api/me/agency
    public function unbindMe(Request $request)
    {
        $user = $request->user();
        $host = DB::table('agency_hosts')->where('user_id', $user->id)->first();
        if ($host) {
            DB::table('agency_hosts')->where('id', $host->id)->delete();
            DB::table('agencies')->where('code', $host->agency_code)->where('hosts_count', '>', 0)->decrement('hosts_count');
        }
        return response()->json(['message' => 'Unbound']);
    }

    private function authorizeAdmin(Request $request): void
    {
        $u = $request->user();
        if (!$u || !($u->is_admin ?? false)) {
            abort(403, 'Admin only');
        }
    }
}
