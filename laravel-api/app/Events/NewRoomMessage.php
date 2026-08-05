<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast new chat in a live room.
 * Frontend subscribes to `presence-room.{roomId}` and listens for `.new-room-message`.
 * Presence channel also gives you live viewer list out of the box.
 */
class NewRoomMessage implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $roomId;
    public array $message; // {id, room_id, user_id, body, created_at, user:{name,avatar}}

    public function __construct(int $roomId, array $message)
    {
        $this->roomId  = $roomId;
        $this->message = $message;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('room.'.$this->roomId);
    }

    public function broadcastAs(): string
    {
        return 'new-room-message';
    }

    public function broadcastWith(): array
    {
        return [
            'room_id' => $this->roomId,
            'message' => $this->message,
        ];
    }
}
