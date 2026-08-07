<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RoomViewerChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $roomId;
    public int $viewerCount;
    public string $action; // 'join' | 'leave'
    public int $userId;

    public function __construct(int $roomId, int $userId, string $action, int $viewerCount)
    {
        $this->roomId      = $roomId;
        $this->userId      = $userId;
        $this->action      = $action;
        $this->viewerCount = $viewerCount;
    }

    public function broadcastOn()
    {
        return new PresenceChannel('room.'.$this->roomId);
    }

    public function broadcastAs(): string
    {
        return 'viewer-changed';
    }
}
