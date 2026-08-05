<?php
/**
 * MERGE this route into your existing routes/api.php.
 * Rankings are public (read-only, aggregated), so no auth middleware is required.
 * If you want it authenticated, drop it inside the auth:sanctum group.
 */

use App\Http\Controllers\Api\RankingsController;

Route::get('/rankings', [RankingsController::class, 'index']);
