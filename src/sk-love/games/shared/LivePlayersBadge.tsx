// @ts-nocheck
import { useEffect, useState } from "react";

interface LivePlayersBadgeProps {
  base?: number;      // rough baseline count
  jitter?: number;    // max +/- fluctuation
}

/**
 * A small "LIVE • 1,247 playing" badge.
 * The number fluctuates every few seconds for a live feel.
 * Purely cosmetic; no server dependency.
 */
export default function LivePlayersBadge({
  base = 1200,
  jitter = 80,
}: LivePlayersBadgeProps) {
  const [count, setCount] = useState(base);

  useEffect(() => {
    const t = setInterval(() => {
      const delta = Math.floor((Math.random() - 0.5) * jitter);
      setCount((c) => {
        const next = c + delta;
        // stay within +/- 200 of base
        if (Math.abs(next - base) > 200) return base + delta;
        return Math.max(50, next);
      });
    }, 2500);
    return () => clearInterval(t);
  }, [base, jitter]);

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-white/10">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-white">
        LIVE
      </span>
      <span className="text-[11px] text-white/80 tabular-nums">
        {count.toLocaleString()} playing
      </span>
    </div>
  );
}
