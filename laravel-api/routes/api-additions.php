<?php
/**
 * ============================================================================
 *  MERGE THESE ROUTES INTO your existing routes/api.php
 *  Place inside the `Route::middleware('auth:sanctum')->group(function () { ... })`
 *  block so they use the same auth as your other authenticated routes.
 * ============================================================================
 */

use App\Http\Controllers\Api\AgencyDashboardController;
use App\Http\Controllers\Api\AdminHostTargetController;
use App\Http\Controllers\Api\AdminAgencyController;
use App\Http\Controllers\Api\AgencyApplicationController;


Route::middleware('auth:sanctum')->group(function () {
    // Agency owner endpoints
    Route::get   ('/agency/hosts',                       [AgencyDashboardController::class, 'hosts']);
    Route::post  ('/agency/hosts',                       [AgencyDashboardController::class, 'addHost']);
    Route::delete('/agency/hosts/{id}',                  [AgencyDashboardController::class, 'removeHost']);

    Route::get   ('/agency/host-requests',               [AgencyDashboardController::class, 'hostRequests']);
    Route::post  ('/agency/host-requests/{id}/approve',  [AgencyDashboardController::class, 'approveRequest']);
    Route::post  ('/agency/host-requests/{id}/reject',   [AgencyDashboardController::class, 'rejectRequest']);

    Route::get   ('/agency/target',                      [AgencyDashboardController::class, 'target']);
    Route::get   ('/agency/reports',                     [AgencyDashboardController::class, 'reports']);
    Route::get   ('/agency/reports/export',              [AgencyDashboardController::class, 'exportReports']);

    // Admin-only host target CRUD (RBAC enforced inside controller)
    Route::get   ('/admin/host-target',                  [AdminHostTargetController::class, 'index']);
    Route::post  ('/admin/host-target',                   [AdminHostTargetController::class, 'store']);
    Route::put   ('/admin/host-target/{id}',              [AdminHostTargetController::class, 'update']);
    Route::delete('/admin/host-target/{id}',              [AdminHostTargetController::class, 'destroy']);

    // Admin-only: approved agencies monitoring
    Route::get ('/admin/agencies',                        [AdminAgencyController::class, 'index']);
    Route::get ('/admin/agencies/{id}/hosts',             [AdminAgencyController::class, 'hosts']);
    Route::post('/admin/agencies/{id}/suspend',           [AdminAgencyController::class, 'suspend']);
    Route::post('/admin/agencies/{id}/reactivate',        [AdminAgencyController::class, 'reactivate']);

    // Agency applications (user submits + admin approve/reject)
    Route::post('/agency-applications',                        [AgencyApplicationController::class, 'store']);
    Route::get ('/admin/agency-applications',                  [AgencyApplicationController::class, 'index']);
    Route::post('/admin/agency-applications/{id}/approve',     [AgencyApplicationController::class, 'approve']);
    Route::post('/admin/agency-applications/{id}/reject',      [AgencyApplicationController::class, 'reject']);

});
