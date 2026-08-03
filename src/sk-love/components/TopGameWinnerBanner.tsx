// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import RoyalGiftBanner from "./RoyalGiftBanner";

export type GameWinEventDetail = {
  userId?: string;
  name: string;
  avatar?: string;
  amount: number;
  game: string; // "Roulette" | "Fortune Wheel" | "Teen Patti" | ...
};

export const emitGameWin = (partial: Partial<GameWinEventDetail> & { amount: number; game: string }) => {
  try {
    if (!partial.amount || partial.amount <= 0) return;
    let name = partial.name;
    let avatar = partial.avatar;
    let userId = partial.userId;
    if (!name || !avatar || !userId) {
      try {
        const me = JSON.parse(localStorage.getItem("sk_love_user") || "{}");
        name = name || me?.name || me?.username || "Player";
        avatar = avatar || me?.avatar || me?.avatar_url || undefined;
        userId = userId || me?.id || me?.user_id;
      } catch {
        name = name || "Player";
      }
    }
    const detail: GameWinEventDetail = { userId, name: name!, avatar, amount: partial.amount, game: partial.game };
    window.dispatchEvent(new CustomEvent("sk:game-win", { detail }));
    // Fire-and-forget backend report so other clients can pick it up via poll
    api
      .post("/api/games/report-win", {
        user_id: detail.userId,
        name: detail.name,
        avatar: detail.avatar,
        amount: detail.amount,
        game: detail.game,
      })
      .catch(() => {});
  } catch {}
};

type Winner = GameWinEventDetail & { ts: number };

const formatCoins = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
};

/**
 * App-wide floating banner that announces the current highest single win
 * across every ongoing game session (Roulette / Fortune Wheel / Teen Patti).
 *
 * Sources (whichever is highest within the recent window wins):
 *  1. Local `sk:game-win` window CustomEvent (fired by each game on a win)
 *  2. Poll to `/api/games/top-winner` every 8s (graceful if not deployed)
 */
export default function TopGameWinnerBanner() {
  const [current, setCurrent] = useState<Winner | null>(null);
  const bestRef = useRef<Winner | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const consider = (w: Winner) => {
    const now = Date.now();
    const best = bestRef.current;
    // Keep the highest within a rolling 60s window
    const fresh = best && now - best.ts < 60_000 ? best : null;
    if (!fresh || w.amount > fresh.amount) {
      bestRef.current = w;
      setCurrent(w);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        setCurrent(null);
        bestRef.current = null;
      }, 12_000);
    }
  };

  useEffect(() => {
    const onWin = (e: Event) => {
      const d = (e as CustomEvent<GameWinEventDetail>).detail;
      if (!d || !d.amount || d.amount <= 0) return;
      consider({ ...d, ts: Date.now() });
    };
    window.addEventListener("sk:game-win", onWin as EventListener);
    return () => window.removeEventListener("sk:game-win", onWin as EventListener);
  }, []);

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res: any = await api.get("/api/games/top-winner");
        const w = res?.winner ?? res?.data?.winner ?? res;
        const amount = Number(w?.amount ?? w?.win ?? 0);
        if (!stopped && w && amount > 0) {
          consider({
            userId: w.user_id ?? w.userId,
            name: w.name ?? w.user_name ?? "Player",
            avatar: w.avatar ?? w.user_avatar,
            amount,
            game: w.game ?? "Game",
            ts: Date.now(),
          });
        }
      } catch {}
    };
    poll();
    const id = window.setInterval(poll, 8000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, []);

  if (!current) return null;

  const initial = (current.name || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-[9999] -translate-x-1/2 px-2 w-full max-w-[460px]"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }}
    >
      <div key={`${current.name}-${current.amount}-${current.ts}`} className="pointer-events-auto">
        <RoyalGiftBanner
          giverName={current.name || "Player"}
          giverAvatar={current.avatar}
          giverBadge="Agency Holder"
          iconEmoji="🍷"
          mainActionText="WON"
          amountText={formatCoins(current.amount)}
          secondaryText="FROM"
          giftName={current.game || "GREEDY KING"}
          giftIcon="🎰"
        />
      </div>
    </div>
  );
}
