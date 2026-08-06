<?php
/**
 * ============================================================================
 *  Add these routes to your existing routes/api.php inside the
 *  Route::middleware('auth:sanctum')->group(function () { ... }) block.
 * ============================================================================
 */

use App\Http\Controllers\Api\AgencySalaryController;
use App\Http\Controllers\Api\Admin\SalarySettingsController;
use App\Http\Controllers\Api\Admin\SalaryController;

Route::middleware('auth:sanctum')->group(function () {
    // Agent (read-only)
    Route::get('/agency/salary/months', [AgencySalaryController::class, 'months']);
    Route::get('/agency/salary',        [AgencySalaryController::class, 'show']);
    Route::get('/agency/salary/pdf',    [AgencySalaryController::class, 'pdf']);

    // Admin: settings + overrides
    Route::get   ('/admin/salary-settings',            [SalarySettingsController::class, 'index']);
    Route::put   ('/admin/salary-settings',            [SalarySettingsController::class, 'update']);
    Route::get   ('/admin/agency-share-overrides',     [SalarySettingsController::class, 'overrides']);
    Route::post  ('/admin/agency-share-overrides',     [SalarySettingsController::class, 'addOverride']);
    Route::delete('/admin/agency-share-overrides/{id}',[SalarySettingsController::class, 'deleteOverride']);

    // Admin: salary preview / lock / edit
    Route::get ('/admin/salary/preview',                                [SalaryController::class, 'preview']);
    Route::post('/admin/salary/{agency_id}/{year}/{month}/lock',        [SalaryController::class, 'lock']);
    Route::post('/admin/salary/{agency_id}/{year}/{month}/unlock',      [SalaryController::class, 'unlock']);
    Route::put ('/admin/salary/lines/{id}',                             [SalaryController::class, 'updateLine']);
});
