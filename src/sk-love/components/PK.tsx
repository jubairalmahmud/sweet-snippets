// @ts-nocheck
/* ============================================================================
 *  PK.tsx — 1v1 Host PK Battle (self-contained overlay)
 * ----------------------------------------------------------------------------
 *  Usage (from App.tsx):
 *     <PK
 *       open={isPKOpen}
 *       onClose={() => setIsPKOpen(false)}
 *       currentUser={{ id, name, avatar }}
 *       roomId={activePartyRoom?.id}
 *       apiBase={API_BASE}
 *       authToken={sanctumToken}
 *     />
 *
 *  Backend endpoints (to be built later — controller stub already planned):
 *     GET   /pk/online-hosts                 → invite picker list
 *     POST  /pk/invite    { toHostId, dur }  → send invite
 *     GET   /pk/mine                         → poll own invite/battle status
 *     POST  /pk/accept    { battleId }
 *     POST  /pk/reject    { battleId }
 *     POST  /pk/end       { battleId }
 *     GET   /pk/{battleId}/score             → live score poll
 *
 *  This file only owns the UI + local flow. All network calls are wrapped in
 *  try/catch so the UI still works standalone (mock/demo mode) if backend
 *  is not ready.
 * ==========================================================================*/

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { createPortal } from "react-dom";
import { Swords, X, Clock, Crown, Send, Search, Loader2, MessageCircle, Trophy } from "lucide-react";
import { api } from "../lib/api";

type PKUser = { id: string | number; name: string; avatar?: string };
type PKPhase = "picker" | "waiting" | "battle" | "result";
type PKDuration = 3 | 5 | 10;

type OnlineHost = PKUser & { roomTitle?: string; viewers?: number };

/** Resolve avatar URL: prefix relative Laravel storage paths with API host. */
const API_ORIGIN = (() => {
  const raw =
    (import.meta as any).env?.VITE_API_BASE_URL ||
    (import.meta as any).env?.VITE_API_URL ||
    (import.meta as any).env?.VITE_BACKEND_URL ||
    (import.meta as any).env?.VITE_LARAVEL_URL ||
    "https://api.sklove.nit.bd";
  try {
    return new URL(String(raw)).origin;
  } catch {
    return String(raw).replace(/\/+$/, "");
  }
})();

