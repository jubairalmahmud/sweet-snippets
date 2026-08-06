<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Admin-only global host target CRUD.
 *
 * Supports BOTH schemas:
 * - new/global columns: coins_target, live_hours_target, diamonds_target, period_start, period_end, active
 * - old/per-host columns: user_id, target_coins, target_live_hours, target_diamonds, start_date, end_date, is_active
 *
 * The admin panel now sends a global monthly target. If the live database still
 * has old NOT NULL columns, this controller writes those legacy columns too so
 * shared-hosting MySQL does not fail with a generic 500.
 */
class AdminHostTargetController extends Controller
{
    protected array $columnCache = [];

    protected function ensureAdmin(): ?\Illuminate\Http\JsonResponse
    {
        $u = Auth::user();
        if (!$u) return response()->json(['message' => 'Unauthorized'], 401);

        $role = strtolower((string) ($u->role ?? ''));
        $isAdminFlag = (bool) ($u->is_admin ?? false);

        if (!$isAdminFlag && !in_array($role, ['admin', 'superadmin', 'super_admin'], true)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return null;
    }

    protected function hasColumn(string $column): bool
    {
        if (!array_key_exists($column, $this->columnCache)) {
            $this->columnCache[$column] = Schema::hasColumn('host_targets', $column);
        }

        return (bool) $this->columnCache[$column];
    }

    protected function addColumnIfMissing(string $column, callable $definition): void
    {
        if (!$this->hasColumn($column)) {
            Schema::table('host_targets', function (Blueprint $table) use ($definition) {
                $definition($table);
            });
            $this->columnCache[$column] = true;
        }
    }

    /**
     * Auto-create/repair host_targets table on shared hosting.
     * This preserves existing rows and only adds missing columns.
     */
    protected function ensureTable(): void
    {
        if (!Schema::hasTable('host_targets')) {
            Schema::create('host_targets', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('coins_target')->nullable();
                $table->decimal('live_hours_target', 8, 2)->nullable();
                $table->unsignedBigInteger('diamonds_target')->nullable();
                $table->date('period_start');
                $table->date('period_end');
                $table->boolean('active')->default(true);
                $table->boolean('processed')->default(false);
                $table->unsignedBigInteger('created_by')->nullable();
                $table->timestamps();
                $table->index(['active', 'period_end']);
            });
            return;
        }

        $this->addColumnIfMissing('coins_target', fn (Blueprint $table) => $table->unsignedBigInteger('coins_target')->nullable());
        $this->addColumnIfMissing('live_hours_target', fn (Blueprint $table) => $table->decimal('live_hours_target', 8, 2)->nullable());
        $this->addColumnIfMissing('diamonds_target', fn (Blueprint $table) => $table->unsignedBigInteger('diamonds_target')->nullable());
        $this->addColumnIfMissing('period_start', fn (Blueprint $table) => $table->date('period_start')->nullable());
        $this->addColumnIfMissing('period_end', fn (Blueprint $table) => $table->date('period_end')->nullable());
        $this->addColumnIfMissing('active', fn (Blueprint $table) => $table->boolean('active')->default(true));
        $this->addColumnIfMissing('processed', fn (Blueprint $table) => $table->boolean('processed')->default(false));
        $this->addColumnIfMissing('created_by', fn (Blueprint $table) => $table->unsignedBigInteger('created_by')->nullable());
        $this->addColumnIfMissing('created_at', fn (Blueprint $table) => $table->timestamp('created_at')->nullable());
        $this->addColumnIfMissing('updated_at', fn (Blueprint $table) => $table->timestamp('updated_at')->nullable());
    }

    protected function payloadFrom(Request $request, bool $partial = false): array
    {
        $map = [
            'coins_target' => ['coins_target', 'target_coins'],
            'live_hours_target' => ['live_hours_target', 'target_live_hours'],
            'diamonds_target' => ['diamonds_target', 'target_diamonds'],
            'period_start' => ['period_start', 'start_date'],
            'period_end' => ['period_end', 'end_date'],
        ];

        $payload = [];
        foreach ($map as $canonical => $keys) {
            foreach ($keys as $key) {
                if ($request->has($key)) {
                    $payload[$canonical] = $request->input($key);
                    break;
                }
            }
        }

        if ($request->has('active')) {
            $payload['active'] = $request->boolean('active');
        } elseif ($request->has('is_active')) {
            $payload['active'] = $request->boolean('is_active');
        } elseif (!$partial) {
            $payload['active'] = true;
        }

        return $payload;
    }

