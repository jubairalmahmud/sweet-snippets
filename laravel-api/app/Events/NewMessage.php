<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast a new DM to the receiving user's private channel.
 * Frontend subscribes to `private-user.{receiverId}` and listens for `.new-message`.
 */
class NewMessage implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $senderId;
    public int $receiverId;
    public array $message; // {id, sender_id, receiver_id, body, created_at, ...}

    public function __construct(int $senderId, int $receiverId, array $message)
    {
        $this->senderId   = $senderId;
        $this->receiverId = $receiverId;
        $this->message    = $message;
    }

    public function broadcastOn()
    {
        return new PrivateChannel('user.'.$this->receiverId);
    }

    public function broadcastAs(): string
    {
        return 'new-message';
    }

    public function broadcastWith(): array
    {
        return [
            'sender_id'   => $this->senderId,
            'receiver_id' => $this->receiverId,
            'message'     => $this->message,
        ];
    }
}
