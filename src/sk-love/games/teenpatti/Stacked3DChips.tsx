// @ts-nocheck
import React from "react";

interface Props {
  amount: number;
  size?: "sm" | "md";
}

export default function Stacked3DChips({ amount, size = "sm" }: Props) {
  if (amount <= 0) return null;

  // Determine stack height (2 to 5 chips) and color based on amount
  const count = amount >= 1000000 ? 5 : amount >= 500000 ? 4 : amount >= 100000 ? 3 : 2;

  const getChipStyle = () => {
    if (amount >= 1000000) {
      return {
        bg: "radial-gradient(circle at 35% 35%, #fef08a, #f59e0b 60%, #b45309)",
        border: "border-amber-200",
        shadow: "#78350f",
        accent: "#fef3c7",
      };
    }
    if (amount >= 100000) {
      return {
        bg: "radial-gradient(circle at 35% 35%, #bae6fd, #0284c7 60%, #0369a1)",
        border: "border-sky-200",
        shadow: "#0c4a6e",
        accent: "#e0f2fe",
      };
    }
    if (amount >= 10000) {
      return {
        bg: "radial-gradient(circle at 35% 35%, #fed7aa, #ea580c 60%, #c2410c)",
        border: "border-orange-200",
        shadow: "#7c2d12",
        accent: "#ffedd5",
      };
    }
    return {
      bg: "radial-gradient(circle at 35% 35%, #e9d5ff, #9333ea 60%, #7e22ce)",
      border: "border-purple-200",
      shadow: "#581c87",
      accent: "#f3e8ff",
    };
  };

  const style = getChipStyle();
  const chipDim = size === "sm" ? "w-7 h-7" : "w-9 h-9";

  return (
    <div className="relative flex flex-col items-center justify-center my-1">
      {/* 3D Stacked Layers */}
      <div className="relative h-9 w-12 flex items-center justify-center">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${chipDim} border border-white/60 flex items-center justify-center shadow-md transition-transform duration-300`}
            style={{
              bottom: `${i * 3.5}px`,
              background: style.bg,
              boxShadow: `0 2px 0 ${style.shadow}, 0 4px 8px rgba(0,0,0,0.4)`,
              transform: `scale(${1 - i * 0.02})`,
              zIndex: i + 1,
            }}
          >
            {/* Inner dashed ring */}
            <div className="absolute inset-[3px] rounded-full border border-dashed border-white/70" />
            {/* Center dot/crown on top chip */}
            {i === count - 1 && (
              <span className="text-[8px] font-black text-white drop-shadow">
                👑
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
