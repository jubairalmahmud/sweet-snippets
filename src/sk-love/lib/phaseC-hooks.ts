// @ts-nocheck
// ============================================================
// Phase C — Frontend hooks/helpers for the 5 new Laravel endpoints
// (Frames, Entry Effects, Blocks, Room Mutes, Post Comments)
//
// Save as:  src/sk-love/lib/phaseC-hooks.ts
// Import in App.tsx:
//   import {
//     useFrameCatalog, useMyFrames, buyFrame, equipFrame,
//     useEntryEffects, useMyEntryEffects, buyEntryEffect, equipEntryEffect,
//     useBlockedUsers, blockUser, unblockUser,
//     useRoomMutes, muteInRoom, unmuteInRoom,
//     usePostComments, addPostComment, deletePostComment,
//   } from "./lib/phaseC-hooks";
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { api } from "./api"; // your existing api client (already used across App.tsx)

// ---------------- Types ----------------
export type FrameItem = {
  id: number;
  code: string;
  name: string;
  image_url: string;
  price_diamonds: number;
  duration_days: number;
  is_active: boolean;
};
export type MyFrame = {
  frame_id: number;
  code: string;
  name: string;
  image_url: string;
  expires_at: string | null;
  is_equipped: boolean;
};
export type EntryEffectItem = {
  id: number;
  code: string;
  name: string;
  preview_url: string;
  price_diamonds: number;
  duration_days: number;
  is_active: boolean;
};
export type MyEntryEffect = {
  effect_id: number;
  code: string;
  name: string;
  preview_url: string;
  expires_at: string | null;
  is_equipped: boolean;
};
export type BlockedUser = { user_id: number; username: string; avatar_url: string | null; blocked_at: string };
export type RoomMute   = { user_id: number; username: string; muted_at: string; muted_by: number };
export type PostComment = {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  avatar_url: string | null;
  text: string;
  created_at: string;
};

// ---------------- Small polling hook ----------------
function useApiList<T>(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    if (!path) return;
    setLoading(true); setError(null);
    try {
      const res: any = await api.get(path, { auth: true });
      setData((res?.data ?? res ?? []) as T[]);
    } catch (e: any) { setError(e?.message ?? "Failed"); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, deps);
  return { data, loading, error, refresh, setData };
}

// ==================================================
// 1) FRAMES
// ==================================================
export const useFrameCatalog = () => useApiList<FrameItem>("/api/frame-catalog", []);
export const useMyFrames     = () => useApiList<MyFrame>  ("/api/me/frames",     []);
export async function buyFrame(id: number)   { return api.post(`/api/frame-catalog/${id}/buy`, {}, { auth: true }); }
export async function equipFrame(id: number) { return api.post(`/api/me/frames/${id}/equip`,   {}, { auth: true }); }

// ==================================================
// 2) ENTRY EFFECTS
// ==================================================
export const useEntryEffects   = () => useApiList<EntryEffectItem>("/api/entry-effects",    []);
export const useMyEntryEffects = () => useApiList<MyEntryEffect>  ("/api/me/entry-effects", []);
export async function buyEntryEffect(id: number)   { return api.post(`/api/entry-effects/${id}/buy`,      {}, { auth: true }); }
export async function equipEntryEffect(id: number) { return api.post(`/api/me/entry-effects/${id}/equip`, {}, { auth: true }); }

// ==================================================
// 3) BLOCKS
// ==================================================
export function useBlockedUsers() {
  const s = useApiList<BlockedUser>("/api/me/blocks", []);
  return {
    ...s,
    ids: s.data.map(u => u.user_id),
    isBlocked: (uid: number) => s.data.some(u => u.user_id === uid),
  };
}
export async function blockUser(userId: number, reason?: string) {
  return api.post("/api/me/blocks", { user_id: userId, reason }, { auth: true });
}
export async function unblockUser(userId: number) {
  return api.delete(`/api/me/blocks/${userId}`, { auth: true });
}

// ==================================================
// 4) ROOM MUTES
// type = "live" | "party"
// ==================================================
export function useRoomMutes(type: "live" | "party" | null, roomId: number | string | null) {
  const path = type && roomId ? `/api/rooms/${type}/${roomId}/mutes` : null;
  const s = useApiList<RoomMute>(path, [type, roomId]);
  return {
    ...s,
    ids: s.data.map(u => u.user_id),
    isMuted: (uid: number) => s.data.some(u => u.user_id === uid),
  };
}
export async function muteInRoom(type: "live" | "party", roomId: number | string, userId: number, durationMin = 30) {
  return api.post(`/api/rooms/${type}/${roomId}/mutes`, { user_id: userId, duration_minutes: durationMin }, { auth: true });
}
export async function unmuteInRoom(type: "live" | "party", roomId: number | string, userId: number) {
  return api.delete(`/api/rooms/${type}/${roomId}/mutes/${userId}`, { auth: true });
}

// ==================================================
// 5) POST COMMENTS
// ==================================================
export function usePostComments(postId: number | null) {
  const path = postId ? `/api/posts/${postId}/comments` : null;
  return useApiList<PostComment>(path, [postId]);
}
export async function addPostComment(postId: number, text: string) {
  return api.post(`/api/posts/${postId}/comments`, { text }, { auth: true });
}
export async function deletePostComment(postId: number, commentId: number) {
  return api.delete(`/api/posts/${postId}/comments/${commentId}`, { auth: true });
}
