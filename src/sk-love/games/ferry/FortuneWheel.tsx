// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";

interface SlotCfg {
  id: number;
  label: string;
  multiplier: number;
  color: string; // tailwind bg-* OR hex
  icon?: string;
}

interface Props {
  slots: SlotCfg[];
  spinning: boolean;
  targetIndex: number | null; // final slot index (0-based, matches slots order)
  onSpinEnd?: () => void;
  size?: number;
}

// Convert tailwind-ish color name into fill hex; if already hex keep it.
const COLOR_MAP: Record<string, string> = {
  "bg-red-500": "#ef4444",
  "bg-red-600": "#dc2626",
  "bg-orange-500": "#f97316",
  "bg-amber-500": "#f59e0b",
  "bg-yellow-500": "#eab308",
  "bg-lime-500": "#84cc16",
  "bg-green-500": "#22c55e",
  "bg-emerald-500": "#10b981",
  "bg-teal-500": "#14b8a6",
  "bg-cyan-500": "#06b6d4",
  "bg-sky-500": "#0ea5e9",
  "bg-blue-500": "#3b82f6",
  "bg-indigo-500": "#6366f1",
  "bg-violet-500": "#8b5cf6",
  "bg-purple-500": "#a855f7",
  "bg-fuchsia-500": "#d946ef",
  "bg-pink-500": "#ec4899",
  "bg-rose-500": "#f43f5e",
};

const resolveColor = (c: string, fallback: string) => {
  if (!c) return fallback;
  if (c.startsWith("#")) return c;
  return COLOR_MAP[c] || fallback;
};

const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

export default function FortuneWheel({
  slots,
  spinning,
  targetIndex,
  onSpinEnd,
  size = 300,
}: Props) {
  const n = Math.max(slots.length, 1);
  const sliceDeg = 360 / n;
  const [rotation, setRotation] = useState(0);
  const spinsDone = useRef(0);

  const wedges = useMemo(() => {
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 4;
    return slots.map((s, i) => {
      const start = i * sliceDeg - 90 - sliceDeg / 2;
      const end = start + sliceDeg;
      const startRad = (start * Math.PI) / 180;
      const endRad = (end * Math.PI) / 180;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);
      const large = sliceDeg > 180 ? 1 : 0;
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      // label position
      const midRad = ((start + sliceDeg / 2) * Math.PI) / 180;
      const lr = r * 0.66;
      const lx = cx + lr * Math.cos(midRad);
      const ly = cy + lr * Math.sin(midRad);
      const midDeg = start + sliceDeg / 2 + 90;
      return {
        d,
        fill: resolveColor(s.color, PALETTE[i % PALETTE.length]),
        icon: s.icon || "🎁",
        label: s.label,
        multiplier: s.multiplier,
        lx,
        ly,
        rotate: midDeg,
      };
    });
  }, [slots, sliceDeg, size]);

  useEffect(() => {
    if (!spinning || targetIndex == null) return;
    spinsDone.current += 1;
    // Land pointer (top, 0deg) on target slice center.
    // Slice i center is at angle i*sliceDeg (measured clockwise from top after our -90 offset).
    // We rotate the wheel by -i*sliceDeg + full spins.
    const spins = 6;
    const target =
      spins * 360 - targetIndex * sliceDeg + spinsDone.current * 0; // unique each call
    // Ensure ever-increasing rotation
    setRotation((prev) => {
      const base = Math.floor(prev / 360) * 360;
      return base + target;
    });
  }, [spinning, targetIndex, sliceDeg]);

  return (
    <div
      className="relative"
      style={{ width: size, height: size }}
    >
      {/* Outer ring bulbs */}
      <svg
        className="absolute inset-0"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 1}
          fill="none"
          stroke="#facc15"
          strokeWidth="3"
        />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
          const r = size / 2 - 1;
          return (
            <circle
              key={i}
              cx={size / 2 + r * Math.cos(a)}
              cy={size / 2 + r * Math.sin(a)}
              r={3}
              fill={i % 2 === 0 ? "#fde047" : "#fff"}
              className={spinning ? "animate-pulse" : ""}
            />
          );
        })}
      </svg>

      {/* Wheel */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? "transform 4.2s cubic-bezier(0.17, 0.67, 0.24, 1)"
            : "none",
        }}
        onTransitionEnd={() => spinning && onSpinEnd?.()}
        className="absolute inset-0"
      >
        {wedges.map((w, i) => (
          <g key={i}>
            <path d={w.d} fill={w.fill} stroke="#fff" strokeWidth="2" />
            <g
              transform={`translate(${w.lx} ${w.ly}) rotate(${w.rotate})`}
              style={{ pointerEvents: "none" }}
            >
              <text
                textAnchor="middle"
                fontSize="22"
                dominantBaseline="middle"
              >
                {w.icon}
              </text>
              <text
                y="18"
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="#fff"
              >
                x{w.multiplier}
              </text>
            </g>
          </g>
        ))}
        {/* Center hub */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size * 0.12}
          fill="#111"
          stroke="#facc15"
          strokeWidth="3"
        />
        <text
          x={size / 2}
          y={size / 2 + 5}
          textAnchor="middle"
          fontSize="14"
          fontWeight="bold"
          fill="#facc15"
        >
          SPIN
        </text>
      </svg>

      {/* Pointer */}
      <div
        className="absolute left-1/2 -translate-x-1/2 -top-1 z-10"
        style={{
          width: 0,
          height: 0,
          borderLeft: "12px solid transparent",
          borderRight: "12px solid transparent",
          borderTop: "22px solid #facc15",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))",
        }}
      />
    </div>
  );
}
