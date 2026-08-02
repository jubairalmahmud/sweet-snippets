// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * European Roulette wheel (single-zero, 37 pockets).
 * Real spinning SVG — counter-rotating ball — lands precisely on `targetNumber`.
 *
 * Usage:
 *   <RouletteWheel targetNumber={result?.number ?? null} spinning={phase==='spinning'} />
 * When `targetNumber` changes from null → a number while `spinning=true`, the
 * wheel animates for `spinMs` and the ball ends over that pocket.
 */

// European roulette pocket order, starting at 0 (top).
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SLOT = 360 / 37; // ≈ 9.7297°
const R_OUTER = 140;
const R_INNER = 78;
const R_HUB = 42;
const R_BALL_TRACK = 118;
const R_BALL = 7;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r1: number, r2: number, a1: number, a2: number) => {
  const p1 = polar(cx, cy, r2, a1);
  const p2 = polar(cx, cy, r2, a2);
  const p3 = polar(cx, cy, r1, a2);
  const p4 = polar(cx, cy, r1, a1);
  const large = a2 - a1 <= 180 ? 0 : 1;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${r2} ${r2} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${r1} ${r1} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
};

interface Props {
  /** Server-returned winning number 0..36. Null while betting/idle. */
  targetNumber: number | null;
  /** True while we are showing the spin animation. */
  spinning: boolean;
  /** Total spin duration in ms (default 4200). */
  spinMs?: number;
  /** Visual size in px (square). */
  size?: number;
}

export default function RouletteWheel({
  targetNumber,
  spinning,
  spinMs = 4200,
  size = 300,
}: Props) {
  const [wheelRot, setWheelRot] = useState(0);
  const [ballRot, setBallRot] = useState(0);
  const spunForRef = useRef<number | null>(null);

  useEffect(() => {
    if (!spinning || targetNumber == null) return;
    // Avoid double-spinning for the same number.
    if (spunForRef.current === targetNumber) return;
    spunForRef.current = targetNumber;

    const idx = (WHEEL_ORDER as readonly number[]).indexOf(targetNumber);
    if (idx < 0) return;

    // Wheel spins clockwise 5 full turns and lands so that pocket `idx` sits
    // under the top pointer. At rotation R, pocket i is at angle (i*SLOT + R).
    // We want (idx*SLOT + R) ≡ 0 (mod 360)  →  R = -idx*SLOT (mod 360).
    const base = wheelRot;
    const currentMod = ((base % 360) + 360) % 360;
    const wanted = (360 - idx * SLOT) % 360;
    const delta = ((wanted - currentMod) + 360) % 360;
    setWheelRot(base + 360 * 5 + delta);

    // Ball counter-rotates ~8 turns and settles at top (0°).
    const bBase = ballRot;
    const bMod = ((bBase % 360) + 360) % 360;
    const bDelta = ((0 - bMod) + 360) % 360;
    setBallRot(bBase - 360 * 8 - bDelta);
  }, [spinning, targetNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the "already spun" guard when we leave spinning phase.
  useEffect(() => {
    if (!spinning) spunForRef.current = null;
  }, [spinning]);

  const wedges = useMemo(() => {
    return WHEEL_ORDER.map((num, i) => {
      const a1 = i * SLOT - SLOT / 2;
      const a2 = i * SLOT + SLOT / 2;
      const color = num === 0 ? "#059669" : RED.has(num) ? "#dc2626" : "#0a0a0a";
      const labelPos = polar(0, 0, (R_OUTER + R_INNER) / 2, i * SLOT);
      return { num, a1, a2, color, labelPos };
    });
  }, []);

  const easing = "cubic-bezier(0.17, 0.67, 0.24, 1)";

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
      aria-label="Roulette wheel"
    >
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(250,204,21,0.35) 0%, rgba(250,204,21,0.05) 60%, transparent 75%)",
          filter: "blur(4px)",
        }}
      />

      {/* Wheel (rotates) */}
      <svg
        viewBox="-160 -160 320 320"
        className="absolute inset-0 w-full h-full drop-shadow-2xl"
        style={{
          transform: `rotate(${wheelRot}deg)`,
          transition: spinning ? `transform ${spinMs}ms ${easing}` : "none",
        }}
      >
        {/* Rim */}
        <circle r={R_OUTER + 8} fill="#78350f" />
        <circle r={R_OUTER + 4} fill="#b45309" />
        <circle r={R_OUTER} fill="#1a1a1a" />

        {/* Pockets */}
        {wedges.map((w) => (
          <g key={w.num}>
            <path d={arcPath(0, 0, R_INNER, R_OUTER, w.a1, w.a2)} fill={w.color} stroke="#facc15" strokeWidth={0.6} />
            <text
              x={w.labelPos.x}
              y={w.labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#fff"
              fontSize={11}
              fontWeight={700}
              transform={`rotate(${w.num === 0 ? 0 : WHEEL_ORDER.indexOf(w.num) * SLOT} ${w.labelPos.x} ${w.labelPos.y})`}
            >
              {w.num}
            </text>
          </g>
        ))}

        {/* Inner ring */}
        <circle r={R_INNER} fill="#78350f" />
        <circle r={R_INNER - 4} fill="#1a1a1a" />

        {/* Hub with cross */}
        <circle r={R_HUB} fill="#b45309" />
        <circle r={R_HUB - 4} fill="#0a0a0a" />
        <rect x={-R_HUB + 4} y={-3} width={(R_HUB - 4) * 2} height={6} fill="#facc15" rx={2} />
        <rect x={-3} y={-R_HUB + 4} width={6} height={(R_HUB - 4) * 2} fill="#facc15" rx={2} />
        <circle r={7} fill="#facc15" />
      </svg>

      {/* Ball track (counter-rotates) */}
      <div
        className="absolute inset-0"
        style={{
          transform: `rotate(${ballRot}deg)`,
          transition: spinning ? `transform ${spinMs}ms ${easing}` : "none",
        }}
      >
        <div
          className="absolute rounded-full bg-white shadow-lg"
          style={{
            width: R_BALL * 2,
            height: R_BALL * 2,
            left: `calc(50% - ${R_BALL}px)`,
            top: `calc(50% - ${R_BALL_TRACK + R_BALL}px)`,
            boxShadow: "0 0 8px rgba(255,255,255,0.9), inset -2px -2px 3px rgba(0,0,0,0.4)",
          }}
        />
      </div>

      {/* Top pointer */}
      <div
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{ top: -6 }}
      >
        <svg width={22} height={26} viewBox="0 0 22 26">
          <polygon points="11,26 0,0 22,0" fill="#facc15" stroke="#78350f" strokeWidth={1.5} />
        </svg>
      </div>
    </div>
  );
}
