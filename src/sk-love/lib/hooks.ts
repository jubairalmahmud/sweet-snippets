// @ts-nocheck
// React Query hooks for all 10 backend features.
// Import from a component: import { useLiveRooms, useFollow, ... } from "@/sk-love/lib/hooks";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "./api";
import { ENDPOINTS } from "./endpoints";

// ------------------------------------------------------------------
// 1. Live Rooms
// ------------------------------------------------------------------
export type LiveRoom = {
  id: number;
  host_id: number;
  title: string;
  cover_url?: string | null;
  status: "live" | "ended";
  viewer_count: number;
  started_at?: string | null;
  ended_at?: string | null;
};

export function useLiveRooms(params?: { status?: "live" | "ended" }) {
  const qs = params?.status ? `?status=${params.status}` : "";
  return useQuery({
    queryKey: ["live-rooms", params?.status ?? "live"],
    queryFn: () => api.get<{ data: LiveRoom[] }>(ENDPOINTS.liveRooms.list + qs),
    staleTime: 15_000,
  });
}

export function useLiveRoom(id: number | string | null) {
  return useQuery({
    queryKey: ["live-room", id],
    queryFn: () => api.get<{ data: LiveRoom }>(ENDPOINTS.liveRooms.show(id!)),
    enabled: id != null,
  });
}

export function useCreateLiveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; cover_url?: string }) =>
      api.post<{ data: LiveRoom }>(ENDPOINTS.liveRooms.create, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-rooms"] }),
  });
}

export function useJoinLiveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => api.post(ENDPOINTS.liveRooms.join(id)),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["live-rooms"] });
      qc.invalidateQueries({ queryKey: ["live-room", id] });
    },
  });
}

export function useLeaveLiveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => api.post(ENDPOINTS.liveRooms.leave(id)),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["live-rooms"] });
      qc.invalidateQueries({ queryKey: ["live-room", id] });
    },
  });
}

export function useEndLiveRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => api.post(ENDPOINTS.liveRooms.end(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-rooms"] }),
  });
}

// ------------------------------------------------------------------
// 2. Chat / Messages
// ------------------------------------------------------------------
export type Message = {
  id: number;
  sender_id: number;
  receiver_id: number;
  body: string;
  kind: "text" | "image" | "gift" | "system";
  read_at?: string | null;
  created_at: string;
};

export type RoomMessage = {
  id: number;
  room_id: number;
  user_id: number;
  username?: string;
  avatar_url?: string | null;
  body: string;
  kind: "text" | "gift" | "system";
  created_at: string;
};

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<{ data: any[] }>(ENDPOINTS.messages.conversations),
    refetchInterval: 15_000,
  });
}

export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ["messages-unread"],
    queryFn: () => api.get<{ count: number }>(ENDPOINTS.messages.unreadCount),
    refetchInterval: 20_000,
  });
}

export function useThread(peerId: number | string | null) {
  return useQuery({
    queryKey: ["thread", peerId],
    queryFn: () => api.get<{ data: Message[] }>(ENDPOINTS.messages.thread(peerId!)),
    enabled: peerId != null,
    refetchInterval: 5_000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { receiver_id: number; body: string; kind?: Message["kind"] }) =>
      api.post<{ data: Message }>(ENDPOINTS.messages.send, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["thread", vars.receiver_id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (peerId: number | string) => api.post(ENDPOINTS.messages.markRead(peerId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages-unread"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useRoomMessages(roomId: number | string | null) {
  return useQuery({
    queryKey: ["room-messages", roomId],
    queryFn: () => api.get<{ data: RoomMessage[] }>(ENDPOINTS.messages.roomList(roomId!)),
    enabled: roomId != null,
    refetchInterval: 3_000,
  });
}

export function useSendRoomMessage(roomId: number | string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string; kind?: RoomMessage["kind"] }) =>
      api.post(ENDPOINTS.messages.roomSend(roomId), body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["room-messages", roomId] }),
  });
}

