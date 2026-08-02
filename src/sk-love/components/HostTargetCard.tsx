// @ts-nocheck
import React from "react";

/**
 * HostTargetCard
 * ----------------------------------------------------------------------------
 * Shows the host's current-period progress toward the admin-set target:
 *   • Coins earned   / coins_target
 *   • Live hours     / live_hours_target
 *   • Diamonds       / diamonds_target   (only if admin set one)
 *
 * Data source: GET /api/agency/target        → { target }
 *              GET /api/agency/reports?range=monthly → { totals: {coins, hours, diamonds} }
 *
 * Drop-in usage inside App.tsx (host profile / streaming dashboard area):
 *
 *   import HostTargetCard from "./components/HostTargetCard";
 *   ...
 *   {isHost && <HostTargetCard />}
 */

type Target = {
  coins_target?: number | null;
  live_hours_target?: number | null;
  diamonds_target?: number | null;
  period_start?: string;
  period_end?: string;
};

type Totals = { coins: number; hours: number; diamonds: number };

const API =
  (import.meta as any).env?.VITE_API_BASE_URL ||
  (import.meta as any).env?.VITE_API_URL ||
  "https://api.keno70.com";

const token = () => {
  try { return localStorage.getItem("sk_love_token") || ""; } catch { return ""; }
};

async function fetchJSON<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token()}`,
      },
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}k`
  : String(n);

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export default function HostTargetCard() {
  const [target, setTarget] = React.useState<Target | null>(null);
  const [totals, setTotals] = React.useState<Totals>({ coins: 0, hours: 0, diamonds: 0 });
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const [t, r] = await Promise.all([
      fetchJSON<{ target: Target }>("/api/agency/target"),
      fetchJSON<{ totals?: Totals }>("/api/agency/reports?range=monthly"),
    ]);
    setTarget(t?.target ?? null);
    setTotals(r?.totals ?? { coins: 0, hours: 0, diamonds: 0 });
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(id);
  }, [load]);

  if (loading) return null;
  if (!target || (!target.coins_target && !target.live_hours_target && !target.diamonds_target)) {
    return null; // no active target — hide silently
  }

  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-pink-500/15 via-purple-500/10 to-blue-500/15 border border-white/10 shadow-lg backdrop-blur-sm text-white space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-2">
          🎯 <span>Host Target</span>
        </div>
        {target.period_end && (
          <div className="text-[10px] opacity-70">
            till {new Date(target.period_end).toLocaleDateString()}
          </div>
        )}
      </div>

      {!!target.coins_target && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>💰 Coins</span>
            <span className="font-mono">
              {fmt(totals.coins)} / {fmt(target.coins_target)}
            </span>
          </div>
          <Bar value={totals.coins} max={target.coins_target} color="#f59e0b" />
        </div>
      )}

      {!!target.live_hours_target && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>⏱ Live Hours</span>
            <span className="font-mono">
              {totals.hours.toFixed(1)} / {target.live_hours_target}
            </span>
          </div>
          <Bar value={totals.hours} max={target.live_hours_target} color="#10b981" />
        </div>
      )}

      {!!target.diamonds_target && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>💎 Diamonds</span>
            <span className="font-mono">
              {fmt(totals.diamonds)} / {fmt(target.diamonds_target)}
            </span>
          </div>
          <Bar value={totals.diamonds} max={target.diamonds_target} color="#38bdf8" />
        </div>
      )}

      <div className="text-[10px] opacity-60 leading-relaxed">
        ⚠️ Target period শেষে miss করলে wallet auto-reset হবে।
      </div>
    </div>
  );
}
