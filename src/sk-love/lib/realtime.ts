// @ts-nocheck
// Pusher realtime client for chat + live rooms.
// Setup:
//   bun add pusher-js
//   Set in .env (frontend):
//     VITE_PUSHER_KEY=...
//     VITE_PUSHER_CLUSTER=ap2
//     VITE_LARAVEL_API_URL=https://sklove.nit.bd
//
// Usage in a component:
//   import { subscribeUser, subscribeRoom } from "@/sk-love/lib/realtime";
//   useEffect(() => {
//     const ch = subscribeUser(myId, "new-message", (e) => {
//       queryClient.invalidateQueries({ queryKey: ["thread", e.sender_id] });
//     });
//     return () => ch?.unsubscribe();
//   }, [myId]);

import { API_BASE_URL } from "./api";

let pusherInstance: any = null;

async function getPusher() {
  if (pusherInstance) return pusherInstance;
  const key = (import.meta as any).env.VITE_PUSHER_KEY;
  const cluster = (import.meta as any).env.VITE_PUSHER_CLUSTER || "ap2";
  if (!key) {
    console.warn("[realtime] VITE_PUSHER_KEY not set — falling back to polling");
    return null;
  }
  const Pusher = (await import(/* @vite-ignore */ "pusher-js" as any)).default;
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("sk_love_token") : null;

  pusherInstance = new Pusher(key, {
    cluster,
    authEndpoint: `${API_BASE_URL}/api/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        Accept: "application/json",
      },
    },
  });
  return pusherInstance;
}

export async function subscribeUser(
  userId: number | string,
  event: string,
  cb: (payload: any) => void,
) {
  const p = await getPusher();
  if (!p) return null;
  const ch = p.subscribe(`private-user.${userId}`);
  ch.bind(event, cb);
  return ch;
}

export async function subscribeRoom(
  roomId: number | string,
  event: string,
  cb: (payload: any) => void,
) {
  const p = await getPusher();
  if (!p) return null;
  const ch = p.subscribe(`presence-room.${roomId}`);
  ch.bind(event, cb);
  return ch;
}

export async function unsubscribeRoom(roomId: number | string) {
  const p = await getPusher();
  if (!p) return;
  p.unsubscribe(`presence-room.${roomId}`);
}
