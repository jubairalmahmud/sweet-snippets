# Realtime (Pusher) + Push (FCM) Setup

## 1) FCM Server-side Push

### Install
```bash
cd laravel-api
composer require kreait/firebase-php
```

### Service account
1. Firebase Console → Project Settings → **Service Accounts** → **Generate new private key**.
2. Save the JSON as: `storage/app/firebase/service-account.json`
3. Add to `.env`:
```
FIREBASE_CREDENTIALS=storage/app/firebase/service-account.json
```

### Usage anywhere in PHP code
```php
use App\Services\FcmService;

// On a new follower:
FcmService::sendToUser($followedUserId, 'নতুন follower!', $follower->name." আপনাকে follow করেছে", [
    'type' => 'follow',
    'user_id' => $follower->id,
]);

// On a new gift:
FcmService::sendToUser($receiverId, '🎁 New gift!', "$senderName sent you $giftName", [
    'type' => 'gift',
    'gift_id' => $giftId,
]);
```

Invalid tokens are auto-pruned from `push_tokens` table.

Drop these calls into `FollowController::follow`, `MessageController::send`,
`WalletController::sendGift`, `ReportController::review`, etc., right after
the `Notification::create(...)` line.

---

## 2) Pusher Realtime (chat + live room)

### Backend
```bash
composer require pusher/pusher-php-server
```

`.env`:
```
BROADCAST_DRIVER=pusher
PUSHER_APP_ID=...
PUSHER_APP_KEY=...
PUSHER_APP_SECRET=...
PUSHER_APP_CLUSTER=ap2
```

Get these from <https://dashboard.pusher.com> → create a Channels app (free tier OK).

### Register broadcast routes
In `app/Providers/BroadcastServiceProvider.php` make sure `Broadcast::routes(['middleware' => ['auth:sanctum']])` is called and `routes/channels.php` (already added) is required.

### Fire events
In `MessageController::send()` after creating the message row:
```php
event(new \App\Events\NewMessage($senderId, $receiverId, $message->toArray()));
```

In `MessageController::roomSend()`:
```php
event(new \App\Events\NewRoomMessage($roomId, $message->toArray()));
```

In `LiveRoomController::join/leave` after updating viewer count:
```php
event(new \App\Events\RoomViewerChanged($roomId, $userId, 'join', $newCount));
```

### Frontend
```bash
bun add pusher-js
```

`.env`:
```
VITE_PUSHER_KEY=...
VITE_PUSHER_CLUSTER=ap2
```

In components:
```ts
import { subscribeUser, subscribeRoom } from "@/sk-love/lib/realtime";
import { useQueryClient } from "@tanstack/react-query";

const qc = useQueryClient();
useEffect(() => {
  let ch: any;
  subscribeUser(myUserId, "new-message", (e) => {
    qc.invalidateQueries({ queryKey: ["thread", e.sender_id] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }).then((c) => (ch = c));
  return () => ch?.unsubscribe();
}, [myUserId]);
```

Polling intervals in existing hooks can stay as fallback — realtime simply
invalidates queries faster.

---

## 3) Admin panel
Frontend dashboard: **`/admin-panel`** (login at `/admin` first).
Three tabs: Reports review, Audit Logs, App Settings.
All wired to existing endpoints — no extra backend work needed.
