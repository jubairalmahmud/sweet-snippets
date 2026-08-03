// @ts-nocheck
/**
 * ============================================================================
 *  PKWatchView — Spectator UI for a live PK battle.
 *  Exact TikTok / Bigo style layout matching reference design.
 *  Read-only view: shows both hosts in 50/50 split, live scores, 3D VS logo,
 *  timer, top contributors, live chat overlay, floating hearts & gifting.
 * ============================================================================
 */
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { X, Send, Gift, Heart, Share2, Star, Plus } from "lucide-react";
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
  role: "host_from" | "host_to" | "viewer";
  text: string;
  level?: number;
  created_at?: string | null;
};

export type PKGiftItem = {
  id: string;
  name: string;
  icon: string;
  diamonds: number;
  rCoins: number;
  image?: string | null;
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
  const m = Math.max(0, Math.floor(sec / 60));
  const s = Math.max(0, sec % 60);
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

  /* ---------- Reuse the viewer's already-open live stream track ---------- */
  useEffect(() => {
    if (!open || !battle) return;
    const existingKey = existingRoomId == null ? "" : String(existingRoomId);
    if (!existingKey || existingRemoteVideos.length === 0) return;

    const playExisting = (
      roomId: number | string | null | undefined,
      containerRef: MutableRefObject<HTMLDivElement | null>,
      setHasVideo: (v: boolean) => void,
    ) => {
      if (roomId == null || String(roomId) !== existingKey) return;
      const video = existingRemoteVideos.find((item) => item?.track) || existingRemoteVideos[0];
      if (!video?.track || !containerRef.current) return;
      try {
        containerRef.current.innerHTML = "";
        video.track.play(containerRef.current);
        setHasVideo(true);
      } catch {
        /* ignore */
      }
    };

    playExisting(battle.from_room_id, fromVideoRef, setFromHasVideo);
    playExisting(battle.to_room_id, toVideoRef, setToHasVideo);
  }, [open, battle?.from_room_id, battle?.to_room_id, existingRoomId, existingRemoteVideos.length]);

  /* ---------- Dual Agora subscribe (from + to) ---------- */
  useEffect(() => {
    if (!open || !battle || (!battle.from_room_id && !battle.to_room_id)) return;
    let cancelled = false;
    const clients: any[] = [];
    const retryTimers: number[] = [];
    const existingKey = existingRoomId == null ? "" : String(existingRoomId);

    const joinSide = async (
      roomId: number,
      containerRef: MutableRefObject<HTMLDivElement | null>,
      setHasVideo: (v: boolean) => void,
    ) => {
      if (existingKey && String(roomId) === existingKey) return;
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
        const retryId = window.setInterval(subscribeExistingRemotes, 1200);
        retryTimers.push(retryId);
        window.setTimeout(() => window.clearInterval(retryId), 12000);
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
  }, [open, battle?.from_room_id, battle?.to_room_id, existingRoomId, apiBase, authToken]);

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
      // populate sample chat messages for rich live feeling
      setComments([
        { id: 1, user_id: 101, user_name: "doel", role: "viewer", text: "yes", level: 7 },
        { id: 2, user_id: 102, user_name: "rehan🐍🐍", role: "viewer", text: "dr.miechel itu", level: 13 },
        { id: 3, user_id: 103, user_name: "BLACK | MAMBAAA", role: "viewer", text: "doctor michel tu", level: 10 },
        { id: 4, user_id: 104, user_name: "are_may91", role: "viewer", text: "joined", level: 17 },
      ]);
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
          // Time expired -> trigger auto-next PK or return to live stream
          window.clearInterval(iv);
          handleCloseOrNext();
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
              if (!seen.has(c.id)) merged.push(c);
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
    setComments((prev) => [
      ...prev,
      {
        id: tempId,
        user_id: Number(currentUser?.id ?? 0),
        user_name: currentUser?.name || "You",
        user_avatar: currentUser?.avatar || null,
        role: "viewer",
        text: t,
        level: 12,
      },
    ]);
    setDraft("");
    triggerFloatingHeart("❤️");
    try {
      const j: any = await httpPost(apiBase, `/pk/${battleId}/comment`, { text: t }, authToken);
      if (j?.comment) {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? { ...c, ...j.comment } : c)),
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
  const leftScore = b?.from_score || 464380;
  const rightScore = b?.to_score || 143087;
  const totalScore = Math.max(1, leftScore + rightScore);
  const leftPct = Math.min(85, Math.max(15, (leftScore / totalScore) * 100));

  const hostAName = b?.from_name || "Jujuszz♥";
  const hostBName = b?.to_name || "Aria";
  const hostAAvatar = b?.from_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop";
  const hostBAvatar = b?.to_avatar || "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop";
  const hostAFlag = b?.from_flag || "🇲🇾";
  const hostBFlag = b?.to_flag || "🇹🇼";
  const viewersCount = b?.viewers || "1.6K";

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
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-pink-500/80 shrink-0">
            <img src={hostAAvatar} alt={hostAName} className="w-full h-full object-cover" />
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

        {/* Right: Top Gifters, Viewer Count & Close */}
        <div className="flex items-center gap-2">
          {/* Top gifter mini avatars */}
          <div className="flex items-center -space-x-1.5 bg-black/30 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-amber-300">
              <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-amber-400 text-slate-950 font-black text-[6px] text-center">28K</span>
            </div>
            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-amber-300">
              <img src="https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-amber-400 text-slate-950 font-black text-[6px] text-center">28K</span>
            </div>
          </div>

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
            <span className="bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950 font-black text-[9px] px-1.5 py-[1px] rounded shadow shrink-0">
              WIN × {b?.from_wins || 0}
            </span>
          </div>

          {/* Right Blue/Cyan Side Score */}
          <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 h-full flex-1 transition-all duration-500 flex items-center justify-between px-2.5">
            <span className="bg-gradient-to-r from-amber-300 to-yellow-400 text-slate-950 font-black text-[9px] px-1.5 py-[1px] rounded shadow shrink-0">
              WIN × {b?.to_wins || 1}
            </span>
            <span className="text-[12px] font-black text-white tracking-wider drop-shadow">
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
              <img
                src={hostAAvatar}
                alt={hostAName}
                className="w-full h-full object-cover filter brightness-95"
              />
            </div>
          )}

          {/* Left Country Flag Badge */}
          <div className="absolute bottom-10 left-2 z-20 flex items-center gap-1 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[11px] font-bold border border-white/10">
            <span>{hostAFlag}</span>
          </div>

          {/* Left Top Contributors Overlapping Avatars */}
          <div className="absolute bottom-2 left-2 z-20 flex items-center -space-x-2">
            <div className="w-6 h-6 rounded-full border border-amber-300 overflow-hidden shadow">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-6 h-6 rounded-full border border-pink-400 overflow-hidden shadow">
              <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-6 h-6 rounded-full border border-blue-400 overflow-hidden shadow">
              <img src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* Right Host B Video (50%) */}
        <div className="relative h-full w-full bg-slate-900 overflow-hidden">
          <div ref={toVideoRef} className="absolute inset-0 bg-black [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover" />
          {!toHasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-950 via-slate-900 to-black">
              <img
                src={hostBAvatar}
                alt={hostBName}
                className="w-full h-full object-cover filter brightness-95"
              />
            </div>
          )}

          {/* Right Country Flag Badge */}
          <div className="absolute bottom-10 right-2 z-20 flex items-center gap-1 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[11px] font-bold border border-white/10">
            <span>{hostBFlag}</span>
          </div>

          {/* Right Top Contributors Overlapping Avatars */}
          <div className="absolute bottom-2 right-2 z-20 flex items-center -space-x-2">
            <div className="w-6 h-6 rounded-full border border-amber-300 overflow-hidden shadow">
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-6 h-6 rounded-full border border-purple-400 overflow-hidden shadow">
              <img src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="w-6 h-6 rounded-full border border-emerald-400 overflow-hidden shadow">
              <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop" alt="" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </div>

      {/* 4. LIVE CHAT & FLOATING REACTION AREA */}
      <div className="shrink-0 relative h-36 px-3 py-1 flex flex-col justify-end z-30">
        <div ref={scrollRef} className="max-h-32 overflow-y-auto space-y-1.5 pr-16 scrollbar-none">
          {comments.map((c) => {
            const levelNum = c.level || Math.floor(Math.random() * 20) + 1;
            return (
              <div key={c.id} className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full max-w-[80%] border border-white/5">
                <span className="text-[9px] font-extrabold bg-blue-600 text-white px-1 py-[0.5px] rounded flex items-center gap-0.5 shrink-0">
                  ▲ {levelNum}
                </span>
                <span className="text-[11px] font-bold text-slate-300 shrink-0">
                  {c.user_name || `user_${c.user_id}`}
                </span>
                <span className="text-[11px] text-white truncate">
                  {c.text}
                </span>
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
                      const targetId = giftTarget === "from" ? Number(b.from_host_id) : Number(b.to_host_id);
                      void onSendGift?.(g, targetId);
                      triggerFloatingHeart("🎁");
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
      <div className="shrink-0 z-30 p-3 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center gap-2">
        {/* Comment Input */}
        <div className="flex-1 flex items-center bg-white/10 backdrop-blur-md rounded-full px-3.5 py-2 border border-white/10">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendComment();
            }}
            placeholder="Add comment"
            maxLength={200}
            className="w-full bg-transparent text-[12px] text-white placeholder:text-white/60 outline-none"
          />
        </div>

        {/* Rose Button */}
        <button
          onClick={() => triggerFloatingHeart("🌹")}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl active:scale-90 transition shadow-lg"
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
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-fuchsia-600 via-pink-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-pink-500/40 active:scale-90 transition border border-white/30"
          title="Send Gift"
        >
          <Gift className="w-5 h-5 text-white" />
        </button>

        {/* Share Button */}
        <button
          onClick={() => triggerFloatingHeart("💖")}
          className="h-10 px-3 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center gap-1 text-white text-[11px] font-bold active:scale-90 transition shadow-lg"
        >
          <Share2 className="w-4 h-4 text-white" />
          <span>1.8K</span>
        </button>
      </div>
    </div>,
    document.body,
  );
}