// ------------------------------------------------------------------
// 3. Followers / Following
// ------------------------------------------------------------------
export function useFollowStats(userId: number | string | null) {
  return useQuery({
    queryKey: ["follow-stats", userId],
    queryFn: () =>
      api.get<{ followers: number; following: number; is_following?: boolean }>(
        ENDPOINTS.follows.stats(userId!),
      ),
    enabled: userId != null,
  });
}

export function useFollowers(userId: number | string | null) {
  return useQuery({
    queryKey: ["followers", userId],
    queryFn: () => api.get<{ data: any[] }>(ENDPOINTS.follows.followers(userId!)),
    enabled: userId != null,
  });
}

export function useFollowing(userId: number | string | null) {
  return useQuery({
    queryKey: ["following", userId],
    queryFn: () => api.get<{ data: any[] }>(ENDPOINTS.follows.following(userId!)),
    enabled: userId != null,
  });
}

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number | string) => api.post(ENDPOINTS.follows.follow(userId)),
    onSuccess: (_d, userId) => {
      qc.invalidateQueries({ queryKey: ["follow-stats", userId] });
      qc.invalidateQueries({ queryKey: ["followers", userId] });
    },
  });
}

export function useUnfollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number | string) => api.delete(ENDPOINTS.follows.unfollow(userId)),
    onSuccess: (_d, userId) => {
      qc.invalidateQueries({ queryKey: ["follow-stats", userId] });
      qc.invalidateQueries({ queryKey: ["followers", userId] });
    },
  });
}

// ------------------------------------------------------------------
// 4. Notifications
// ------------------------------------------------------------------
export type Notification = {
  id: number;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  read_at?: string | null;
  created_at: string;
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ data: Notification[] }>(ENDPOINTS.notifications.list),
    refetchInterval: 30_000,
  });
}

export function useNotificationUnread() {
  return useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => api.get<{ count: number }>(ENDPOINTS.notifications.unreadCount),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => api.post(ENDPOINTS.notifications.markRead(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(ENDPOINTS.notifications.markAllRead),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });
}

// ------------------------------------------------------------------
// 5. Reports / Moderation
// ------------------------------------------------------------------
export type ReportInput = {
  target_type: "user" | "room" | "message";
  target_id: number;
  reason: string;
  description?: string;
};

export function useCreateReport() {
  return useMutation({
    mutationFn: (body: ReportInput) => api.post(ENDPOINTS.reports.create, body),
  });
}

export function useAdminReports(status: "pending" | "resolved" | "rejected" = "pending") {
  return useQuery({
    queryKey: ["admin-reports", status],
    queryFn: () => api.get<{ data: any[] }>(`${ENDPOINTS.reports.adminList}?status=${status}`),
    placeholderData: keepPreviousData,
  });
}

export function useReviewReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number | string; status: "resolved" | "rejected" }) =>
      api.post(ENDPOINTS.reports.review(vars.id), { status: vars.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });
}

// ------------------------------------------------------------------
// 6. Leaderboard
// ------------------------------------------------------------------
export type LeaderboardPeriod = "daily" | "weekly" | "monthly" | "all";

export function useLeaderboard(
  kind: "senders" | "receivers",
  period: LeaderboardPeriod = "weekly",
) {
  const path = kind === "senders" ? ENDPOINTS.leaderboard.senders : ENDPOINTS.leaderboard.receivers;
  const joiner = path.includes("?") ? "&" : "?";
  return useQuery({
    queryKey: ["leaderboard", kind, period],
    queryFn: () => api.get<{ data: any[] }>(`${path}${joiner}period=${period}`),
    staleTime: 60_000,
  });
}

