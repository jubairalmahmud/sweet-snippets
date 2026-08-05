<?php

use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;

/*
 * Pusher channel authorization.
 * Register this file in app/Providers/BroadcastServiceProvider.php (Broadcast::routes()).
 */

// Private DM channel — only the user themself can subscribe to their own inbox.
Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int)$user->id === (int)$userId;
});

// Presence channel for a live room. Returns user info shown to other viewers.
Broadcast::channel('room.{roomId}', function ($user, $roomId) {
    $room = DB::table('live_rooms')->where('id', $roomId)->first();
    if (!$room || $room->status !== 'live') return false;

    return [
        'id'     => $user->id,
        'name'   => $user->name ?? ('User#'.$user->id),
        'avatar' => $user->avatar_url ?? null,
    ];
});
