// @ts-nocheck
/**
 * ============================================================================
 *  PKWatchView — Spectator UI for a live PK battle.
 *  Read-only view: shows both hosts, live scores, timer, comment strip.
 *  Used by:
 *   - Explore ▸ ⚔️ PK Battle tab (click a card)
 *   - Auto-sync when the video streamer a viewer is watching starts a PK
 * ============================================================================
 */
import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { X, Send, Trophy, Gift } from "lucide-react";
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
  from_avatar?: string | null;
  to_avatar?: string | null;
  from_score: number;
  to_score: number;
  duration_minutes: number;
  status: string;
  ends_at?: string | null;
  remaining_sec?: number | null;
  from_room_id?: number | null;
  to_room_id?: number | null;
};

type PKComment = {
  id: number;
  user_id: number;
  user_name?: string | null;
  user_avatar?: string | null;
  role: "host_from" | "host_to" | "viewer";
  text: string;
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
  /** Fired once when the battle ends naturally (status !== "active").
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
  const [remaining, setRemaining] = useState<number>(0);
  const [comments, setComments] = useState<PKComment[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftTarget, setGiftTarget] = useState<"from" | "to" | null>(null);
  const lastCommentIdRef = useRef<number>(0);
  const endedTimerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Dual Agora refs
  const fromVideoRef = useRef<HTMLDivElement | null>(null);
  const toVideoRef = useRef<HTMLDivElement | null>(null);
  const [fromHasVideo, setFromHasVideo] = useState(false);
  const [toHasVideo, setToHasVideo] = useState(false);

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
        /* ignore; Agora subscribe retry below handles the other side */
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
      // If the viewer entered PK from this same live room, App.tsx already has
      // an Agora client + remote track for it. Reusing it avoids a duplicate
      // same-UID join in the same Agora channel, which can prevent rendering.
      if (existingKey && String(roomId) === existingKey) return;
      try {
        const AgoraRTC = await AgoraRTCPromise;
        if (!AgoraRTC || cancelled) return;
        const channelName = `live_${roomId}`;
        // Reuse the same Laravel API helper path as App.tsx so the saved
        // Sanctum token is attached. The backend expects subscriber/publisher;
        // Agora client role below is still audience.
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

        // If the host was already publishing before this PK view mounted,
        // user-published may not fire again. Subscribe to existing remotes too.
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
      lastCommentIdRef.current = 0;
      if (endedTimerRef.current) {
        window.clearTimeout(endedTimerRef.current);
        endedTimerRef.current = null;
      }
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
        if (d.status && d.status !== "active") {
          // battle ended — let parent decide (next PK / livestream / explore)
          const endedId = battleId;
          if (endedTimerRef.current) return;
          endedTimerRef.current = window.setTimeout(() => {
            if (cancelled) return;
            if (onEnded && endedId != null) onEnded(endedId);
            else onClose();
          }, 3500);
        }
      } catch {
        /* ignore */
      }
    };

    // Prime with active list to hydrate names/avatars if score endpoint lacks them
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
  }, [open, battleId, apiBase, authToken, onClose, onEnded]);

  /* ---------- countdown ---------- */
  useEffect(() => {
    if (!open || remaining <= 0) return;
    const iv = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(iv);
  }, [open, remaining]);

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
            return merged.slice(-60);
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
      },
    ]);
    setDraft("");
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
  const totalScore = Math.max(1, (b?.from_score || 0) + (b?.to_score || 0));
  const leftPct = ((b?.from_score || 0) / totalScore) * 100;
  const leader =
    !b || b.from_score === b.to_score
      ? null
      : b.from_score > b.to_score
      ? "from"
      : "to";

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-[#1a0a1f] via-slate-950 to-black backdrop-blur-md flex flex-col text-slate-100 font-sans">
      {/* Header — pink gradient like host PK view */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-600/90 via-pink-600/80 to-purple-700/80 border-b border-rose-400/30 shadow-lg shadow-rose-500/20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
          <span className="text-[12px] font-black uppercase tracking-widest text-white drop-shadow">
            ⚔️ Live PK Battle
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold bg-black/40 text-amber-200 px-2.5 py-1 rounded-full border border-amber-300/40">
            ⏱ {fmtTime(remaining)}
          </span>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center border border-white/20"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Arena — edge-to-edge dual video, no gap, no borders */}
      <div className="relative grid grid-cols-2 gap-0 bg-black h-[360px]">
        {/* Left (from) — TEAM RED */}
        <div className="relative overflow-hidden bg-black">
          <div ref={fromVideoRef} className="absolute inset-0 bg-black [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover" />
          {!fromHasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-900/70 to-black">
              <img
                src={b?.from_avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${b?.from_host_id || "a"}`}
                alt={b?.from_name || "Host A"}
                className="w-24 h-24 rounded-full border-[3px] border-rose-300 object-cover shadow-xl"
              />
            </div>
          )}
          <span className="absolute top-8 left-2 z-10 text-[9px] bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black px-2 py-0.5 rounded-full shadow">
            TEAM RED
          </span>
          {leader === "from" && (
            <Trophy className="absolute top-8 right-2 z-10 w-5 h-5 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.9)]" />
          )}
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 py-2 text-center">
            <div className="text-[12px] font-black text-white truncate">
              {b?.from_name || `Host #${b?.from_host_id || "?"}`}
            </div>
          </div>

        </div>

        {/* Right (to) — TEAM BLUE */}
        <div className="relative overflow-hidden bg-black">
          <div ref={toVideoRef} className="absolute inset-0 bg-black [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover" />
          {!toHasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900/70 to-black">
              <img
                src={b?.to_avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${b?.to_host_id || "b"}`}
                alt={b?.to_name || "Host B"}
                className="w-24 h-24 rounded-full border-[3px] border-cyan-300 object-cover shadow-xl"
              />
            </div>
          )}
          <span className="absolute top-8 right-2 z-10 text-[9px] bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-black px-2 py-0.5 rounded-full shadow">
            TEAM BLUE
          </span>
          {leader === "to" && (
            <Trophy className="absolute top-8 left-2 z-10 w-5 h-5 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.9)]" />
          )}
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2 py-2 text-center">
            <div className="text-[12px] font-black text-white truncate">
              {b?.to_name || `Host #${b?.to_host_id || "?"}`}
            </div>
          </div>
        </div>

        {/* Score progress bar — overlaid on TOP of the videos, shows viewer gift totals INSIDE */}
        <div className="pointer-events-none absolute top-2 left-2 right-2 z-30">
          <div className="relative h-6 w-full flex rounded-full overflow-hidden border border-white/30 shadow-lg bg-black/50">
            <div
              className="bg-gradient-to-r from-rose-600 via-rose-500 to-pink-500 h-full transition-all duration-700 flex items-center justify-start pl-2 min-w-[36px]"
              style={{ width: `${leftPct}%` }}
            >
              <span className="text-[11px] font-black text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                🎁 {(b?.from_score || 0).toLocaleString()}
              </span>
            </div>
            <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 h-full flex-1 transition-all duration-700 flex items-center justify-end pr-2 min-w-[36px]">
              <span className="text-[11px] font-black text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {(b?.to_score || 0).toLocaleString()} 🎁
              </span>
            </div>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-7 bg-white/80 rounded-full shadow" />
          </div>
        </div>


        {/* VS badge */}
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 font-black text-sm py-1.5 px-3 rounded-full border-[3px] border-slate-950 italic shadow-2xl shadow-amber-500/50 animate-pulse">
          VS
        </span>
      </div>

      {/* Live chat header */}
      <div className="shrink-0 px-4 py-2 bg-gradient-to-r from-purple-900/60 to-rose-900/40 border-y border-purple-500/30 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
        <span className="text-[10px] font-black uppercase tracking-widest text-purple-200">💬 Live Chat</span>
      </div>

      {/* Comment strip */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 bg-gradient-to-b from-slate-950 to-black">

        {comments.length === 0 && (
          <div className="text-center text-[10px] text-slate-500 py-6">
            Be the first to cheer! 🎉
          </div>
        )}
        {comments.map((c) => {
          const color =
            c.role === "host_from"
              ? "text-rose-300"
              : c.role === "host_to"
              ? "text-cyan-300"
              : "text-slate-200";
          const badge =
            c.role === "host_from"
              ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
              : c.role === "host_to"
              ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
              : "";
          return (
            <div key={c.id} className="flex items-start gap-2 text-[11px]">
              <span className={`font-bold ${color}`}>{c.user_name || `#${c.user_id}`}</span>
              {(c.role === "host_from" || c.role === "host_to") && (
                <span className={`text-[8px] px-1 py-[1px] rounded border ${badge}`}>HOST</span>
              )}
              <span className="text-slate-200 flex-1 break-words">{c.text}</span>
            </div>
          );
        })}
      </div>

      {/* Gift panel (opens above composer) */}
      {giftOpen && b && (
        <div className="shrink-0 border-t border-amber-300/25 bg-slate-950/95 p-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-200">
              {giftTarget ? "Choose Gift" : "Send Gift to…"}
            </p>
            <button
              type="button"
              onClick={() => {
                setGiftOpen(false);
                setGiftTarget(null);
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-slate-200"
              aria-label="Close gifts"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Step 1: pick target host */}
          {!giftTarget && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGiftTarget("from")}
                className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 p-2 active:scale-95"
              >
                <img
                  src={b.from_avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${b.from_host_id}`}
                  alt=""
                  className="w-9 h-9 rounded-full border border-rose-400/60 object-cover"
                />
                <div className="text-left min-w-0">
                  <div className="text-[8px] font-black text-rose-300">TEAM RED</div>
                  <div className="text-[10px] font-bold text-white truncate">
                    {b.from_name || `Host #${b.from_host_id}`}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setGiftTarget("to")}
                className="flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-2 active:scale-95"
              >
                <img
                  src={b.to_avatar || `https://api.dicebear.com/9.x/thumbs/svg?seed=${b.to_host_id}`}
                  alt=""
                  className="w-9 h-9 rounded-full border border-cyan-400/60 object-cover"
                />
                <div className="text-left min-w-0">
                  <div className="text-[8px] font-black text-cyan-300">TEAM BLUE</div>
                  <div className="text-[10px] font-bold text-white truncate">
                    {b.to_name || `Host #${b.to_host_id}`}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Step 2: pick gift */}
          {giftTarget && (
            <>
              <div className="mb-2 flex items-center justify-between text-[10px] text-slate-400">
                <span>
                  → <span className={giftTarget === "from" ? "text-rose-300 font-bold" : "text-cyan-300 font-bold"}>
                    {giftTarget === "from"
                      ? b.from_name || `Host #${b.from_host_id}`
                      : b.to_name || `Host #${b.to_host_id}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setGiftTarget(null)}
                  className="text-[9px] text-slate-400 underline"
                >
                  change
                </button>
              </div>
              {gifts.length === 0 ? (
                <div className="py-4 text-center text-[10px] text-slate-500">
                  No gifts available.
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto">
                  {gifts.map((g) => (
                    <button
                      key={`pk-gift-${g.id}`}
                      type="button"
                      onClick={() => {
                        const targetId =
                          giftTarget === "from" ? Number(b.from_host_id) : Number(b.to_host_id);
                        void onSendGift?.(g, targetId);
                        setGiftOpen(false);
                        setGiftTarget(null);
                      }}
                      className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-1 py-2 text-center active:scale-95"
                    >
                      <span className="block text-lg leading-none">{g.icon}</span>
                      <span className="mt-1 block truncate text-[7px] font-black text-amber-100">
                        {g.name}
                      </span>
                      <span className="block text-[7px] font-bold text-slate-400">
                        {g.diamonds}🪙
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 flex items-center gap-2 p-2 bg-slate-900 border-t border-slate-800">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendComment();
          }}
          placeholder="Say something…"
          maxLength={300}
          className="flex-1 bg-slate-800 rounded-full px-4 py-2 text-[12px] text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-rose-500"
        />
        {onSendGift && (
          <button
            onClick={() => {
              setGiftOpen((v) => !v);
              setGiftTarget(null);
            }}
            className={`w-10 h-10 rounded-full flex items-center justify-center border ${
              giftOpen
                ? "bg-amber-400 border-amber-300 text-slate-950"
                : "bg-slate-800 border-amber-400/40 text-amber-300"
            }`}
            aria-label="Send gift"
            title="Send gift"
          >
            <Gift className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={sendComment}
          disabled={sending || !draft.trim()}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 disabled:opacity-40 flex items-center justify-center"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>,
    document.body,
  );
}
