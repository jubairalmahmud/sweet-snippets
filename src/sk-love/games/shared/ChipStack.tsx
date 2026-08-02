// @ts-nocheck
import { motion } from "framer-motion";

interface ChipStackProps {
  value: number;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: number;
}

/**
 * Casino-style poker chip button. Distinct color per denomination tier.
 * Uses radial gradient + dashed inner ring for a 3D feel.
 */
export default function ChipStack({
  value,
  selected,
  onClick,
  disabled,
  size = 52,
}: ChipStackProps) {
  const style = chipStyle(value);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -3 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center justify-center rounded-full font-black text-white select-none ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${selected ? "ring-4 ring-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.6)]" : "ring-1 ring-white/30"}`}
      style={{
        width: size,
        height: size,
        background: style.bg,
        boxShadow: `0 4px 0 ${style.shadow}, 0 6px 12px rgba(0,0,0,0.35)`,
      }}
    >
      <span
        className="absolute inset-1 rounded-full border-2 border-dashed border-white/50"
        style={{ borderStyle: "dashed" }}
      />
      <span className="relative text-[11px] leading-none drop-shadow">
        {formatChip(value)}
      </span>
    </motion.button>
  );
}

function chipStyle(v: number) {
  if (v >= 10000) return { bg: "radial-gradient(circle at 30% 30%, #f9a8d4, #db2777 60%, #831843)", shadow: "#500724" };
  if (v >= 1000)  return { bg: "radial-gradient(circle at 30% 30%, #fde68a, #f59e0b 60%, #78350f)", shadow: "#451a03" };
  if (v >= 500)   return { bg: "radial-gradient(circle at 30% 30%, #c4b5fd, #7c3aed 60%, #3b0764)", shadow: "#1e1065" };
  if (v >= 100)   return { bg: "radial-gradient(circle at 30% 30%, #86efac, #16a34a 60%, #14532d)", shadow: "#052e16" };
  if (v >= 50)    return { bg: "radial-gradient(circle at 30% 30%, #93c5fd, #2563eb 60%, #1e3a8a)", shadow: "#172554" };
  return { bg: "radial-gradient(circle at 30% 30%, #fca5a5, #dc2626 60%, #7f1d1d)", shadow: "#450a0a" };
}

function formatChip(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1000)    return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(v);
}