function resolveAvatar(av?: string | null, seed?: string | number): string {
  const s = (av || "").trim();
  if (!s) return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed ?? "x"}`;
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;
  const path = s.startsWith("/") ? s : `/storage/${s}`;
  return `${API_ORIGIN}${path}`;
}

interface PKProps {
  open: boolean;
  onClose: () => void;
  currentUser: PKUser | null;
  roomId?: string | number | null;
  apiBase?: string;
  authToken?: string | null;
  /** Live camera track being published by App.tsx — used to render "my" side of PK. */
  localVideoTrackRef?: MutableRefObject<any> | null;
  /** If provided (invitee accepted an incoming invite), skip picker/waiting and jump into battle. */
  incomingBattle?: {
    id: string | number;
    opponent: PKUser;
    durationMinutes: number;
    endsAt?: string | null;
    fromRoomId?: string | number | null;
    toRoomId?: string | number | null;
  } | null;
}


/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const fmtTime = (sec: number) => {
  const m = Math.max(0, Math.floor(sec / 60));
  const s = Math.max(0, sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const cx = (...s: (string | false | null | undefined)[]) =>
  s.filter(Boolean).join(" ");

const buildPkEndpoint = (apiBase: string | undefined, path: string) => {
  const cleanPath = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  if (!apiBase) return cleanPath;
  const base = apiBase.replace(/\/+$/, "");
  return base.endsWith("/api") ? `${base}${cleanPath.slice(4)}` : `${base}${cleanPath}`;
};

const pkGet = async <T,>(apiBase: string | undefined, path: string, authToken?: string | null): Promise<T> => {
  if (!apiBase) {
    const endpoint = path.startsWith("/api/") ? path : `/api${path}`;
    return api.get<T>(
      endpoint,
      authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
    );
  }
  const res = await fetch(buildPkEndpoint(apiBase, path), {
    headers: {
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || `Request failed with status ${res.status}`);
  }
  return payload as T;
};

const pkPost = async <T,>(
  apiBase: string | undefined,
  path: string,
  body: unknown,
  authToken?: string | null,
): Promise<T> => {
  if (!apiBase) {
    const endpoint = path.startsWith("/api/") ? path : `/api${path}`;
    return api.post<T>(
      endpoint,
      body,
      authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined,
    );
  }
  const res = await fetch(buildPkEndpoint(apiBase, path), {
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
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || `Request failed with status ${res.status}`);
  }
  return payload as T;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PK({
  open,
  onClose,
  currentUser,
  roomId,
  apiBase = "",
  authToken,
  localVideoTrackRef = null,
  incomingBattle = null,
}: PKProps) {

  const [phase, setPhase] = useState<PKPhase>("picker");
  const [duration, setDuration] = useState<PKDuration>(5);
  const [query, setQuery] = useState("");
  const [hosts, setHosts] = useState<OnlineHost[]>([]);
  const [loadingHosts, setLoadingHosts] = useState(false);
  const [invitedTo, setInvitedTo] = useState<OnlineHost | null>(null);
  const [opponent, setOpponent] = useState<OnlineHost | null>(null);
  const [battleId, setBattleId] = useState<string | number | null>(null);
  const [iAmFromHost, setIAmFromHost] = useState<boolean>(true);
  const [remaining, setRemaining] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [oppRoomId, setOppRoomId] = useState<string | number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const endingRef = useRef(false);

  /* ---------- reset when closed ---------- */
  useEffect(() => {
    if (!open) {
      setPhase("picker");
      setInvitedTo(null);
      setOpponent(null);
      setBattleId(null);
      setRemaining(0);
      setMyScore(0);
      setOppScore(0);
      setOppRoomId(null);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
  }, [open]);

  /* ---------- jump straight into battle when invitee accepted an invite ---------- */
  useEffect(() => {
    if (!open || !incomingBattle) return;
    const opp: OnlineHost = {
      id: incomingBattle.opponent.id,
      name: incomingBattle.opponent.name,
      avatar: incomingBattle.opponent.avatar,
    };
    setOpponent(opp);
    setBattleId(incomingBattle.id);
    setIAmFromHost(false); // invitee = to_host
    // invitee = to_host → opponent's room is fromRoomId
    setOppRoomId(incomingBattle.fromRoomId ?? null);
    const fallbackSecs = Math.max(60, (incomingBattle.durationMinutes || 5) * 60);
    let secs = fallbackSecs;
    if (incomingBattle.endsAt) {
      const raw = String(incomingBattle.endsAt).trim();
      const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(raw)
        ? raw
        : raw.replace(" ", "T") + "Z";
      const t = new Date(iso).getTime();
      const diff = Number.isFinite(t) ? Math.floor((t - Date.now()) / 1000) : 0;
      secs = diff > 10 ? diff : fallbackSecs;
    }
    setRemaining(secs);
    setDuration((incomingBattle.durationMinutes || 5) as PKDuration);
    setMyScore(0);
    setOppScore(0);
    setPhase("battle");
  }, [open, incomingBattle]);



  /* ---------- fetch online hosts on open ---------- */
  useEffect(() => {
    if (!open || phase !== "picker") return;
    let cancelled = false;
    (async () => {
      setLoadingHosts(true);
      try {
        const j: any = await pkGet(apiBase, "/pk/online-hosts", authToken);
        if (cancelled) return;
        const arr: OnlineHost[] = Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j?.hosts)
          ? j.hosts
          : Array.isArray(j)
          ? j
          : [];
        setHosts(arr);
      } catch {
        // demo fallback so UI is testable without backend
        if (!cancelled) setHosts([]);
      } finally {
        if (!cancelled) setLoadingHosts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, phase, apiBase, authToken]);

  /* ---------- countdown timer during battle ---------- */
  useEffect(() => {
    if (phase !== "battle") return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(timerRef.current!);
          setTimeout(() => setPhase("result"), 0);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [phase]);

  /* ---------- battle phase: poll score + status + enrich opponent avatar ---------- */
  useEffect(() => {
    if (!open || phase !== "battle" || !battleId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        // score endpoint: authoritative for scores + ends_at + status
        const s: any = await pkGet(apiBase, `/pk/${battleId}/score`, authToken);
        const bs: any = s?.data ?? s?.battle ?? s ?? null;
        if (!cancelled && bs) {
          const fs = Number(bs.from_score ?? 0);
          const ts = Number(bs.to_score ?? 0);
          if (iAmFromHost) { setMyScore(fs); setOppScore(ts); }
          else             { setMyScore(ts); setOppScore(fs); }
          // sync remaining from server if provided (clock-skew aware)
          if (bs.ends_at) {
            const raw = String(bs.ends_at).trim();
            const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : raw.replace(" ", "T") + "Z";
            const endsMs = new Date(iso).getTime();
            let nowMs = Date.now();
            if (bs.server_now) {
              const nraw = String(bs.server_now).trim();
              const niso = /[zZ]|[+-]\d\d:?\d\d$/.test(nraw) ? nraw : nraw.replace(" ", "T") + "Z";
              const srv = new Date(niso).getTime();
              if (Number.isFinite(srv)) nowMs = srv;
            }
            const diff = Number.isFinite(endsMs) ? Math.floor((endsMs - nowMs) / 1000) : 0;
            if (diff >= 0) setRemaining(diff);
          }
          if (bs.duration_minutes) {
            setDuration(Number(bs.duration_minutes) as PKDuration);
          }
          if (bs.status === "ended" || bs.status === "cancelled" || bs.status === "expired") {
            toast("🏁 Battle ended");
            setPhase("result");
            return;
          }
        }
        // enrich opponent name/avatar + room once from /pk/mine
        if (!cancelled && (!opponent?.avatar || !opponent?.name || opponent.name === "Opponent" || oppRoomId == null)) {
          const m: any = await pkGet(apiBase, "/pk/mine", authToken);
          const mb: any = m?.data ?? m?.battle ?? null;
          if (mb && String(mb.id) === String(battleId)) {
            const oppId  = iAmFromHost ? mb.to_host_id   : mb.from_host_id;
            const oppNm  = iAmFromHost ? mb.to_name      : mb.from_name;
            const oppAv  = iAmFromHost ? mb.to_avatar    : mb.from_avatar;
            const oppRm  = iAmFromHost ? mb.to_room_id   : mb.from_room_id;
            setOpponent((prev) => ({
              id: oppId ?? prev?.id ?? 0,
              name: oppNm || prev?.name || "Opponent",
              avatar: oppAv || prev?.avatar,
            }));
            if (oppRm != null) setOppRoomId((prev) => prev ?? oppRm);
          }
        }
      } catch { /* silent */ }
    };
    tick();
    const id = window.setInterval(tick, 2500);
    return () => { cancelled = true; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, battleId, iAmFromHost, apiBase, authToken]);

  /* ---------- expose active battle globally so gift-send in the video
       stream can credit PK score via /pk/{id}/gift ---------- */
  useEffect(() => {
    const w = window as any;
    if (phase !== "battle" || !battleId || !currentUser?.id) {
      if (w.__activePKBattle) delete w.__activePKBattle;
      return;
    }
    const myId  = Number(currentUser.id);
    const oppId = Number(opponent?.id || 0);
    w.__activePKBattle = {
      id: battleId,
      fromHostId: iAmFromHost ? myId  : oppId,
      toHostId:   iAmFromHost ? oppId : myId,
      apiBase,
      authToken,
    };
    return () => {
      if ((window as any).__activePKBattle?.id === battleId) {
        delete (window as any).__activePKBattle;
      }
    };
  }, [phase, battleId, iAmFromHost, currentUser?.id, opponent?.id, apiBase, authToken]);


  /* ---------- toast helper ---------- */
  const toast = (m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg(null), 2600);
  };

  /* ---------- filtered host list ---------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter(
      (h) =>
        String(h.name || "").toLowerCase().includes(q) ||
        String(h.id).toLowerCase().includes(q),
    );
  }, [hosts, query]);

  /* ---------- send invite ---------- */
  const sendInvite = async (host: OnlineHost) => {
    setInvitedTo(host);
    setPhase("waiting");
    try {
      const j: any = await pkPost(apiBase, "/pk/invite", {
        to_host_id: host.id,
        duration_minutes: duration,
        room_id: roomId ?? null,
      });
      if (j?.battle_id || j?.id) setBattleId(j.battle_id ?? j.id);
      if (j?.message && !j?.battle_id && !j?.ok) {
        // backend rejected — surface real reason and go back to picker
        toast(`⚠️ ${j.message}`);
        setPhase("picker");
        setInvitedTo(null);
        return;
      }
      toast(`⚔️ Invite sent to ${host.name}`);
    } catch (e: any) {
      toast(`⚠️ ${e?.message || "Failed to send invite"}`);
      setPhase("picker");
      setInvitedTo(null);
    }
  };

  /* ---------- inviter: poll /pk/mine while waiting → auto-jump to battle when invitee accepts ---------- */
  useEffect(() => {
    if (!open || phase !== "waiting") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const j: any = await pkGet(apiBase, "/pk/mine", authToken);
        const b: any = j?.data ?? j?.battle ?? null;
        if (cancelled || !b) return;
        // only care about the invite we just sent
        if (battleId && String(b.id) !== String(battleId)) return;
        if (b.status === "active" || b.status === "accepted" || b.status === "started") {
          const opp: OnlineHost = {
            id: b.to_host_id ?? invitedTo?.id ?? 0,
            name: b.to_name || invitedTo?.name || "Opponent",
            avatar: b.to_avatar || invitedTo?.avatar,
          };
          setOpponent(opp);
          setBattleId(b.id);
          setIAmFromHost(true); // waiting-side = inviter = from_host
          const fallback = Math.max(60, (b.duration_minutes || duration) * 60);
          let secs = fallback;
          if (b.ends_at) {
            const raw = String(b.ends_at).trim();
            const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw : raw.replace(" ", "T") + "Z";
            const t = new Date(iso).getTime();
            const diff = Number.isFinite(t) ? Math.floor((t - Date.now()) / 1000) : 0;
            secs = diff > 10 ? diff : fallback;
          }
          setRemaining(secs);
          if (b.duration_minutes) setDuration(Number(b.duration_minutes) as PKDuration);
          setMyScore(0);
          setOppScore(0);
          setPhase("battle");
          toast(`🥊 ${opp.name} accepted — battle started!`);
        } else if (b.status === "rejected" || b.status === "cancelled" || b.status === "expired") {
          toast(`❌ Invite ${b.status}`);
          setPhase("picker");
          setInvitedTo(null);
          setBattleId(null);
        }
      } catch { /* silent */ }
    };
    tick();
    const id = window.setInterval(tick, 2500);
    return () => { cancelled = true; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, phase, battleId, apiBase, authToken]);



  /* ---------- cancel waiting ---------- */
  const cancelInvite = () => {
    setInvitedTo(null);
    setBattleId(null);
    setPhase("picker");
  };


  /* ---------- end battle early (host only in real impl) ---------- */
  const endBattle = async (localOnly = false) => {
    if (endingRef.current) return true;
    if (battleId && !localOnly) {
      endingRef.current = true;
      try {
        await pkPost(apiBase, "/pk/end", { battle_id: battleId }, authToken);
      } catch (e: any) {
        const msg = String(e?.message || "").toLowerCase();
        if (!msg.includes("already") && !msg.includes("finished")) {
          endingRef.current = false;
          toast(`⚠️ ${e?.message || "PK close failed"}`);
          return false;
        }
      }
      endingRef.current = false;
    }
    setPhase("result");
    return true;
  };

  if (!open) return null;

  const winner: "me" | "opp" | "tie" =
    myScore === oppScore ? "tie" : myScore > oppScore ? "me" : "opp";

  /* ================================================================ */
  /*  RENDER                                                            */
  /* ================================================================ */

  const overlay = (
    <div className="fixed inset-0 z-[2147483600] flex flex-col bg-[#0b0616]/95 backdrop-blur-xl">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-900/40 via-rose-900/30 to-fuchsia-900/40">
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-rose-400" />
          <span className="text-sm font-black uppercase tracking-wider text-rose-300">
            PK Battle
          </span>
          {phase === "battle" && (
            <span className="ml-2 rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-400/30">
              <Clock className="inline h-3 w-3 mr-1 -mt-0.5" />
              {fmtTime(remaining)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={async () => {
            // If host is inside an active battle, end it on the server so
            // viewers don't get stuck watching an already-closed PK.
            if (phase === "battle" && battleId) {
              const ok = await endBattle();
              if (!ok) return;
            }
            onClose();
          }}
          className="rounded-full p-1.5 text-slate-300 hover:text-white hover:bg-white/10"
          aria-label="Close PK"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto p-4">
        {phase === "picker" && (
          <PickerView
            duration={duration}
            setDuration={setDuration}
            query={query}
            setQuery={setQuery}
            hosts={filtered}
            loading={loadingHosts}
            onInvite={sendInvite}
            me={currentUser}
          />
        )}

        {phase === "waiting" && invitedTo && (
          <WaitingView
            host={invitedTo}
            duration={duration}
            onCancel={cancelInvite}
          />
        )}

        {phase === "battle" && (
          <BattleView
            me={currentUser}
            opp={opponent}
            myScore={myScore}
            oppScore={oppScore}
            remaining={remaining}
            totalSec={duration * 60}
            onEnd={() => { void endBattle(); }}
            battleId={battleId}
            apiBase={apiBase}
            authToken={authToken}
            iAmFromHost={iAmFromHost}
            oppRoomId={oppRoomId}
            localVideoTrackRef={localVideoTrackRef}
          />
        )}


        {phase === "result" && (
          <ResultView
            me={currentUser}
            opp={opponent}
            myScore={myScore}
            oppScore={oppScore}
            winner={winner}
            onRematch={() => setPhase("picker")}
            onClose={onClose}
          />
        )}
      </div>

      {/* toast */}
      {toastMsg && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-[2147483647]">
          <div className="rounded-full bg-black/80 border border-fuchsia-400/40 px-4 py-2 text-[12px] font-bold text-fuchsia-100 shadow-2xl">
            {toastMsg}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(overlay, document.body);
}

/* ================================================================== */
/*  Sub-views                                                          */
/* ================================================================== */

function PickerView({
  duration,
  setDuration,
  query,
  setQuery,
  hosts,
  loading,
  onInvite,
  me,
}: {
  duration: PKDuration;
  setDuration: (d: PKDuration) => void;
  query: string;
  setQuery: (q: string) => void;
  hosts: OnlineHost[];
  loading: boolean;
  onInvite: (h: OnlineHost) => void;
  me: PKUser | null;
}) {
  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* duration picker */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
          Duration
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([3, 5, 10] as PKDuration[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className={cx(
                "rounded-xl border px-3 py-2 text-sm font-black transition",
                duration === d
                  ? "border-rose-400 bg-rose-500/20 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
                  : "border-slate-700 bg-slate-900/60 text-slate-300",
              )}
            >
              {d} min
            </button>
          ))}
        </div>
      </div>

      {/* search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search host by name or ID…"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-500 outline-none"
        />
      </div>

      {/* list */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-900 max-h-[50vh] overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
            <Loader2 className="animate-spin h-4 w-4 mr-2" /> Loading online hosts…
          </div>
        )}
        {!loading && hosts.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500 text-xs">
            No online hosts right now.<br />
            <span className="text-slate-600">Try again in a moment.</span>
          </div>
        )}
        {!loading &&
          hosts.map((h) => (
            <div
              key={h.id}
              className="flex items-center gap-3 px-3 py-2.5"
            >
              <img
                src={resolveAvatar(h.avatar, h.id)}
                alt=""
                className="h-10 w-10 rounded-full object-cover border border-slate-700"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/thumbs/svg?seed=${h.id}`;
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-100 truncate">
                  {h.name}
                </p>
                {h.roomTitle && (
                  <p className="text-[10px] text-slate-500 truncate">
                    {h.roomTitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onInvite(h)}
                disabled={String(me?.id) === String(h.id)}
                className="rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 px-3 py-1.5 text-[11px] font-black uppercase text-white disabled:opacity-40 flex items-center gap-1"
              >
                <Send className="h-3 w-3" /> Invite
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

function WaitingView({
  host,
  duration,
  onCancel,
}: {
  host: OnlineHost;
  duration: PKDuration;
  onCancel: () => void;
}) {
  return (
    <div className="mx-auto max-w-sm flex flex-col items-center gap-5 py-10 text-center">
      <div className="relative">
        <img
          src={resolveAvatar(host.avatar, host.id)}
          className="h-24 w-24 rounded-full object-cover border-4 border-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.6)]"
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/thumbs/svg?seed=${host.id}`;
          }}
        />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-rose-500 p-1">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
        </span>
      </div>
      <div>
        <p className="text-lg font-black text-slate-100">{host.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Waiting for opponent to accept · {duration} min match
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2 text-xs font-black uppercase text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Lazy Agora import (SSR-safe) — used to subscribe to the opponent's channel.
const PKAgoraPromise: Promise<any> =
  typeof window !== "undefined"
    ? import("agora-rtc-sdk-ng").then((m) => m.default)
    : (Promise.resolve(null as any));

function BattleView({
  me,
  opp,
  myScore,
  oppScore,
  remaining,
  totalSec,
  onEnd,
  battleId,
  apiBase,
  authToken,
  iAmFromHost,
  oppRoomId,
  localVideoTrackRef,
}: {
  me: PKUser | null;
  opp: OnlineHost | null;
  myScore: number;
  oppScore: number;
  remaining: number;
  totalSec: number;
  onEnd: () => void;
  battleId: string | number | null;
  apiBase?: string;
  authToken?: string | null;
  iAmFromHost: boolean;
  oppRoomId: string | number | null;
  localVideoTrackRef?: MutableRefObject<any> | null;
}) {
  const myPct =
    myScore === 0 && oppScore === 0
      ? 50
      : Math.min(85, Math.max(15, Math.round((myScore / (myScore + oppScore)) * 100)));
  const oppPct = 100 - myPct;
  const leader: "me" | "opp" | null =
    myScore === oppScore ? null : myScore > oppScore ? "me" : "opp";

  const meVideoRef = useRef<HTMLDivElement | null>(null);
  const oppVideoRef = useRef<HTMLDivElement | null>(null);
  const [meHasVideo, setMeHasVideo] = useState(false);
  const [oppHasVideo, setOppHasVideo] = useState(false);

  /* ---- Render my own local camera track (published by App) ----
     IMPORTANT: don't call `agoraTrack.play(container)` — that re-parents
     Agora's internal <video> and steals it from App's main live view,
     which leaves the PK creator's own side blank. Instead, clone the
     underlying MediaStreamTrack into our own <video> element. */
  useEffect(() => {
    if (!localVideoTrackRef) return;
    let cancelled = false;
    let videoEl: HTMLVideoElement | null = null;

    const tryPlay = () => {
      const t = localVideoTrackRef.current;
      const container = meVideoRef.current;
      if (!t || !container || cancelled) return false;
      try {
        const mst =
          typeof t.getMediaStreamTrack === "function"
            ? t.getMediaStreamTrack()
            : null;
        container.innerHTML = "";
        if (mst) {
          videoEl = document.createElement("video");
          videoEl.autoplay = true;
          videoEl.muted = true;
          videoEl.playsInline = true;
          videoEl.style.width = "100%";
          videoEl.style.height = "100%";
          videoEl.style.objectFit = "cover";
          videoEl.srcObject = new MediaStream([mst]);
          container.appendChild(videoEl);
          void videoEl.play().catch(() => {});
        } else {
          // Fallback (older SDK): use Agora play — may steal from main view
          t.play(container);
        }
        setMeHasVideo(true);
        return true;
      } catch {
        return false;
      }
    };

    const started = tryPlay();
    const iv = started
      ? null
      : window.setInterval(() => {
          if (tryPlay()) window.clearInterval(iv!);
        }, 500);
    const to = iv ? window.setTimeout(() => window.clearInterval(iv), 10000) : null;

    return () => {
      cancelled = true;
      if (iv) window.clearInterval(iv);
      if (to) window.clearTimeout(to);
      if (videoEl) {
        try { videoEl.srcObject = null; videoEl.remove(); } catch {}
      }
    };
  }, [localVideoTrackRef]);

  /* ---- Subscribe to opponent's live room via Agora ---- */
  useEffect(() => {
    if (!oppRoomId) return;
    let cancelled = false;
    let client: any = null;
    const retryTimers: number[] = [];

    (async () => {
      try {
        const AgoraRTC = await PKAgoraPromise;
        if (!AgoraRTC || cancelled) return;
        const channelName = `live_${oppRoomId}`;
        const tokenData: any = await pkPost(
          apiBase,
          "/agora/token",
          { channelName, role: "subscriber" },
          authToken,
        );
        if (cancelled || !tokenData?.appId || !tokenData?.channelName) return;

        client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        await client.setClientRole("audience");

        const subscribeAndPlay = async (user: any, mediaType: "video" | "audio") => {
          try {
            await client.subscribe(user, mediaType);
            if (mediaType === "video" && oppVideoRef.current) {
              oppVideoRef.current.innerHTML = "";
              user.videoTrack?.play(oppVideoRef.current);
              setOppHasVideo(true);
            }
            if (mediaType === "audio") user.audioTrack?.play();
          } catch { /* ignore */ }
        };

        client.on("user-published", async (user: any, mediaType: string) => {
          if (mediaType === "video" || mediaType === "audio") {
            await subscribeAndPlay(user, mediaType);
          }
        });
        client.on("user-unpublished", (_u: any, mediaType: string) => {
          if (mediaType === "video") setOppHasVideo(false);
        });

        const uid = /^\d+$/.test(String(tokenData.uid))
          ? Number(tokenData.uid)
          : (tokenData.uid ?? null);
        await client.join(tokenData.appId, tokenData.channelName, tokenData.token || null, uid);

        const subscribeExisting = () => {
          (client.remoteUsers || []).forEach((user: any) => {
            if (user?.hasVideo) void subscribeAndPlay(user, "video");
            if (user?.hasAudio) void subscribeAndPlay(user, "audio");
          });
        };
        subscribeExisting();
        const rid = window.setInterval(subscribeExisting, 1200);
        retryTimers.push(rid);
        window.setTimeout(() => window.clearInterval(rid), 12000);
      } catch { /* ignore */ }
    })();

    return () => {
      cancelled = true;
      retryTimers.forEach((id) => window.clearInterval(id));
      try {
        client?.removeAllListeners?.();
        client?.leave?.();
      } catch { /* ignore */ }
      setOppHasVideo(false);
    };
  }, [oppRoomId, apiBase, authToken]);

  const leftUser = iAmFromHost ? me : opp;
  const rightUser = iAmFromHost ? opp : me;
  const leftScore = iAmFromHost ? myScore : oppScore;
  const rightScore = iAmFromHost ? oppScore : myScore;
  const leftPct = iAmFromHost ? myPct : oppPct;
  const rightPct = 100 - leftPct;
  const leftVideoRef = iAmFromHost ? meVideoRef : oppVideoRef;
  const rightVideoRef = iAmFromHost ? oppVideoRef : meVideoRef;
  const leftHasVideo = iAmFromHost ? meHasVideo : oppHasVideo;
  const rightHasVideo = iAmFromHost ? oppHasVideo : meHasVideo;

  return (
    <div className="mx-auto max-w-2xl -mx-4 -mt-4">
      {/* Arena — edge-to-edge dual video, no gap, no borders */}
      <div className="relative grid grid-cols-2 gap-0 bg-black h-[400px]">
        {/* Left side */}
        <div className="relative overflow-hidden bg-black">
          <div
            ref={leftVideoRef}
            className="absolute inset-0 bg-black [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover"
          />
          {!leftHasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-rose-900/70 to-black">
              <img
                src={resolveAvatar(leftUser?.avatar, leftUser?.id || "l")}
                alt=""
                className="w-24 h-24 rounded-full border-[3px] border-rose-300 object-cover shadow-xl"
              />
            </div>
          )}
          <span className="absolute top-8 left-2 z-10 text-[9px] bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black px-2 py-0.5 rounded-full shadow">
            {iAmFromHost ? "YOU" : "OPPONENT"}
          </span>
          {leader && ((iAmFromHost && leader === "me") || (!iAmFromHost && leader === "opp")) && (
            <Trophy className="absolute top-8 right-2 z-10 w-5 h-5 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.9)]" />
          )}
          <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-rose-500/60 rounded-full px-2 py-0.5 shadow-lg shadow-rose-950/60 max-w-[90%] pointer-events-none">
            <div className="relative shrink-0">
              <img
                src={resolveAvatar(leftUser?.avatar, leftUser?.id || "l")}
                alt=""
                className="w-4 h-4 rounded-full object-cover border border-rose-400"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            </div>
            <span className="text-[10px] font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-rose-300 via-pink-200 to-amber-200 truncate max-w-[80px]">
              {leftUser?.name || (iAmFromHost ? "You" : "Opponent")}
            </span>
          </div>

        </div>

        {/* Right side */}
        <div className="relative overflow-hidden bg-black">
          <div
            ref={rightVideoRef}
            className="absolute inset-0 bg-black [&>video]:!w-full [&>video]:!h-full [&>video]:!object-cover"
          />
          {!rightHasVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900/70 to-black">
              <img
                src={resolveAvatar(rightUser?.avatar, rightUser?.id || "r")}
                alt=""
                className="w-24 h-24 rounded-full border-[3px] border-cyan-300 object-cover shadow-xl"
              />
            </div>
          )}
          <span className="absolute top-8 right-2 z-10 text-[9px] bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-black px-2 py-0.5 rounded-full shadow">
            {iAmFromHost ? "OPPONENT" : "YOU"}
          </span>
          {leader && ((iAmFromHost && leader === "opp") || (!iAmFromHost && leader === "me")) && (
            <Trophy className="absolute top-8 left-2 z-10 w-5 h-5 text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.9)]" />
          )}
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md border border-cyan-500/60 rounded-full px-2 py-0.5 shadow-lg shadow-cyan-950/60 max-w-[90%] pointer-events-none">
            <span className="text-[10px] font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-200 to-amber-200 truncate max-w-[80px]">
              {rightUser?.name || (iAmFromHost ? "Opponent" : "You")}
            </span>
            <div className="relative shrink-0">
              <img
                src={resolveAvatar(rightUser?.avatar, rightUser?.id || "r")}
                alt=""
                className="w-4 h-4 rounded-full object-cover border border-cyan-400"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
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
                🎁 {leftScore.toLocaleString()}
              </span>
            </div>
            <div className="bg-gradient-to-r from-cyan-500 via-blue-500 to-blue-600 h-full flex-1 transition-all duration-700 flex items-center justify-end pr-2 min-w-[36px]">
              <span className="text-[11px] font-black text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                {rightScore.toLocaleString()} 🎁
              </span>
            </div>
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-7 bg-white/80 rounded-full shadow" />
          </div>
        </div>


        {/* VS badge */}
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 font-black text-sm py-1.5 px-3 rounded-full border-[3px] border-slate-950 italic shadow-2xl shadow-amber-500/50 animate-pulse">
          VS
        </span>

        {/* Timer overlay — bottom center */}
        <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 z-30 text-center">
          <p className="text-2xl font-black text-amber-300 tabular-nums drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]">
            {fmtTime(remaining)}
          </p>
          <p className="text-[9px] text-amber-100/80 uppercase tracking-wider">
            of {fmtTime(totalSec)}
          </p>
        </div>
      </div>

      {/* Comments + End button below arena */}
      <div className="px-4 pt-3 space-y-3">
        {battleId && (
          <CommentStrip
            battleId={battleId}
            apiBase={apiBase}
            authToken={authToken}
            me={me}
            fromHostId={me?.id ?? null}
          />
        )}
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onEnd}
            className="rounded-full bg-slate-800 border border-slate-600 px-5 py-2 text-xs font-black uppercase text-slate-200"
          >
            End Battle
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  CommentStrip — realtime chat during a battle                       */
/* ================================================================== */
type PKComment = {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar?: string | null;
  role: "host_from" | "host_to" | "viewer";
  text: string;
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

function CommentStrip({
  battleId,
  apiBase,
  authToken,
  me,
}: {
  battleId: string | number;
  apiBase?: string;
  authToken?: string | null;
  me: PKUser | null;
  fromHostId?: string | number | null;
}) {
  const [comments, setComments] = useState<PKComment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef<number>(0);

  // poll new comments every 2s
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const j: any = await pkGet(
          apiBase,
          `/pk/${battleId}/comments${lastIdRef.current ? `?after_id=${lastIdRef.current}` : ""}`,
          authToken,
        );
        const arr: PKComment[] = Array.isArray(j?.data) ? j.data : [];
        if (cancelled || arr.length === 0) return;
        setComments((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          arr.forEach((c) => {
            if (!seen.has(c.id)) merged.push(c);
          });
          merged.sort((a, b) => a.id - b.id);
          const maxId = merged.reduce((m, c) => (c.id > m ? c.id : m), 0);
          lastIdRef.current = maxId;
          return merged.slice(-80); // keep last 80
        });
      } catch { /* silent */ }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [battleId, apiBase, authToken]);

  // autoscroll to bottom on new
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments]);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText("");
    // optimistic
    const tempId = -Date.now();
    setComments((prev) => [
      ...prev,
      {
        id: tempId, user_id: Number(me?.id || 0),
        user_name: me?.name || "You", user_avatar: me?.avatar,
        role: "viewer", text: t,
      },
    ]);
    try {
      const j: any = await pkPost(
        apiBase, `/pk/${battleId}/comment`, { text: t }, authToken,
      );
      if (j?.comment?.id) {
        setComments((prev) => prev.map((c) => (c.id === tempId ? { ...c, ...j.comment } : c)));
        if (j.comment.id > lastIdRef.current) lastIdRef.current = j.comment.id;
      }
    } catch (e: any) {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setText(t);
      const msg = String(e?.message || "Comment failed");
      console.error("[PK comment]", e);
      notifyPkCommentError(`PK comment failed: ${msg}`);
      try { (await import("sonner")).toast.error(msg); } catch {}
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-slate-800/80 bg-slate-900/60">
        <MessageCircle className="h-3.5 w-3.5 text-fuchsia-300" />
        <span className="text-[10px] font-black uppercase tracking-wider text-fuchsia-200">
          Live chat
        </span>
      </div>
      <div ref={listRef} className="max-h-40 min-h-[80px] overflow-y-auto px-3 py-2 space-y-1.5">
        {comments.length === 0 && (
          <p className="text-[11px] text-slate-600 text-center py-3">
            Say something to the arena…
          </p>
        )}
        {comments.map((c) => {
          const color =
            c.role === "host_from" ? "text-rose-300"
            : c.role === "host_to" ? "text-cyan-300"
            : "text-slate-200";
          const badge =
            c.role === "host_from" ? "border-rose-400/40 bg-rose-500/10 text-rose-200"
            : c.role === "host_to" ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
            : null;
          return (
            <div key={c.id} className="flex items-start gap-2 text-[12px] leading-snug">
              <img
                src={resolveAvatar(c.user_avatar, c.user_id)}
                alt=""
                className="h-5 w-5 rounded-full object-cover border border-slate-700 mt-0.5 shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/thumbs/svg?seed=${c.user_id}`;
                }}
              />
              <div className="min-w-0 flex-1">
                <span className={cx("font-bold mr-1", color)}>{c.user_name}</span>
                {badge && (
                  <span className={cx("inline-block rounded px-1 py-[1px] text-[9px] font-black uppercase mr-1 border", badge)}>
                    Host
                  </span>
                )}
                <span className="text-slate-100 break-words">{c.text}</span>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 border-t border-slate-800/80 bg-slate-900/60 px-2 py-1.5"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={300}
          className="flex-1 rounded-full bg-slate-950 border border-slate-700 px-3 py-1.5 text-[12px] text-slate-100 placeholder:text-slate-500 focus:border-fuchsia-500 outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 p-2 text-white disabled:opacity-40"
          aria-label="Send comment"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}


function HostCard({
  user,
  score,
  side,
}: {
  user: PKUser | null;
  score: number;
  side: "left" | "right";
}) {
  return (
    <div
      className={cx(
        "relative aspect-[3/4] rounded-2xl overflow-hidden border-2",
        side === "left"
          ? "border-rose-500/60 shadow-[0_0_30px_rgba(244,63,94,0.35)]"
          : "border-cyan-500/60 shadow-[0_0_30px_rgba(34,211,238,0.35)]",
      )}
    >
      <img
        src={resolveAvatar(user?.avatar, user?.id || side)}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/thumbs/svg?seed=${user?.id || side}`;
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-2 inset-x-2">
        <p className="text-[11px] font-black text-white truncate">
          {user?.name || (side === "left" ? "You" : "Opponent")}
        </p>
        <p
          className={cx(
            "text-lg font-black tabular-nums",
            side === "left" ? "text-rose-300" : "text-cyan-300",
          )}
        >
          {score.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function ResultView({
  me,
  opp,
  myScore,
  oppScore,
  winner,
  onRematch,
  onClose,
}: {
  me: PKUser | null;
  opp: OnlineHost | null;
  myScore: number;
  oppScore: number;
  winner: "me" | "opp" | "tie";
  onRematch: () => void;
  onClose: () => void;
}) {
  const winUser = winner === "me" ? me : winner === "opp" ? opp : null;
  return (
    <div className="mx-auto max-w-sm flex flex-col items-center gap-4 py-8 text-center">
      <Crown
        className={cx(
          "h-16 w-16 drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]",
          winner === "tie" ? "text-slate-400" : "text-amber-400",
        )}
      />
      <p className="text-2xl font-black text-white">
        {winner === "tie" ? "Draw" : `${winUser?.name || "Winner"} wins!`}
      </p>
      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
          <p className="text-[10px] uppercase text-rose-300 font-bold">You</p>
          <p className="text-xl font-black text-rose-100 tabular-nums">
            {myScore.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3">
          <p className="text-[10px] uppercase text-cyan-300 font-bold">
            Opponent
          </p>
          <p className="text-xl font-black text-cyan-100 tabular-nums">
            {oppScore.toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2 text-xs font-black uppercase text-slate-300"
        >
          Close
        </button>
        <button
          type="button"
          onClick={onRematch}
          className="rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 px-5 py-2 text-xs font-black uppercase text-white"
        >
          New PK
        </button>
      </div>
    </div>
  );
}
