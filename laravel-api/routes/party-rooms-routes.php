<?php
// -----------------------------------------------------------------------------
// routes/api.php — এই লাইনগুলো তোমার existing party-rooms group এ যোগ করো।
// এই ২টা নতুন route একই controller method (updateSettings) কে call করবে।
// /party-rooms/{id} route আর যোগ করবে না — existing show/update route conflict হতে পারে।
// -----------------------------------------------------------------------------

use App\Http\Controllers\Api\PartyRoomController;

Route::middleware('auth:sanctum')->group(function () {
    // maxGuestSeats আপডেটের জন্য নতুন ২টা endpoint:
    Route::post('/party-rooms/{id}/settings', [PartyRoomController::class, 'updateSettings']);
    Route::post('/party-rooms/{id}/update',   [PartyRoomController::class, 'updateSettings']);
});
