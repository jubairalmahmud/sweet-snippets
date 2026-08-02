// @ts-nocheck
import { useEffect, useState } from "react";

interface CircularTimerProps {
  seconds: number;        // total seconds
  remaining: number;      // seconds remaining
  size?: number;
  stroke?: number;
  label?: string;
}

/**
 * Circular countdown ring. Turns green -> yellow -> red as time runs out.
 * Purely visual; parent controls the actual countdown state.
 */
export default function CircularTimer({
  seconds,
  remaining,
  size = 72,
  stroke = 6,
  label,
}: CircularTimerProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, remaining / Math.max(1, seconds)));
  const offset = c * (1 - pct);

  const color =
    pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#eab308" : "#ef4444";

  // subtle pulse in last 3s
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setPulse(remaining <= 3 && remaining > 0);
  }, [remaining]);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${pulse ? "animate-pulse" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white leading-none">
          {Math.max(0, Math.ceil(remaining))}
        </span>
        {label && (
          <span className="text-[9px] uppercase tracking-wider text-white/70 mt-0.5">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