// ------------------------------------------------------------------
// 7. Search
// ------------------------------------------------------------------
export function useUserSearch(q: string) {
  return useQuery({
    queryKey: ["search-users", q],
    queryFn: () => api.get<{ data: any[] }>(`${ENDPOINTS.search.users}?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}

export function useRoomSearch(q: string) {
  return useQuery({
    queryKey: ["search-rooms", q],
    queryFn: () =>
      api.get<{ data: LiveRoom[] }>(`${ENDPOINTS.search.rooms}?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
}

// ------------------------------------------------------------------
// 8. App Settings
// ------------------------------------------------------------------
export function usePublicSettings() {
  return useQuery({
    queryKey: ["settings-public"],
    queryFn: () => api.get<Record<string, any>>(ENDPOINTS.settings.public),
    staleTime: 5 * 60_000,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ["settings-admin"],
    queryFn: () => api.get<{ data: any[] }>(ENDPOINTS.settings.adminList),
  });
}

export function useUpsertSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; value: any }) =>
      api.post(ENDPOINTS.settings.adminUpsert, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-admin"] });
      qc.invalidateQueries({ queryKey: ["settings-public"] });
    },
  });
}

export function useDeleteSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.delete(ENDPOINTS.settings.adminDelete(key)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-admin"] });
      qc.invalidateQueries({ queryKey: ["settings-public"] });
    },
  });
}

// ------------------------------------------------------------------
// 9. Push Notifications (FCM)
// ------------------------------------------------------------------
export function useRegisterPushToken() {
  return useMutation({
    mutationFn: (body: { token: string; platform: "android" | "ios" | "web" }) =>
      api.post(ENDPOINTS.push.register, body),
  });
}

export function useUnregisterPushToken() {
  return useMutation({
    mutationFn: (token: string) =>
      api.delete(`${ENDPOINTS.push.unregister}?token=${encodeURIComponent(token)}`),
  });
}

// ------------------------------------------------------------------
// 10. Audit Logs (admin)
// ------------------------------------------------------------------
export function useAuditLogs(params?: { action?: string; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.action) qs.set("action", params.action);
  if (params?.limit) qs.set("limit", String(params.limit));
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return useQuery({
    queryKey: ["audit-logs", params?.action ?? "", params?.limit ?? 0],
    queryFn: () => api.get<{ data: any[] }>(ENDPOINTS.audit.list + tail),
    placeholderData: keepPreviousData,
  });
}

// ------------------------------------------------------------------
// 11. Gift Catalog (admin)
// ------------------------------------------------------------------
export type GiftCatalogItem = {
  id: number;
  name: string;
  emoji?: string | null;
  image?: string | null;
  price: number;
  category?: string;
  sortOrder?: number;
  active?: boolean;
};

export function useGiftCatalog() {
  return useQuery({
    queryKey: ["gift-catalog"],
    queryFn: () => api.get<{ data: GiftCatalogItem[] }>(ENDPOINTS.giftCatalog.list),
    staleTime: 60_000,
  });
}

export function useAdminGiftCatalog() {
  return useQuery({
    queryKey: ["admin-gift-catalog"],
    queryFn: () => api.get<{ data: GiftCatalogItem[] }>(ENDPOINTS.giftCatalog.adminList),
    staleTime: 30_000,
  });
}

export function useCreateGiftCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<GiftCatalogItem, "id">) =>
      api.post<{ data: GiftCatalogItem }>(ENDPOINTS.giftCatalog.create, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gift-catalog"] });
      qc.invalidateQueries({ queryKey: ["gift-catalog"] });
    },
  });
}

export function useUpdateGiftCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number | string; body: Partial<GiftCatalogItem> }) =>
      api.patch<{ data: GiftCatalogItem }>(ENDPOINTS.giftCatalog.update(vars.id), vars.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gift-catalog"] });
      qc.invalidateQueries({ queryKey: ["gift-catalog"] });
    },
  });
}

export function useDeleteGiftCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => api.delete(ENDPOINTS.giftCatalog.delete(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-gift-catalog"] });
      qc.invalidateQueries({ queryKey: ["gift-catalog"] });
    },
  });
}
