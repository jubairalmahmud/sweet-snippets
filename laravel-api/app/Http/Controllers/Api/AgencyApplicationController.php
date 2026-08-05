<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * Agency Applications
 *  - POST  /api/agency-applications                 (any authenticated user submits form + files)
 *  - GET   /api/agency-applications/mine            (current user's latest application status)
 *  - GET   /api/admin/agency-applications           (admin lists all)
 *  - POST  /api/admin/agency-applications/{id}/approve
 *  - POST  /api/admin/agency-applications/{id}/reject
 *
 * Table: agency_applications  (auto-created on first use if missing)
 */
class AgencyApplicationController extends Controller
{
    protected function agencyCodeFor($app): string
    {
        return 'AG' . (int) ($app->user_id ?? 0);
    }

    protected function promoteApprovedAgencyOwner($userId): void
    {
        if (!$userId || !Schema::hasTable('users') || !Schema::hasColumn('users', 'role')) return;

        DB::table('users')->where('id', $userId)->update([
            'role' => 'agent',
            'updated_at' => now(),
        ]);
    }

    protected function syncLegacyAgencyForApplication($app): void
    {
        if (!$app || empty($app->user_id)) return;

        $this->promoteApprovedAgencyOwner($app->user_id);

        if (!Schema::hasTable('agencies')) return;

        $code = $this->agencyCodeFor($app);
        $agencyId = null;
        $ownerColumns = ['user_id', 'owner_id', 'created_by', 'admin_id'];

        foreach ($ownerColumns as $column) {
            if (Schema::hasColumn('agencies', $column)) {
                $agencyId = DB::table('agencies')->where($column, $app->user_id)->value('id');
                if ($agencyId) break;
            }
        }

        if (!$agencyId && Schema::hasColumn('agencies', 'code')) {
            $agencyId = DB::table('agencies')->where('code', $code)->value('id');
        }

        $payload = [];
        $map = [
            'name' => $app->agency_name ?? 'Agency ' . $app->user_id,
            'agency_name' => $app->agency_name ?? 'Agency ' . $app->user_id,
            'code' => $code,
            'phone' => $app->phone ?? null,
            'email' => $app->email ?? null,
            'status' => 'active',
            'hosts_count' => is_numeric($app->num_hosts ?? null) ? (int) $app->num_hosts : 0,
            'commission' => 0,
        ];
        foreach ($map as $column => $value) {
            if (Schema::hasColumn('agencies', $column)) $payload[$column] = $value;
        }
        foreach ($ownerColumns as $column) {
            if (Schema::hasColumn('agencies', $column)) $payload[$column] = $app->user_id;
        }
        if (Schema::hasColumn('agencies', 'updated_at')) $payload['updated_at'] = now();

        if ($agencyId) {
            if (!empty($payload)) DB::table('agencies')->where('id', $agencyId)->update($payload);
        } else {
            if (Schema::hasColumn('agencies', 'created_at')) $payload['created_at'] = now();
            $agencyId = DB::table('agencies')->insertGetId($payload);
        }

        // NOTE: agency_hosts is the roster of hosts UNDER this agency.
        // The approved application only creates the agency (owner) row —
        // hosts are added later via the host-request flow.
    }

    protected function syncApprovedOwners(): void
    {
        if (!Schema::hasTable('agency_applications')) return;

        $apps = DB::table('agency_applications')
            ->where('status', 'approved')
            ->orderByDesc('id')
            ->get();

        foreach ($apps as $app) {
            $this->syncLegacyAgencyForApplication($app);
        }
    }

    protected function ensureTable(): void
    {
        if (!Schema::hasTable('agency_applications')) {
            Schema::create('agency_applications', function ($t) {
                $t->bigIncrements('id');
                $t->unsignedBigInteger('user_id')->index();
                $t->string('full_name')->nullable();
                $t->string('phone')->nullable();
                $t->string('email')->nullable();
                $t->string('age')->nullable();
                $t->string('gender')->nullable();
                $t->string('agency_name');
                $t->string('num_hosts')->nullable();
                $t->text('additional_message')->nullable();
                $t->string('id_front_url')->nullable();
                $t->string('id_back_url')->nullable();
                $t->string('id_back2_url')->nullable();
                $t->string('selfie_url')->nullable();
                $t->string('status')->default('pending')->index();
                $t->timestamps();
            });
            return;
        }

        // Legacy table exists — patch missing columns so admin panel works
        Schema::table('agency_applications', function ($t) {
            if (!Schema::hasColumn('agency_applications', 'status')) {
                $t->string('status')->default('pending')->index();
            }
            if (!Schema::hasColumn('agency_applications', 'created_at')) {
                $t->timestamp('created_at')->nullable();
            }
            if (!Schema::hasColumn('agency_applications', 'updated_at')) {
                $t->timestamp('updated_at')->nullable();
            }
        });
    }


    protected function ensureAdmin(): ?\Illuminate\Http\JsonResponse
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);
        $role = strtolower((string) ($u->role ?? ''));
        if (!in_array($role, ['admin', 'superadmin', 'super_admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        return null;
    }

    protected function storeUpload(Request $request, string $field): ?string
    {
        if (!$request->hasFile($field)) return null;
        $file = $request->file($field);
        if (!$file || !$file->isValid()) return null;
        $path = $file->store('agency-applications', 'public');
        return $path ? Storage::url($path) : null;
    }

    /**
     * Shared hosting sometimes forwards JSON/raw bodies without Laravel parsing
     * them into request input. Normalize raw JSON plus camelCase aliases before
     * validation so the same endpoint accepts Firebase and Lovable builds.
     */
    protected function normalizeStorePayload(Request $request): void
    {
        $raw = (string) $request->getContent();
        if ($raw !== '' && empty($request->all())) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $request->merge($decoded);
            }
        }

        $aliases = [
            'fullName' => 'full_name',
            'agencyName' => 'agency_name',
            'numHosts' => 'num_hosts',
            'additionalMessage' => 'additional_message',
        ];

        foreach ($aliases as $from => $to) {
            if (!$request->filled($to) && $request->filled($from)) {
                $request->merge([$to => $request->input($from)]);
            }
        }
    }

    /** POST /api/agency-applications */
    public function store(Request $request)
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);

        $this->normalizeStorePayload($request);

        $data = $request->validate([
            'full_name'          => 'required|string|max:191',
            'phone'              => 'nullable|string|max:64',
            'email'              => 'nullable|string|max:191',
            'age'                => 'nullable|string|max:16',
            'gender'             => 'nullable|string|max:32',
            'agency_name'        => 'required|string|max:191',
            'num_hosts'          => 'nullable|string|max:32',
            'additional_message' => 'nullable|string|max:2000',
            'id_front'           => 'nullable|file|image|max:5120',
            'id_back'            => 'nullable|file|image|max:5120',
            'id_back2'           => 'nullable|file|image|max:5120',
            'selfie_with_id'     => 'nullable|file|image|max:5120',
        ]);

        $this->ensureTable();

        // Block duplicate pending / approved app for same user
        $existing = DB::table('agency_applications')
            ->where('user_id', $u->id)
            ->whereIn('status', ['pending', 'approved'])
            ->first();
        if ($existing) {
            return response()->json([
                'message' => $existing->status === 'approved'
                    ? 'You already have an approved agency.'
                    : 'You already have a pending application.',
                'application' => $existing,
            ], 409);
        }

        $row = [
            'user_id'            => $u->id,
            'full_name'          => $data['full_name'],
            'phone'              => $data['phone'] ?? null,
            'email'              => $data['email'] ?? null,
            'age'                => $data['age'] ?? null,
            'gender'             => $data['gender'] ?? null,
            'agency_name'        => $data['agency_name'],
            'num_hosts'          => $data['num_hosts'] ?? null,
            'additional_message' => $data['additional_message'] ?? null,
            'id_front_url'       => $this->storeUpload($request, 'id_front'),
            'id_back_url'        => $this->storeUpload($request, 'id_back'),
            'id_back2_url'       => $this->storeUpload($request, 'id_back2'),
            'selfie_url'         => $this->storeUpload($request, 'selfie_with_id'),
            'status'             => 'pending',
            'created_at'         => now(),
            'updated_at'         => now(),
        ];

        $id = DB::table('agency_applications')->insertGetId($row);
        return response()->json([
            'ok' => true,
            'application' => array_merge(['id' => $id], $row),
        ], 201);
    }

    /** GET /api/agency-applications/mine */
    public function mine()
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);
        $this->ensureTable();

        // Prefer approved > pending > rejected > (latest by id) so that a
        // stale rejected/legacy row never masks a fresh approval for the same
        // user. This keeps the frontend UI honest when a user reapplies after
        // rejection and the admin approves the new attempt.
        $rows = DB::table('agency_applications')
            ->where('user_id', $u->id)
            ->orderByDesc('id')
            ->get();

        $app = null;
        foreach ($rows as $r) {
            if (strtolower((string) $r->status) === 'approved') { $app = $r; break; }
        }
        if (!$app) {
            foreach ($rows as $r) {
                if (strtolower((string) $r->status) === 'pending') { $app = $r; break; }
            }
        }
        if (!$app && $rows->isNotEmpty()) $app = $rows->first();

        // If no application row exists but user is already an agent, reflect approved.
        if (!$app) {
            $role = strtolower((string) ($u->role ?? ''));
            if ($role === 'agent') {
                return response()->json(['application' => ['status' => 'approved']]);
            }
            return response()->json(['application' => null]);
        }

        // Self-heal: if the latest state is approved but the user's role is
        // still 'user' (older approve() runs missed the role update), promote
        // now so downstream gates unlock without an admin retry.
        if (strtolower((string) $app->status) === 'approved') {
            $this->syncLegacyAgencyForApplication($app);
        }

        return response()->json(['application' => $app]);
    }




    /** GET /api/admin/agency-applications */
    public function index()
    {
        if ($r = $this->ensureAdmin()) return $r;
        $this->ensureTable();
        $this->syncApprovedOwners();

        $apps = DB::table('agency_applications')->orderByDesc('id')->get();
        $userIds = $apps->pluck('user_id')->filter()->all();

        $userCols = ['id', 'name'];
        foreach (['username', 'email', 'avatar', 'avatar_url'] as $c) {
            if (Schema::hasColumn('users', $c)) $userCols[] = $c;
        }
        $users = empty($userIds)
            ? collect()
            : DB::table('users')->whereIn('id', $userIds)->get($userCols)->keyBy('id');

        $out = $apps->map(function ($a) use ($users) {
            $u = $users->get($a->user_id);
            return array_merge((array) $a, [
                'user_name'   => $u->name ?? '',
                'user_avatar' => $u->avatar_url ?? $u->avatar ?? null,
            ]);
        });

        return response()->json(['applications' => $out]);
    }

    /** POST /api/admin/agency-applications/{id}/approve */
    public function approve($id)
    {
        if ($r = $this->ensureAdmin()) return $r;
        $this->ensureTable();
        $app = DB::table('agency_applications')->where('id', $id)->first();
        if (!$app) return response()->json(['message' => 'Not found'], 404);

        DB::transaction(function () use ($id, $app) {
            DB::table('agency_applications')->where('id', $id)->update([
                'status' => 'approved',
                'updated_at' => now(),
            ]);

            $fresh = DB::table('agency_applications')->where('id', $id)->first() ?: $app;
            $fresh->status = 'approved';
            $this->syncLegacyAgencyForApplication($fresh);
        });

        $fresh = DB::table('agency_applications')->where('id', $id)->first();
        return response()->json(['ok' => true, 'application' => $fresh]);
    }

    /** POST /api/admin/agency-applications/{id}/reject */
    public function reject($id)
    {
        if ($r = $this->ensureAdmin()) return $r;
        $this->ensureTable();
        $ok = DB::table('agency_applications')->where('id', $id)->update([
            'status' => 'rejected',
            'updated_at' => now(),
        ]);
        if (!$ok) return response()->json(['message' => 'Not found'], 404);
        return response()->json(['ok' => true]);
    }
}
