// @ts-nocheck
/* ============================================================================
 *  PKInviteListener.tsx
 * ----------------------------------------------------------------------------
 *  Always-mounted background poller that listens for incoming 1v1 PK invites
 *  addressed to the current user. When a pending invite is detected it shows
 *  a full-screen (portal) modal with:
 *     • inviter avatar + name
 *     • 5-second countdown (auto-rejects on timeout)
 *     • Accept  → POST /pk/accept  → onAccepted(battle)
 *     • Reject  → POST /pk/reject
 *
 *  Mount it once from App.tsx while the user is live-streaming so any host
 *  can invite them.
 * ==========================================================================*/

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Swords, Check, X } from "lucide-react";
import { api } from "../lib/api";

export type PKBattle = {
  id: number | string;
  from_host_id: number;
  to_host_id: number;
  from_room_id?: number | string | null;
  to_room_id?: number | string | null;
  duration_minutes: number;
  status: string;
  started_at?: string | null;
  ends_at?: string | null;
  from_name?: string;
  from_avatar?: string;
};

interface Props {
  enabled: boolean;
  currentUserId: number | string | null;
  roomId?: number | string | null;
  onAccepted: (battle: PKBattle & { opponent: { id: number; name: string; avatar?: string } }) => void;
  pollMs?: number;
  countdownSec?: number;
}

const AUTO_REJECT_SEC_DEFAULT = 5;

export default function PKInviteListener({
  enabled,
  currentUserId,
  roomId,
  onAccepted,
  pollMs = 3000,
  countdownSec = AUTO_REJECT_SEC_DEFAULT,
}: Props) {
  const [invite, setInvite] = useState<PKBattle | null>(null);
  const [remaining, setRemaining] = useState(countdownSec);
  const [busy, setBusy] = useState(false);
  const dismissedIds = useRef<Set<string>>(new Set());
  const pollRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);

  /* ---------------- poll /pk/mine ---------------- */
  useEffect(() => {
    if (!enabled || !currentUserId) return;

    const poll = async () => {
      try {
        const j: any = await api.get("/api/pk/mine");
        const b: PKBattle | null = j?.data ?? null;
        if (!b) return;
        if (String(b.to_host_id) !== String(currentUserId)) return;
        if (b.status !== "pending") return;
        if (dismissedIds.current.has(String(b.id))) return;
        setInvite((prev) => (prev && String(prev.id) === String(b.id) ? prev : b));
      } catch {
        /* silent */
      }
    };

    poll();
    pollRef.current = window.setInterval(poll, pollMs) as unknown as number;
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [enabled, currentUserId, pollMs]);

  /* ---------------- countdown ---------------- */
  useEffect(() => {
    if (!invite) return;
    setRemaining(countdownSec);
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          window.clearInterval(tickRef.current!);
          // auto-reject
          void doReject(invite);
          return 0;
        }
        return r - 1;
      });
    }, 1000) as unknown as number;
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite?.id]);

  const doReject = async (b: PKBattle) => {
    if (busy) return;
    setBusy(true);
    dismissedIds.current.add(String(b.id));
    try {
      await api.post("/api/pk/reject", { battle_id: b.id });
    } catch {}
    setInvite(null);
    setBusy(false);
  };

  const doAccept = async (b: PKBattle) => {
    if (busy) return;
    setBusy(true);
    dismissedIds.current.add(String(b.id));
    try {
      const payload: Record<string, unknown> = { battle_id: b.id };
      if (roomId) payload.room_id = roomId;
      const j: any = await api.post("/api/pk/accept", payload);
      const battle: PKBattle = j?.battle ?? b;
      const inviter = {
        id: Number(b.from_host_id),
        name: (b as any).from_name || `Host #${b.from_host_id}`,
        avatar: (b as any).from_avatar,
      };
      onAccepted({ ...battle, opponent: inviter });
    } catch {}
    setInvite(null);
    setBusy(false);
  };

  if (!enabled || !invite) return null;

  const inviterName = (invite as any).from_name || `Host #${invite.from_host_id}`;
  const rawAvatar = (invite as any).from_avatar as string | undefined;
  const API_ORIGIN = (() => {
    const raw =
      (import.meta as any).env?.VITE_API_BASE_URL ||
      (import.meta as any).env?.VITE_API_URL ||
      (import.meta as any).env?.VITE_BACKEND_URL ||
      (import.meta as any).env?.VITE_LARAVEL_URL ||
      "https://api.keno70.com";
    try { return new URL(String(raw)).origin; } catch { return String(raw).replace(/\/+$/, ""); }
  })();
  const resolveAvatar = (av?: string) => {
    const s = (av || "").trim();
    if (!s) return `https://api.dicebear.com/7.x/thumbs/svg?seed=${invite.from_host_id}`;
    if (/^(https?:|data:|blob:)/i.test(s)) return s;
    if (s.startsWith("//")) return `https:${s}`;
    return `${API_ORIGIN}${s.startsWith("/") ? s : `/storage/${s}`}`;
  };
  const inviterAvatar = resolveAvatar(rawAvatar);

  return createPortal(
    <div className="fixed inset-0 z-[2147483640] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm rounded-3xl border border-rose-400/40 bg-gradient-to-b from-[#1a0a24] to-[#0b0616] p-6 shadow-[0_0_60px_rgba(244,63,94,0.35)]">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Swords className="h-5 w-5 text-rose-400" />
          <span className="text-[11px] font-black uppercase tracking-wider text-rose-300">
            PK Battle Invitation
          </span>
        </div>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative">
            <img
              src={inviterAvatar}
              alt=""
              className="h-24 w-24 rounded-full object-cover border-4 border-rose-500 shadow-[0_0_30px_rgba(244,63,94,0.55)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = `https://api.dicebear.com/7.x/thumbs/svg?seed=${invite.from_host_id}`;
              }}
            />
            <span className="absolute -bottom-1 -right-1 rounded-full bg-black/80 border border-rose-400/60 px-2 py-0.5 text-[10px] font-black text-rose-200">
              {remaining}s
            </span>
          </div>
          <p className="text-base font-black text-white leading-tight">
            {inviterName}
          </p>
          <p className="text-xs text-slate-300">
            আপনাকে <span className="text-rose-300 font-bold">{invite.duration_minutes} মিনিট</span> এর PK Battle-এ আমন্ত্রণ জানিয়েছে
          </p>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => doReject(invite)}
            disabled={busy}
            className="flex-1 rounded-full border border-slate-600 bg-slate-900/80 py-2.5 text-sm font-black uppercase text-slate-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <X className="h-4 w-4" /> Reject
          </button>
          <button
            type="button"
            onClick={() => doAccept(invite)}
            disabled={busy}
            className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-600 py-2.5 text-sm font-black uppercase text-white shadow-[0_0_20px_rgba(244,63,94,0.5)] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Check className="h-4 w-4" /> Accept
          </button>
        </div>

        {/* thin countdown bar */}
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-fuchsia-500 transition-all duration-1000 ease-linear"
            style={{ width: `${(remaining / countdownSec) * 100}%` }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
