// @ts-nocheck
/**
 * ============================================================================
 *  PKWatchView — Spectator UI for a live PK battle.
 *  Exact TikTok / Bigo style layout matching reference design.
 *  Read-only view: shows both hosts in 50/50 split, live scores, 3D VS logo,
 *  timer, top contributors, live chat overlay, floating hearts & gifting.
 * ============================================================================
 */
import { useEffect, useRef, useState, useMemo } from "react";
import type { MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { X, Send, Gift, Heart, Share2, Star, Plus, CornerDownRight, Reply, AtSign } from "lucide-react";
import { api } from "../lib/api";

// Dynamic Agora import — matches App.tsx SSR-safe pattern
const AgoraRTCPromise: Promise<typeof import("agora-rtc-sdk-ng").default> =
  typeof window !== "undefined"
    ? import("agora-rtc-sdk-ng").then((m) => m.default)
    : (Promise.resolve(null as any));

type ActiveBattle = {
  id: number | string;
  from_host_id: number;
  to_host_id: number;
  from_name?: string;
  to_name?: string;
  from_username?: string;
  to_username?: string;
  from_avatar?: string | null;
  to_avatar?: string | null;
  from_flag?: string;
  to_flag?: string;
  from_score: number;
  to_score: number;
  duration_minutes: number;
  status: string;
  ends_at?: string | null;
  remaining_sec?: number | null;
  from_room_id?: number | null;
  to_room_id?: number | null;
  viewers?: number;
  from_wins?: number;
  to_wins?: number;
};

type PKComment = {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_avatar?: string | null;
  avatar?: string | null;
  role: "host_from" | "host_to" | "viewer";
  text: string;
  level?: number;
  created_at?: string | null;
  replyTo?: { name: string; text: string } | null;
};

export type PKGiftItem = {
  id: string;
  name: string;
  icon: string;
  diamonds: number;
  rCoins: number;
  image?: string | null;
};

export type SideGiftOverlayItem = {
  id: string;
  side: "from" | "to";
  giftName: string;
  giftIcon: string;
  giftImage?: string | null;
  diamonds: number;
  senderName: string;
  senderAvatar?: string | null;
  receiverName: string;
};

interface Props {
  open: boolean;
  onClose: () => void;
  battleId: number | string | null;
  currentUser: { id: number | string; name?: string; avatar?: string | null } | null;
  apiBase?: string;
  authToken?: string | null;
  existingRoomId?: number | string | null;
  existingRemoteVideos?: Array<{ uid: string; track: any }>;
  gifts?: PKGiftItem[];
  onSendGift?: (gift: PKGiftItem, targetHostId: number) => void | Promise<void>;
  /** Fired once when the battle ends naturally or is closed.
   *  Parent decides where to send the viewer next (next PK, livestream, or Explore). */
  onEnded?: (endedBattleId: number | string) => void;
}

const fmtTime = (sec: number) => {
  const total = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const buildUrl = (apiBase: string | undefined, path: string) => {
  const cleanPath = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  if (!apiBase) return cleanPath;
  const base = apiBase.replace(/\/+$/, "");
  return base.endsWith("/api") ? `${base}${cleanPath.slice(4)}` : `${base}${cleanPath}`;
};

const httpGet = async (apiBase: string | undefined, path: string, authToken?: string | null) => {
  if (!apiBase) {
    const endpoint = path.startsWith("/api/") ? path : `/api${path}`;
    return api.get<any>(
      endpoint,
      authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
    );
  }
  const res = await fetch(buildUrl(apiBase, path), {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.message || payload?.error || `Request failed with status ${res.status}`);
  return payload;
};

const httpPost = async (apiBase: string | undefined, path: string, body: unknown, authToken?: string | null) => {
  if (!apiBase) {
    const endpoint = path.startsWith("/api/") ? path : `/api${path}`;
    return api.post<any>(
      endpoint,
      body,
      authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
    );
  }
  const res = await fetch(buildUrl(apiBase, path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.message || payload?.error || `Request failed with status ${res.status}`);
  return payload;
};

const notifyPkCommentError = (message: string) => {
  try {
    window.dispatchEvent(
      new CustomEvent("sk-love-toast", {
        detail: { message, tone: "warn" },
      }),
    );
  } catch {
    // no-op
  }
};

type FloatingHeartItem = {
  id: number;
  right: number;
  speed: number;
  emoji: string;
};

export default function PKWatchView({
  open,
  onClose,
  battleId,
  currentUser,
  apiBase = "",
  authToken,
  existingRoomId = null,
  existingRemoteVideos = [],
  gifts = [],
  onSendGift,
  onEnded,
}: Props) {
  const [battle, setBattle] = useState<ActiveBattle | null>(null);
  const [remaining, setRemaining] = useState<number>(86); // default timer
  const [comments, setComments] = useState<PKComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTarget, setGiftTarget] = useState<"from" | "to" | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hearts, setHearts] = useState<FloatingHeartItem[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ name: string; text: string } | null>(null);
  const [sideGifts, setSideGifts] = useState<SideGiftOverlayItem[]>([]);

  const triggerSideGift = (
    side: "from" | "to",
    gift: { name: string; icon?: string; diamonds?: number; image?: string | null },
    senderName: string,
    senderAvatar?: string | null,
    receiverName?: string,
    giftKey?: string,
  ) => {
    const id = giftKey || `side_gift_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    setSideGifts((prev) => {
      if (prev.some((g) => g.id === id)) return prev;

      const now = Date.now();
      const isRecentDuplicate = prev.some(
        (g) =>
          g.side === side &&
          g.senderName === senderName &&
          g.giftName === gift.name &&
          Math.abs(now - (g.timestamp || 0)) < 2500
      );
      if (isRecentDuplicate) return prev;

      const item: SideGiftOverlayItem & { timestamp?: number } = {
        id,
        side,
        giftName: gift.name || "Special Gift",
        giftIcon: gift.icon || "🎁",
        giftImage: gift.image || null,
        diamonds: gift.diamonds || 100,
        senderName: senderName || "Gifter",
        senderAvatar: senderAvatar || null,
        receiverName:
          receiverName ||
          (side === "from" ? (battle?.from_name || "Host A") : (battle?.to_name || "Host B")),
        timestamp: now,
      };

      return [...prev.slice(-2), item];
    });

    setTimeout(() => {
      setSideGifts((prev) => prev.filter((g) => g.id !== id));
    }, 3500);
  };

  const renderFormattedCommentText = (text: string) => {
    if (!text) return "";
    const parts = text.split(/(@[\w\u0980-\u09FF.-]+)/g);
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith("@")) {
            return (
              <span
                key={index}
                className="font-black text-cyan-300 bg-cyan-950/80 px-1 py-0.5 rounded text-[10px] mx-0.5 border border-cyan-400/40 shadow-sm"
              >
                {part}
              </span>
            );
          }
          return part;
        })}
      </>
    );
  };

  const lastWordInDraft = (draft.split(" ").pop() || "").trim();
  const isMentioningUser = lastWordInDraft.startsWith("@");
  const mentionQuery = isMentioningUser ? lastWordInDraft.slice(1).toLowerCase() : "";

  const pkParticipants = useMemo(() => {
    const map = new Map<string, { name: string; avatar?: string | null }>();
    if (battle?.from_name) map.set(battle.from_name, { name: battle.from_name, avatar: battle.from_avatar });
    if (battle?.to_name) map.set(battle.to_name, { name: battle.to_name, avatar: battle.to_avatar });
    comments.forEach((c) => {
      const uName = c.user_name || `user_${c.user_id}`;
      if (uName && !map.has(uName)) {
        map.set(uName, { name: uName, avatar: c.user_avatar || c.avatar });
      }
    });
    return Array.from(map.values());
  }, [battle?.from_name, battle?.from_avatar, battle?.to_name, battle?.to_avatar, comments]);

  const filteredMentionSuggestions = useMemo(() => {
    if (!isMentioningUser) return [];
    return pkParticipants.filter(
      (p) =>
        p.name.toLowerCase().includes(mentionQuery) ||
        p.name.toLowerCase().replace(/\s+/g, "").includes(mentionQuery),
    );
  }, [isMentioningUser, mentionQuery, pkParticipants]);
  
  const lastCommentIdRef = useRef<number>(0);
  const endedTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Dual Agora refs
  const fromVideoRef = useRef<HTMLDivElement | null>(null);
  const toVideoRef = useRef<HTMLDivElement | null>(null);
  const [fromHasVideo, setFromHasVideo] = useState(false);
  const [toHasVideo, setToHasVideo] = useState(false);

  // Helper to close current PK and transition to next PK or live stream
  const handleCloseOrNext = () => {
    if (onEnded && battleId != null) {
      onEnded(battleId);
    } else {
      onClose();
    }
  };

  // Spawn floating heart animation
  const triggerFloatingHeart = (emoji = "❤️") => {
    const id = Date.now() + Math.random();
    const right = Math.floor(Math.random() * 20) + 12; // 12% - 32% from right
    const speed = 2.2 + Math.random() * 1.2;
    setHearts((prev) => [...prev.slice(-12), { id, right, speed, emoji }]);
    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== id));
    }, speed * 1000);
  };

  // Auto spawn hearts periodically
  useEffect(() => {
    if (!open) return;
    const heartEmojis = ["❤️", "💖", "💗", "💕", "🌹"];
    const interval = setInterval(() => {
      const randomEmoji = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
      triggerFloatingHeart(randomEmoji);
    }, 2200);
    return () => clearInterval(interval);
  }, [open]);

  /* ---------- Reuse existing live video track if viewer is already in that room ---------- */
  useEffect(() => {
    if (!open || !battle) return;
    const existingKey = existingRoomId == null ? "" : String(existingRoomId);
    if (!existingKey || existingRemoteVideos.length === 0) return;

    if (String(battle.from_room_id) === existingKey) {
      const video = existingRemoteVideos.find((item) => item?.track) || existingRemoteVideos[0];
      if (video?.track && fromVideoRef.current) {
        try {
          fromVideoRef.current.innerHTML = "";
          video.track.play(fromVideoRef.current);
          setFromHasVideo(true);
        } catch {
          /* ignore */
        }
      }
    }

    if (String(battle.to_room_id) === existingKey) {
      const video = existingRemoteVideos.find((item) => item?.track) || existingRemoteVideos[0];
      if (video?.track && toVideoRef.current) {
        try {
          toVideoRef.current.innerHTML = "";
          video.track.play(toVideoRef.current);
          setToHasVideo(true);
        } catch {
          /* ignore */
        }
      }
    }
  }, [open, battle?.from_room_id, battle?.to_room_id, existingRoomId, existingRemoteVideos]);

  /* ---------- Dual Agora subscribe (from + to) ---------- */
  useEffect(() => {
    if (!open || !battle || (!battle.from_room_id && !battle.to_room_id)) return;
    let cancelled = false;
    const clients: any[] = [];
    const retryTimers: number[] = [];

    const joinSide = async (
      roomId: number,
      containerRef: MutableRefObject<HTMLDivElement | null>,
      setHasVideo: (v: boolean) => void,
    ) => {
      try {
        const AgoraRTC = await AgoraRTCPromise;
        if (!AgoraRTC || cancelled) return;
        const channelName = `live_${roomId}`;
        const tokenData: any = await httpPost(
          apiBase,
          "/agora/token",
          { channelName, role: "subscriber" },
          authToken,
        );
        if (cancelled || !tokenData?.appId || !tokenData?.channelName) return;

        const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        await client.setClientRole("audience");
        clients.push(client);

        const subscribeAndPlay = async (user: any, mediaType: "video" | "audio") => {
          try {
            await client.subscribe(user, mediaType);
            if (mediaType === "video" && containerRef.current) {
              containerRef.current.innerHTML = "";
              user.videoTrack?.play(containerRef.current);
              setHasVideo(true);
            }
            if (mediaType === "audio") {
              user.audioTrack?.play();
            }
          } catch {
            /* ignore */
          }
        };

        client.on("user-published", async (user: any, mediaType: string) => {
          if (mediaType === "video" || mediaType === "audio") {
            await subscribeAndPlay(user, mediaType);
          }
        });
        client.on("user-unpublished", (_user: any, mediaType: string) => {
          if (mediaType === "video") setHasVideo(false);
        });

        const uid = /^\d+$/.test(String(tokenData.uid))
          ? Number(tokenData.uid)
          : (tokenData.uid ?? null);
        await client.join(tokenData.appId, tokenData.channelName, tokenData.token || null, uid);

        const subscribeExistingRemotes = () => {
          (client.remoteUsers || []).forEach((user: any) => {
            if (user?.hasVideo) void subscribeAndPlay(user, "video");
            if (user?.hasAudio) void subscribeAndPlay(user, "audio");
          });
        };
        subscribeExistingRemotes();
        const retryId = window.setInterval(subscribeExistingRemotes, 1000);
        retryTimers.push(retryId);
        window.setTimeout(() => window.clearInterval(retryId), 10000);
      } catch {
        /* ignore */
      }
    };

    if (battle.from_room_id) joinSide(Number(battle.from_room_id), fromVideoRef, setFromHasVideo);
    if (battle.to_room_id) joinSide(Number(battle.to_room_id), toVideoRef, setToHasVideo);

    return () => {
      cancelled = true;
      retryTimers.forEach((id) => window.clearInterval(id));
      clients.forEach((c) => {
        try {
          c.removeAllListeners?.();
          c.leave?.();
        } catch {
          /* ignore */
        }
      });
      setFromHasVideo(false);
      setToHasVideo(false);
    };
  }, [open, battle?.from_room_id, battle?.to_room_id, apiBase, authToken]);

  /* ---------- reset on close ---------- */
  useEffect(() => {
    if (!open) {
      setBattle(null);
      setComments([]);
      setDraft("");
      setGiftOpen(false);
      setGiftTarget(null);
      setIsFollowing(false);
      lastCommentIdRef.current = 0;
      if (endedTimerRef.current) {
        window.clearTimeout(endedTimerRef.current);
        endedTimerRef.current = null;
      }
    } else {
      setComments([]);
    }
  }, [open]);

  /* ---------- poll battle score + status ---------- */
  useEffect(() => {
    if (!open || !battleId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const j: any = await httpGet(apiBase, `/pk/${battleId}/score`, authToken);
        if (cancelled) return;
        const d = j?.data;
        if (!d) return;
        setBattle((prev) => ({ ...(prev || ({} as any)), ...d }));
        if (typeof d.remaining_sec === "number") setRemaining(d.remaining_sec);
        
        // Auto-switch when PK ends or status becomes ended/closed
        if (d.status && d.status !== "active") {
          const endedId = battleId;
          if (endedTimerRef.current) return;
          endedTimerRef.current = window.setTimeout(() => {
            if (cancelled) return;
            handleCloseOrNext();
          }, 1500);
        }
      } catch {
        /* ignore */
      }
    };

    (async () => {
      try {
        const j: any = await httpGet(apiBase, "/pk/active", authToken);
        const arr: ActiveBattle[] = Array.isArray(j?.data) ? j.data : [];
        const hit = arr.find((b) => String(b.id) === String(battleId));
        if (hit && !cancelled) {
          setBattle(hit);
          if (typeof hit.remaining_sec === "number") setRemaining(hit.remaining_sec);
        }
      } catch {
        /* ignore */
      }
    })();

    tick();
    const iv = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [open, battleId, apiBase, authToken]);

  /* ---------- countdown timer & auto-switch on 0 ---------- */
  useEffect(() => {
    if (!open) return;
    const iv = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(iv);
          setTimeout(() => {
            handleCloseOrNext();
          }, 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(iv);
  }, [open]);

  /* ---------- comment polling ---------- */
  useEffect(() => {
    if (!open || !battleId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const path =
          lastCommentIdRef.current > 0
            ? `/pk/${battleId}/comments?after_id=${lastCommentIdRef.current}`
            : `/pk/${battleId}/comments`;
        const j: any = await httpGet(apiBase, path, authToken);
        if (cancelled) return;
        const arr: PKComment[] = Array.isArray(j?.data) ? j.data : [];
        if (arr.length) {
          setComments((prev) => {
            const seen = new Set(prev.map((c) => c.id));
            const merged = [...prev];
            arr.forEach((c) => {
              if (!seen.has(c.id)) {
                merged.push(c);
                if (c.text && (c.text.startsWith("sent ") || c.text.includes("🪙)"))) {
                  const isMe =
                    Boolean(currentUser?.name && c.user_name === currentUser.name) ||
                    Boolean(currentUser?.id && String(c.user_id) === String(currentUser.id));

                  if (!isMe) {
                    const giftMatch = c.text.match(/sent\s+(\S+)\s+([^()]+)(?:\((\d+)(?:🪙|💎)?\))?/);
                    if (giftMatch) {
                      const giftIcon = giftMatch[1] || "🎁";
                      const giftName = giftMatch[2]?.trim() || "Gift";
                      const diamonds = Number(giftMatch[3]) || 100;

                      const targetHostIdStr = String((c as any).receiver_id || (c as any).target_host_id || "");
                      const toHostIdStr = String(battle?.to_host_id || "");
                      const fromHostIdStr = String(battle?.from_host_id || "");

                      let isTo = false;
                      if (targetHostIdStr && targetHostIdStr === toHostIdStr) {
                        isTo = true;
                      } else if (targetHostIdStr && targetHostIdStr === fromHostIdStr) {
                        isTo = false;
                      } else if (battle?.to_name && c.text.toLowerCase().includes(battle.to_name.toLowerCase())) {
                        isTo = true;
                      } else if (c.text.toLowerCase().includes("team blue") || c.text.toLowerCase().includes("host b")) {
                        isTo = true;
                      }

                      const side = isTo ? "to" : "from";
                      const hostName = isTo ? (battle?.to_name || "Host B") : (battle?.from_name || "Host A");

                      triggerSideGift(
                        side,
                        { name: giftName, icon: giftIcon, diamonds },
                        c.user_name || "Viewer",
                        c.user_avatar || c.avatar,
                        hostName,
                        `comment_gift_${c.id}`,
                      );
                    }
                  }
                }
              }
            });
            merged.sort((a, b) => a.id - b.id);
            const last = merged[merged.length - 1];
            if (last && last.id > lastCommentIdRef.current) lastCommentIdRef.current = last.id;
            return merged.slice(-50);
          });
        }
      } catch {
        /* ignore */
      }
    };

    poll();
    const iv = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [open, battleId, apiBase, authToken]);

  /* ---------- autoscroll ---------- */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [comments.length]);

  const sendComment = async () => {
    const t = draft.trim();
    if (!t || !battleId || sending) return;
    setSending(true);
    const tempId = -Date.now();
    const currentReply = replyingTo;
    const userAv = currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser?.name || "You")}`;
    setComments((prev) => [
      ...prev,
      {
        id: tempId,
        user_id: Number(currentUser?.id ?? 0),
        user_name: currentUser?.name || "You",
        user_avatar: userAv,
        role: "viewer",
        text: t,
        level: 12,
        replyTo: currentReply,
      },
    ]);
    setDraft("");
    setReplyingTo(null);
    triggerFloatingHeart("❤️");
    try {
      const j: any = await httpPost(
        apiBase,
        `/pk/${battleId}/comment`,
        { text: t, reply_to: currentReply },
        authToken,
      );
      if (j?.comment) {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, ...j.comment, replyTo: currentReply } : c)),
        );
        if (j.comment.id > lastCommentIdRef.current) lastCommentIdRef.current = j.comment.id;
      }
    } catch (e: any) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setDraft(t);
      notifyPkCommentError(`PK comment failed: ${String(e?.message || "Server error")}`);
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const b = battle;
  const leftScore = b?.from_score ?? 0;
  const rightScore = b?.to_score ?? 0;
  const leftPct =
    leftScore === 0 && rightScore === 0
      ? 50
      : Math.min(85, Math.max(15, (leftScore / (leftScore + rightScore)) * 100));

  const hostAName = b?.from_name || "Host";
  const hostBName = b?.to_name || "Host";
  const hostAAvatar = b?.from_avatar || undefined;
  const hostBAvatar = b?.to_avatar || undefined;
  const hostAFlag = b?.from_flag || "";
  const hostBFlag = b?.to_flag || "";
  const viewersCount = b?.viewers ?? 1;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col justify-between overflow-hidden font-sans select-none text-white">
      {/* Dynamic Floating Hearts Layer */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        {hearts.map((h) => (
          <div
            key={h.id}
            className="absolute bottom-20 text-2xl animate-float-up opacity-90 drop-shadow-[0_2px_8px_rgba(244,63,94,0.8)]"
            style={{
              right: `${h.right}%`,
              animationDuration: `${h.speed}s`,
            }}
          >
            {h.emoji}
          </div>
        ))}
      </div>

      {/* 1. TOP HOST HEADER BAR */}
      <div className="shrink-0 z-30 pt-3 px-3 pb-2 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        {/* Left: Host Info Pill */}
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full p-1 pr-3 border border-white/10 shadow-lg">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-pink-500/80 shrink-0 bg-slate-800 flex items-center justify-center">
            {hostAAvatar ? (
              <img src={hostAAvatar} alt={hostAName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-slate-300">{hostAName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[12px] font-black text-white truncate max-w-[85px] drop-shadow-sm">
                {hostAName}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-extrabold bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1 py-[1px] rounded flex items-center gap-[2px]">
                <Star className="w-2 h-2 fill-white text-white" /> LIVE Pro
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsFollowing((v) => !v)}
            className={`ml-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold transition shrink-0 flex items-center gap-0.5 shadow-md ${
              isFollowing
                ? "bg-white/20 text-white border border-white/30"
                : "bg-rose-500 hover:bg-rose-600 text-white active:scale-95"
            }`}
          >
            {!isFollowing && <Plus className="w-3 h-3 stroke-[3]" />}
            {isFollowing ? "Following" : "Follow"}
          </button>
        </div>

        {/* Right: Viewer Count & Close */}
        <div className="flex items-center gap-2">
          {/* Viewer count pill */}
          <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-bold text-white/90 flex items-center gap-1">
            <span>👤</span>
            <span>{viewersCount}</span>
          </div>

          {/* Close button */}
          <button
            onClick={handleCloseOrNext}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition"
            aria-label="Close PK View"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* 2. PK SCORE & TIMER TOP BAR */}
      <div className="shrink-0 z-30 px-3 py-1 relative">
        <div className="relative h-7 w-full flex rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-slate-950">
          {/* Left Pink Side Score */}
          <div
            className="bg-gradient-to-r from-rose-600 via-pink-500 to-rose-500 h-full transition-all duration-500 flex items-center justify-between px-2.5"
            style={{ width: `${leftPct}%` }}
          >
            <span className="text-[12px] font-black text-white tracking-wider drop-shadow">
              {leftScore.toLocaleString()}
            </span>
            {Boolean(b?.from_wins && b.from_wins > 0) && (
              <span className="bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950 font-black text-[9px] px-1.5 py-[1px] rounded shadow shrink-0">
                WIN × {b.from_wins}
              </span>
            )}
          </div>

          {/* Right Blue/Cyan Side Score */}
          <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 h-full flex-1 transition-all duration-500 flex items-center justify-between px-2.5">
            {Boolean(b?.to_wins && b.to_wins > 0) && (
              <span className="bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950 font-black text-[9px] px-1.5 py-[1px] rounded shadow shrink-0">
                WIN × {b.to_wins}
              </span>
            )}
            <span className="text-[12px] font-black text-white tracking-wider drop-shadow ml-auto">
              {rightScore.toLocaleString()}
            </span>
          </div>

          {/* Center 3D VS & Countdown Timer Overlay */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 shadow-xl">
            <span className="text-sm font-black italic tracking-tighter flex items-center leading-none">
              <span className="text-blue-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">V</span>
              <span className="text-pink-500 -ml-0.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">S</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-amber-300 tracking-wider">
              {fmtTime(remaining)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. SPLIT 50/50 LIVE VIDEO ARENA */}
      <div className="relative flex-1 bg-black grid grid-cols-2 gap-0.5 overflow-hidden my-1">
        {/* Left Host A Video (50%) */}
        <div className="relative h-full w-full bg-slate-900 overflow-hidden">
          <div ref={fromVideoRef} className="absolute inset-0 bg-black [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover" />
          {!fromHasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-950 via-slate-900 to-black">
              {hostAAvatar ? (
                <img
                  src={hostAAvatar}
                  alt={hostAName}
                  className="w-full h-full object-cover filter brightness-95"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-rose-900/60 border-2 border-rose-500/50 flex items-center justify-center text-white font-black text-2xl shadow-xl">
                  {hostAName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* Colorful Compact Host A Name Overlay inside video screen */}
          <div className="absolute bottom-2 left-2 z-30 flex items-center gap-1.5 bg-gradient-to-r from-rose-950/90 via-slate-950/85 to-black/90 backdrop-blur-md border border-rose-500/60 rounded-full px-2 py-0.5 shadow-lg shadow-rose-950/60 max-w-[92%] pointer-events-none">
            <div className="relative shrink-0">
              <img
                src={hostAAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(hostAName)}`}
                alt=""
                className="w-5 h-5 rounded-full object-cover border border-rose-400"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 border border-black animate-pulse" />
            </div>
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-[10px] font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-pink-200 to-amber-200 truncate max-w-[85px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {hostAName}
              </span>
              {hostAFlag && <span className="text-[10px] shrink-0">{hostAFlag}</span>}
            </div>
          </div>

          {/* Animated Gift Side Overlay for Left Host A */}
          {sideGifts
            .filter((g) => g.side === "from")
            .map((g) => (
              <div
                key={g.id}
                className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center p-2 bg-gradient-to-b from-rose-950/85 via-pink-950/65 to-black/90 backdrop-blur-[2px] animate-in fade-in zoom-in-75 duration-300"
              >
                <div className="absolute w-36 h-36 rounded-full bg-gradient-to-r from-rose-500/50 via-amber-400/40 to-pink-500/50 blur-xl animate-pulse" />
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <span className="absolute top-3 left-3 text-lg animate-bounce delay-75">✨</span>
                  <span className="absolute top-6 right-3 text-xl animate-bounce delay-150">🌹</span>
                  <span className="absolute bottom-10 left-4 text-lg animate-bounce delay-200">💎</span>
                  <span className="absolute bottom-5 right-4 text-lg animate-bounce delay-300">⭐</span>
                </div>
                <div className="relative z-10 flex items-center gap-1.5 bg-black/85 border border-rose-400/80 rounded-full px-2.5 py-1 shadow-2xl mb-1.5 backdrop-blur-md max-w-[95%]">
                  <img
                    src={
                      g.senderAvatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(g.senderName)}`
                    }
                    alt=""
                    className="w-5 h-5 rounded-full object-cover border border-rose-300 shrink-0"
                  />
                  <div className="text-[9.5px] font-extrabold truncate leading-none">
                    <span className="text-amber-300">{g.senderName}</span>
                    <span className="text-white/80 mx-1">GIFTED</span>
                    <span className="text-rose-300">{g.receiverName}</span>
                  </div>
                </div>
                <div className="relative z-10 my-0.5 animate-bounce">
                  {g.giftImage ? (
                    <img
                      src={g.giftImage}
                      alt={g.giftName}
                      className="w-16 h-16 object-contain filter drop-shadow-[0_8px_16px_rgba(244,63,94,0.9)]"
                    />
                  ) : (
                    <span className="text-5xl drop-shadow-[0_8px_20px_rgba(251,191,36,0.95)] select-none">
                      {g.giftIcon || "🎁"}
                    </span>
                  )}
                </div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="text-xs font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-100 to-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] text-center">
                    {g.giftName}
                  </div>
                  <div className="mt-0.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[9.5px] px-2 py-0.5 rounded-full shadow border border-yellow-200/50 flex items-center gap-1">
                    <span>💎</span>
                    <span>+{g.diamonds}</span>
                  </div>
                </div>
                <div className="relative z-10 mt-1 text-xl font-black italic text-yellow-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] tracking-tighter animate-pulse">
                  x1 COMBO!
                </div>
              </div>
            ))}
        </div>

        {/* Right Host B Video (50%) */}
        <div className="relative h-full w-full bg-slate-900 overflow-hidden">
          <div ref={toVideoRef} className="absolute inset-0 bg-black [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover" />
          {!toHasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-black">
              {hostBAvatar ? (
                <img
                  src={hostBAvatar}
                  alt={hostBName}
                  className="w-full h-full object-cover filter brightness-95"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-900/60 border-2 border-blue-500/50 flex items-center justify-center text-white font-black text-2xl shadow-xl">
                  {hostBName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* Colorful Compact Host B Name Overlay inside video screen */}
          <div className="absolute bottom-2 right-2 z-30 flex items-center gap-1.5 bg-gradient-to-r from-slate-950/90 via-slate-950/85 to-cyan-950/90 backdrop-blur-md border border-cyan-500/60 rounded-full px-2 py-0.5 shadow-lg shadow-cyan-950/60 max-w-[92%] pointer-events-none">
            <div className="flex items-center gap-1 min-w-0">
              {hostBFlag && <span className="text-[10px] shrink-0">{hostBFlag}</span>}
              <span className="text-[10px] font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-200 to-amber-200 truncate max-w-[85px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {hostBName}
              </span>
            </div>
            <div className="relative shrink-0">
              <img
                src={hostBAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(hostBName)}`}
                alt=""
                className="w-5 h-5 rounded-full object-cover border border-cyan-400"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 border border-black animate-pulse" />
            </div>
          </div>

          {/* Animated Gift Side Overlay for Right Host B */}
          {sideGifts
            .filter((g) => g.side === "to")
            .map((g) => (
              <div
                key={g.id}
                className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center p-2 bg-gradient-to-b from-cyan-950/85 via-blue-950/65 to-black/90 backdrop-blur-[2px] animate-in fade-in zoom-in-75 duration-300"
              >
                <div className="absolute w-36 h-36 rounded-full bg-gradient-to-r from-cyan-500/50 via-amber-400/40 to-blue-500/50 blur-xl animate-pulse" />
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <span className="absolute top-3 left-3 text-lg animate-bounce delay-75">✨</span>
                  <span className="absolute top-6 right-3 text-xl animate-bounce delay-150">🚀</span>
                  <span className="absolute bottom-10 left-4 text-lg animate-bounce delay-200">💎</span>
                  <span className="absolute bottom-5 right-4 text-lg animate-bounce delay-300">⭐</span>
                </div>
                <div className="relative z-10 flex items-center gap-1.5 bg-black/85 border border-cyan-400/80 rounded-full px-2.5 py-1 shadow-2xl mb-1.5 backdrop-blur-md max-w-[95%]">
                  <img
                    src={
                      g.senderAvatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(g.senderName)}`
                    }
                    alt=""
                    className="w-5 h-5 rounded-full object-cover border border-cyan-300 shrink-0"
                  />
                  <div className="text-[9.5px] font-extrabold truncate leading-none">
                    <span className="text-amber-300">{g.senderName}</span>
                    <span className="text-white/80 mx-1">GIFTED</span>
                    <span className="text-cyan-300">{g.receiverName}</span>
                  </div>
                </div>
                <div className="relative z-10 my-0.5 animate-bounce">
                  {g.giftImage ? (
                    <img
                      src={g.giftImage}
                      alt={g.giftName}
                      className="w-16 h-16 object-contain filter drop-shadow-[0_8px_16px_rgba(6,182,212,0.9)]"
                    />
                  ) : (
                    <span className="text-5xl drop-shadow-[0_8px_20px_rgba(251,191,36,0.95)] select-none">
                      {g.giftIcon || "🎁"}
                    </span>
                  )}
                </div>
                <div className="relative z-10 flex flex-col items-center">
                  <div className="text-xs font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-cyan-100 to-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] text-center">
                    {g.giftName}
                  </div>
                  <div className="mt-0.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[9.5px] px-2 py-0.5 rounded-full shadow border border-yellow-200/50 flex items-center gap-1">
                    <span>💎</span>
                    <span>+{g.diamonds}</span>
                  </div>
                </div>
                <div className="relative z-10 mt-1 text-xl font-black italic text-yellow-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] tracking-tighter animate-pulse">
                  x1 COMBO!
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* 4. LIVE CHAT & FLOATING REACTION AREA */}
      <div className="shrink-0 relative h-36 px-3 py-1 flex flex-col justify-end z-30">
        <div ref={scrollRef} className="max-h-32 overflow-y-auto space-y-1.5 pr-2 scrollbar-none">
          {comments.map((c) => {
            const avatarUrl =
              c.user_avatar ||
              c.avatar ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.user_name || String(c.user_id))}`;
            const userName = c.user_name || `user_${c.user_id}`;

            return (
              <div
                key={c.id}
                className="flex flex-col gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-2xl max-w-[85%] border border-white/10 shadow-md my-0.5"
              >
                {c.replyTo && (
                  <div className="flex items-center gap-1 text-[9px] text-fuchsia-300 font-semibold px-1.5 py-0.5 bg-fuchsia-950/80 rounded-md border border-fuchsia-500/30 truncate">
                    <CornerDownRight className="w-2.5 h-2.5 shrink-0 text-fuchsia-400" />
                    <span className="truncate">
                      Replying to @{c.replyTo.name}: "{c.replyTo.text}"
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 min-w-0">
                  <img
                    src={avatarUrl}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover shrink-0 border border-amber-300/40 shadow-sm"
                  />
                  <span className="text-[11px] font-extrabold text-amber-200 shrink-0 drop-shadow">
                    {userName}:
                  </span>
                  <span className="text-[11px] text-white leading-tight break-words flex-1 drop-shadow">
                    {renderFormattedCommentText(c.text)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyingTo({ name: userName, text: c.text })}
                    className="ml-1 text-[8.5px] font-bold text-fuchsia-300 hover:text-white bg-white/10 hover:bg-fuchsia-600 px-1.5 py-0.5 rounded-full transition active:scale-95 shrink-0 flex items-center gap-0.5 cursor-pointer"
                    title="Reply to comment"
                  >
                    <Reply className="w-2.5 h-2.5" />
                    <span>রিপ্লাই</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gift Picker Drawer */}
      {giftOpen && b && (
        <div className="shrink-0 z-40 bg-slate-950/95 border-t border-rose-500/30 p-3 rounded-t-2xl shadow-2xl backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-wider text-pink-300">
              {giftTarget ? "Select Gift" : "Choose Host to Support"}
            </p>
            <button
              type="button"
              onClick={() => {
                setGiftOpen(false);
                setGiftTarget(null);
              }}
              className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {!giftTarget ? (
            <div className="grid grid-cols-2 gap-2 my-1">
              <button
                type="button"
                onClick={() => setGiftTarget("from")}
                className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-2 active:scale-95 transition"
              >
                <img src={hostAAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-rose-400" />
                <div className="text-left min-w-0">
                  <div className="text-[8px] font-black text-rose-400 uppercase">TEAM RED</div>
                  <div className="text-[11px] font-bold text-white truncate">{hostAName}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setGiftTarget("to")}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-2 active:scale-95 transition"
              >
                <img src={hostBAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-cyan-400" />
                <div className="text-left min-w-0">
                  <div className="text-[8px] font-black text-cyan-400 uppercase">TEAM BLUE</div>
                  <div className="text-[11px] font-bold text-white truncate">{hostBName}</div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Gifting to: <strong className="text-white">{giftTarget === "from" ? hostAName : hostBName}</strong></span>
                <button type="button" onClick={() => setGiftTarget(null)} className="text-pink-400 underline">Change</button>
              </div>
              <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                {gifts.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      const targetSide = giftTarget || "from";
                      const targetId = targetSide === "from" ? Number(b.from_host_id) : Number(b.to_host_id);
                      const targetHostName = targetSide === "from" ? hostAName : hostBName;

                      triggerSideGift(
                        targetSide,
                        { name: g.name, icon: g.icon, diamonds: g.diamonds, image: g.image },
                        currentUser?.name || "You",
                        currentUser?.avatar || null,
                        targetHostName,
                      );

                      void onSendGift?.(g, targetId);
                      triggerFloatingHeart(g.icon || "🎁");
                      setGiftOpen(false);
                      setGiftTarget(null);
                    }}
                    className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-pink-500/50 active:scale-95 transition"
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <span className="text-[9px] font-bold text-white mt-1 truncate">{g.name}</span>
                    <span className="text-[8px] text-amber-300 font-mono">💎 {g.diamonds}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. BOTTOM ACTION & GIFTING BAR */}
      <div className="shrink-0 z-30 p-3 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col gap-1.5">
        {/* Replying context bar */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-fuchsia-950/90 border border-fuchsia-500/40 rounded-xl px-2.5 py-1 text-[10px] text-fuchsia-200 shadow-lg">
            <span className="truncate flex items-center gap-1">
              <CornerDownRight className="w-3 h-3 text-fuchsia-400 shrink-0" />
              <span>Replying to <strong className="text-white">@{replyingTo.name}</strong></span>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Mention Suggestions Popup */}
        {isMentioningUser && filteredMentionSuggestions.length > 0 && (
          <div className="absolute left-3 right-28 bottom-full mb-1 bg-slate-950/98 border border-fuchsia-500/40 rounded-xl shadow-2xl z-[90] max-h-36 overflow-y-auto p-1 flex flex-col gap-1 backdrop-blur-md">
            <div className="flex items-center justify-between px-2 py-0.5 border-b border-slate-800/80">
              <span className="text-[8px] text-fuchsia-300 font-black uppercase tracking-wider flex items-center gap-1">
                <AtSign className="w-2.5 h-2.5" /> Mention Participants
              </span>
              <span className="text-[7.5px] text-slate-400">
                {filteredMentionSuggestions.length} found
              </span>
            </div>
            {filteredMentionSuggestions.slice(0, 6).map((user) => {
              const cleanName = user.name.replace(/\s+/g, "");
              const userAv = user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.name)}`;
              return (
                <button
                  key={`pk-mention-user-${user.name}`}
                  type="button"
                  onClick={() => {
                    const words = draft.split(" ");
                    words[words.length - 1] = `@${cleanName}`;
                    setDraft(words.join(" ") + " ");
                  }}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg text-left text-xs text-slate-200 hover:bg-fuchsia-900/50 hover:text-white transition cursor-pointer"
                >
                  <img
                    src={userAv}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover border border-fuchsia-400/40 shrink-0"
                  />
                  <span className="truncate font-semibold text-[11px]">{user.name}</span>
                  <span className="ml-auto text-[9px] text-fuchsia-400 font-mono">@{cleanName}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Comment Input */}
          <div className="relative flex-1 flex items-center bg-white/10 backdrop-blur-md rounded-full pl-3.5 pr-1.5 py-1.5 border border-white/10">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendComment();
              }}
              placeholder="মেসেজ পাঠান... (@ দিয়ে মেনশন করুন)"
              maxLength={200}
              className="w-full bg-transparent text-[12px] text-white placeholder:text-white/60 outline-none pr-8"
            />
            <button
              type="button"
              onClick={sendComment}
              disabled={!draft.trim()}
              className="absolute right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white shadow hover:opacity-90 active:scale-90 transition cursor-pointer disabled:opacity-40 shrink-0"
              aria-label="Send comment"
              title="Send"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Rose Button */}
          <button
            onClick={() => triggerFloatingHeart("🌹")}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl active:scale-90 transition shadow-lg shrink-0"
            title="Send Rose"
          >
            🌹
          </button>

          {/* Gift Button */}
          <button
            onClick={() => {
              setGiftOpen((v) => !v);
              setGiftTarget(null);
            }}
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/40 active:scale-90 transition border border-white/30 shrink-0"
            title="Send Gift"
          >
            <Gift className="w-5 h-5 text-white" />
          </button>

          {/* Share Button */}
          <button
            onClick={() => triggerFloatingHeart("💖")}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition shadow-lg shrink-0"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