    protected function cleanValue($value)
    {
        return $value === '' ? null : $value;
    }

    protected function validatePayload(array $payload, bool $partial = false): array
    {
        foreach ($payload as $key => $value) {
            $payload[$key] = $this->cleanValue($value);
        }

        $required = $partial ? 'sometimes' : 'required';
        $validator = Validator::make($payload, [
            'coins_target' => 'nullable|integer|min:0',
            'live_hours_target' => 'nullable|numeric|min:0',
            'diamonds_target' => 'nullable|integer|min:0',
            'period_start' => $required.'|date',
            'period_end' => $required.'|date|after_or_equal:period_start',
            'active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        return $validator->validated();
    }

    protected function hasMetric(array $data): bool
    {
        return !empty($data['coins_target'])
            || !empty($data['live_hours_target'])
            || !empty($data['diamonds_target']);
    }

    protected function targetNumber(array $data, string $key, string $type = 'int')
    {
        if (!array_key_exists($key, $data) || $data[$key] === null || $data[$key] === '') {
            return null;
        }

        return $type === 'float' ? (float) $data[$key] : (int) $data[$key];
    }

    protected function legacyDefaultFor(string $column, array $data)
    {
        $active = (bool) ($data['active'] ?? true);

        return match ($column) {
            'user_id', 'host_id', 'host_user_id' => Auth::id() ?: 0,
            'agency_id', 'created_by', 'updated_by' => Auth::id(),
            'target_coins', 'coins', 'coin_target', 'required_coins' => $this->targetNumber($data, 'coins_target') ?? 0,
            'target_live_hours', 'live_hours', 'hours_target', 'required_hours' => $this->targetNumber($data, 'live_hours_target', 'float') ?? 0,
            'target_diamonds', 'diamonds', 'diamond_target', 'required_diamonds' => $this->targetNumber($data, 'diamonds_target') ?? 0,
            'start_date', 'from_date' => $data['period_start'] ?? now()->startOfMonth()->toDateString(),
            'end_date', 'to_date' => $data['period_end'] ?? now()->endOfMonth()->toDateString(),
            'month' => isset($data['period_start']) ? date('m', strtotime((string) $data['period_start'])) : now()->format('m'),
            'year' => isset($data['period_start']) ? date('Y', strtotime((string) $data['period_start'])) : now()->format('Y'),
            'type' => 'monthly',
            'status' => $active ? 'active' : 'inactive',
            'is_active', 'active' => $active ? 1 : 0,
            'processed' => 0,
            'created_at', 'updated_at' => now(),
            default => null,
        };
    }

    protected function fillRequiredExistingColumns(array $write, array $data, bool $creating): array
    {
        if (!$creating) return $write;

        try {
            $columns = Schema::getColumnListing('host_targets');
        } catch (\Throwable $e) {
            return $write;
        }

        foreach ($columns as $column) {
            if ($column === 'id' || array_key_exists($column, $write)) continue;

            try {
                $details = DB::selectOne(
                    'SELECT IS_NULLABLE, COLUMN_DEFAULT, EXTRA, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
                    ['host_targets', $column]
                );
            } catch (\Throwable $e) {
                $details = null;
            }

            $extra = strtolower((string) ($details->EXTRA ?? ''));
            $nullable = strtoupper((string) ($details->IS_NULLABLE ?? 'YES')) === 'YES';
            $hasDefault = $details && $details->COLUMN_DEFAULT !== null;
            if ($nullable || $hasDefault || str_contains($extra, 'auto_increment')) continue;

            $write[$column] = $this->legacyDefaultFor($column, $data);
        }

        return $write;
    }

    protected function writeData(array $data, bool $creating = false): array
    {
        $active = (bool) ($data['active'] ?? true);
        $coins = $this->targetNumber($data, 'coins_target');
        $hours = $this->targetNumber($data, 'live_hours_target', 'float');
        $diamonds = $this->targetNumber($data, 'diamonds_target');

        $write = [];

        // New/global schema columns
        if ($this->hasColumn('coins_target')) $write['coins_target'] = $coins;
        if ($this->hasColumn('live_hours_target')) $write['live_hours_target'] = $hours;
        if ($this->hasColumn('diamonds_target')) $write['diamonds_target'] = $diamonds;
        if ($this->hasColumn('period_start')) $write['period_start'] = $data['period_start'];
        if ($this->hasColumn('period_end')) $write['period_end'] = $data['period_end'];
        if ($this->hasColumn('active')) $write['active'] = $active ? 1 : 0;

        // Old/per-host schema columns kept only to satisfy existing NOT NULL columns.
        if ($this->hasColumn('user_id')) $write['user_id'] = Auth::id() ?: 0;
        if ($this->hasColumn('target_coins')) $write['target_coins'] = $coins ?? 0;
        if ($this->hasColumn('target_live_hours')) $write['target_live_hours'] = $hours ?? 0;
        if ($this->hasColumn('target_diamonds')) $write['target_diamonds'] = $diamonds ?? 0;
        if ($this->hasColumn('start_date')) $write['start_date'] = $data['period_start'];
        if ($this->hasColumn('end_date')) $write['end_date'] = $data['period_end'];
        if ($this->hasColumn('is_active')) $write['is_active'] = $active ? 1 : 0;

        if ($this->hasColumn('processed')) $write['processed'] = 0;
        if ($creating && $this->hasColumn('created_by')) $write['created_by'] = Auth::id();
        if ($creating && $this->hasColumn('created_at')) $write['created_at'] = now();
        if ($this->hasColumn('updated_at')) $write['updated_at'] = now();

        return $this->fillRequiredExistingColumns($write, $data, $creating);
    }

    protected function partialWriteData(array $data): array
    {
        $write = [];

        $map = [
            'coins_target' => ['coins_target', 'target_coins', 'int'],
            'live_hours_target' => ['live_hours_target', 'target_live_hours', 'float'],
            'diamonds_target' => ['diamonds_target', 'target_diamonds', 'int'],
        ];

        foreach ($map as $input => [$newColumn, $legacyColumn, $type]) {
            if (array_key_exists($input, $data)) {
                $value = $this->targetNumber($data, $input, $type);
                if ($this->hasColumn($newColumn)) $write[$newColumn] = $value;
                if ($this->hasColumn($legacyColumn)) $write[$legacyColumn] = $value ?? 0;
            }
        }

        if (array_key_exists('period_start', $data)) {
            if ($this->hasColumn('period_start')) $write['period_start'] = $data['period_start'];
            if ($this->hasColumn('start_date')) $write['start_date'] = $data['period_start'];
        }

        if (array_key_exists('period_end', $data)) {
            if ($this->hasColumn('period_end')) $write['period_end'] = $data['period_end'];
            if ($this->hasColumn('end_date')) $write['end_date'] = $data['period_end'];
        }

        if (array_key_exists('active', $data)) {
            $active = (bool) $data['active'];
            if ($this->hasColumn('active')) $write['active'] = $active ? 1 : 0;
            if ($this->hasColumn('is_active')) $write['is_active'] = $active ? 1 : 0;
        }

        if ($this->hasColumn('updated_at')) $write['updated_at'] = now();

        return $write;
    }

    protected function deactivateOtherTargets($exceptId = null): void
    {
        $update = [];
        if ($this->hasColumn('active')) $update['active'] = 0;
        if ($this->hasColumn('is_active')) $update['is_active'] = 0;
        if ($this->hasColumn('updated_at')) $update['updated_at'] = now();

        if (!$update) return;

        $query = DB::table('host_targets');
        if ($exceptId !== null) {
            $query->where('id', '!=', $exceptId);
        }
        $query->update($update);
    }

    protected function findExistingForPeriod(array $data)
    {
        $query = DB::table('host_targets')->where(function ($q) use ($data) {
            if ($this->hasColumn('period_start') && $this->hasColumn('period_end')) {
                $q->orWhere(function ($qq) use ($data) {
                    $qq->where('period_start', $data['period_start'])
                       ->where('period_end', $data['period_end']);
                });
            }

            if ($this->hasColumn('start_date') && $this->hasColumn('end_date')) {
                $q->orWhere(function ($qq) use ($data) {
                    $qq->where('start_date', $data['period_start'])
                       ->where('end_date', $data['period_end']);
                });
            }
        });

        if ($this->hasColumn('user_id')) {
            $query->orderByRaw('CASE WHEN user_id = ? THEN 0 ELSE 1 END', [Auth::id() ?: 0]);
        }

        return $query->orderByDesc('id')->first();
    }

    protected function normalizeTarget($row): array
    {
        $row = (array) $row;

        $row['coins_target'] = $row['coins_target'] ?? $row['target_coins'] ?? null;
        $row['live_hours_target'] = $row['live_hours_target'] ?? $row['target_live_hours'] ?? null;
        $row['diamonds_target'] = $row['diamonds_target'] ?? $row['target_diamonds'] ?? null;
        $row['period_start'] = $row['period_start'] ?? $row['start_date'] ?? null;
        $row['period_end'] = $row['period_end'] ?? $row['end_date'] ?? null;
        $row['active'] = array_key_exists('active', $row) ? (int) $row['active'] : (int) ($row['is_active'] ?? 0);

        return $row;
    }

    /** GET /api/admin/host-target */
    public function index(Request $request)
    {
        if ($r = $this->ensureAdmin()) return $r;

        try {
            $this->ensureTable();
            $limit = min(100, max(1, (int) $request->get('limit', 20)));
            $rows = DB::table('host_targets')
                ->orderByDesc('id')
                ->limit($limit)
                ->get()
                ->map(fn ($row) => $this->normalizeTarget($row))
                ->values();

            return response()->json(['targets' => $rows]);
        } catch (\Throwable $e) {
            Log::error('host-target-index: '.$e->getMessage());
            return response()->json(['message' => 'Host target index failed', 'error' => $e->getMessage()], 500);
        }
    }

    /** POST /api/admin/host-target */
    public function store(Request $request)
    {
        if ($r = $this->ensureAdmin()) return $r;

        try {
            $this->ensureTable();

            $data = $this->validatePayload($this->payloadFrom($request));
            if (!$this->hasMetric($data)) {
                return response()->json(['message' => 'At least one target metric required'], 422);
            }

            $active = (bool) ($data['active'] ?? true);
            if ($active) {
                $this->deactivateOtherTargets();
            }

            $existing = $this->findExistingForPeriod($data);
            if ($existing) {
                DB::table('host_targets')->where('id', $existing->id)->update($this->writeData($data, false));
                $target = DB::table('host_targets')->where('id', $existing->id)->first();
                return response()->json(['ok' => true, 'id' => $existing->id, 'target' => $this->normalizeTarget($target)]);
            }

            $id = DB::table('host_targets')->insertGetId($this->writeData($data, true));

            $target = DB::table('host_targets')->where('id', $id)->first();
            return response()->json(['ok' => true, 'id' => $id, 'target' => $this->normalizeTarget($target)]);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('host-target-store: '.$e->getMessage());
            return response()->json(['message' => 'Host target save failed', 'error' => $e->getMessage()], 500);
        }
    }

    /** PUT /api/admin/host-target/{id} */
    public function update(Request $request, $id)
    {
        if ($r = $this->ensureAdmin()) return $r;

        try {
            $this->ensureTable();

            $existing = DB::table('host_targets')->where('id', $id)->first();
            if (!$existing) {
                return response()->json(['message' => 'Target not found'], 404);
            }

            $data = $this->validatePayload($this->payloadFrom($request, true), true);
            $merged = array_merge((array) $existing, $data);
            if (!$this->hasMetric($merged)) {
                return response()->json(['message' => 'At least one target metric required'], 422);
            }

            $update = $this->partialWriteData($data);

            if (!empty($update['active'])) {
                $this->deactivateOtherTargets($id);
            } elseif (!empty($update['is_active'])) {
                $this->deactivateOtherTargets($id);
            }

            DB::table('host_targets')->where('id', $id)->update($update);
            $target = DB::table('host_targets')->where('id', $id)->first();

            return response()->json(['ok' => true, 'target' => $this->normalizeTarget($target)]);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Throwable $e) {
            Log::error('host-target-update: '.$e->getMessage());
            return response()->json(['message' => 'Host target update failed', 'error' => $e->getMessage()], 500);
        }
    }

    /** DELETE /api/admin/host-target/{id} */
    public function destroy($id)
    {
        if ($r = $this->ensureAdmin()) return $r;

        try {
            $this->ensureTable();
            $deleted = DB::table('host_targets')->where('id', $id)->delete();
            if (!$deleted) {
                return response()->json(['message' => 'Target not found'], 404);
            }
            return response()->json(['ok' => true]);
        } catch (\Throwable $e) {
            Log::error('host-target-destroy: '.$e->getMessage());
            return response()->json(['message' => 'Host target delete failed', 'error' => $e->getMessage()], 500);
        }
    }

    /** GET /api/host/my-target */
    public function forHost(Request $request)
    {
        try {
            $this->ensureTable();

            $user = $request->user();
            if (!$user) return response()->json(['message' => 'Unauthorized'], 401);

            $today = now()->toDateString();
            $target = DB::table('host_targets')
                ->where(function ($q) {
                    if ($this->hasColumn('active')) $q->orWhere('active', 1);
                    if ($this->hasColumn('is_active')) $q->orWhere('is_active', 1);
                })
                ->where(function ($q) use ($today) {
                    if ($this->hasColumn('period_start') && $this->hasColumn('period_end')) {
                        $q->orWhere(function ($qq) use ($today) {
                            $qq->whereDate('period_start', '<=', $today)
                               ->whereDate('period_end', '>=', $today);
                        });
                    }

                    if ($this->hasColumn('start_date') && $this->hasColumn('end_date')) {
                        $q->orWhere(function ($qq) use ($today) {
                            $qq->whereDate('start_date', '<=', $today)
                               ->whereDate('end_date', '>=', $today);
                        });
                    }
                })
                ->orderByDesc('id')
                ->first();

            if (!$target) {
                return response()->json(['target' => null]);
            }

            $target = (object) $this->normalizeTarget($target);

            $totals = (object) ['coins' => 0, 'hours' => 0, 'diamonds' => 0];
            if (Schema::hasTable('host_reports')) {
                $totals = DB::table('host_reports')
                    ->where('host_user_id', $user->id)
                    ->whereBetween('report_date', [$target->period_start, $target->period_end])
                    ->selectRaw('COALESCE(SUM(coins_earned),0) as coins, COALESCE(SUM(live_hours),0) as hours, COALESCE(SUM(diamonds_earned),0) as diamonds')
                    ->first() ?: $totals;
            }

            return response()->json([
                'target' => $target,
                'progress' => [
                    'coins_earned' => (int) ($totals->coins ?? 0),
                    'live_hours' => (float) ($totals->hours ?? 0),
                    'diamonds_earned' => (int) ($totals->diamonds ?? 0),
                    'coins_pct' => !empty($target->coins_target) ? min(100, round(((int) ($totals->coins ?? 0)) / max(1, (int) $target->coins_target) * 100, 1)) : null,
                    'hours_pct' => !empty($target->live_hours_target) ? min(100, round(((float) ($totals->hours ?? 0)) / max(0.01, (float) $target->live_hours_target) * 100, 1)) : null,
                    'diamonds_pct' => !empty($target->diamonds_target) ? min(100, round(((int) ($totals->diamonds ?? 0)) / max(1, (int) $target->diamonds_target) * 100, 1)) : null,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('host-target-for-host: '.$e->getMessage());
            return response()->json(['message' => 'Host target read failed', 'error' => $e->getMessage()], 500);
        }
    }
}
