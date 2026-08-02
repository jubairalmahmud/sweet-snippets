// @ts-nocheck
// All Laravel API endpoint paths in one place for easy maintenance.
// Grouped by the 10 feature areas implemented on the backend.

export const ENDPOINTS = {
  // 1. Live Rooms
  liveRooms: {
    list: "/api/live-rooms",
    create: "/api/live-rooms",
    show: (id: number | string) => `/api/live-rooms/${id}`,
    join: (id: number | string) => `/api/live-rooms/${id}/join`,
    leave: (id: number | string) => `/api/live-rooms/${id}/leave`,
    end: (id: number | string) => `/api/live-rooms/${id}/end`,
    heartbeat: (id: number | string) => `/api/live-rooms/${id}/heartbeat`,
    viewers: (id: number | string) => `/api/live-rooms/${id}/viewers`,
    roomMessages: (id: number | string) => `/api/live-rooms/${id}/messages`,
  },

  // 1.5. 1-to-1 Calls
  calls: {
    create: "/api/call-sessions",
    end: (id: number | string) => `/api/call-sessions/${id}/end`,
  },

  // 1.6. Social Posts
  posts: {
    list: "/api/posts",
    create: "/api/posts",
    byUser: (userId: number | string) => `/api/posts?user_id=${userId}`,
  },

  // 2. Chat / Messages
  messages: {
    conversations: "/api/messages/conversations",
    unreadCount: "/api/messages/unread-count",
    thread: (peerId: number | string) => `/api/messages/${peerId}`,
    send: "/api/messages",
    markRead: (peerId: number | string) => `/api/messages/${peerId}/read`,
    roomList: (roomId: number | string) => `/api/live-rooms/${roomId}/messages`,
    roomSend: (roomId: number | string) => `/api/live-rooms/${roomId}/messages`,
  },

  // 3. Followers / Following
  follows: {
    follow: (userId: number | string) => `/api/users/${userId}/follow`,
    unfollow: (userId: number | string) => `/api/users/${userId}/follow`,
    followers: (userId: number | string) => `/api/users/${userId}/followers`,
    following: (userId: number | string) => `/api/users/${userId}/following`,
    stats: (userId: number | string) => `/api/users/${userId}/follow-stats`,
  },

  // 4. Notifications
  notifications: {
    list: "/api/notifications",
    unreadCount: "/api/notifications/unread-count",
    markRead: (id: number | string) => `/api/notifications/${id}/read`,
    markAllRead: "/api/notifications/read-all",
  },

  // 5. Reports / Moderation
  reports: {
    create: "/api/reports",
    adminList: "/api/admin/reports",
    review: (id: number | string) => `/api/admin/reports/${id}/review`,
  },

  // 6. Leaderboard
  leaderboard: {
    senders: "/api/leaderboard?role=sender",
    receivers: "/api/leaderboard?role=receiver",
  },

  // 7. Search
  search: {
    users: "/api/search/users",
    rooms: "/api/search/rooms",
  },

  // 8. App Settings
  settings: {
    public: "/api/app-settings",
    adminList: "/api/admin/app-settings",
    adminUpsert: "/api/admin/app-settings",
    adminDelete: (key: string) => `/api/admin/app-settings/${key}`,
  },

  // 9. Push Notifications (FCM)
  push: {
    register: "/api/push-tokens",
    unregister: "/api/push-tokens",
  },

  // 10. Audit Logs
  audit: {
    list: "/api/admin/audit-logs",
  },

  // 11. Gift Catalog
  giftCatalog: {
    list: "/api/gift-catalog",
    adminList: "/api/admin/gift-catalog",
    create: "/api/admin/gift-catalog",
    update: (id: number | string) => `/api/admin/gift-catalog/${id}`,
    delete: (id: number | string) => `/api/admin/gift-catalog/${id}`,
  },
} as const;
