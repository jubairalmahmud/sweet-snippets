// @ts-nocheck
import { useEffect, useState } from "react";

export interface PlayingCard {
  rank: string;
  suit: "♠" | "♥" | "♦" | "♣";
}

interface Props {
  card?: PlayingCard;
  faceUp: boolean;
  delay?: number;
  dealDelay?: number;
  highlight?: boolean;
  size?: "sm" | "md";
}

export default function FlipCard({
  card,
  faceUp,
  delay = 0,
  dealDelay = 0,
  highlight = false,
  size = "sm",
}: Props) {
  const [dealt, setDealt] = useState(false);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDealt(true), dealDelay);
    return () => clearTimeout(t);
  }, [dealDelay]);

  useEffect(() => {
    if (!faceUp) {
      setFlipped(false);
      return;
    }
    const t = setTimeout(() => setFlipped(true), delay);
    return () => clearTimeout(t);
  }, [faceUp, delay]);

  const dims = size === "sm" ? "w-[34px] h-[48px]" : "w-[42px] h-[58px]";
  const isRed = card && (card.suit === "♥" || card.suit === "♦");

  return (
    <div
      className={`relative ${dims}`}
      style={{
        perspective: "600px",
        transform: dealt ? "translateY(0)" : "translateY(-30px)",
        opacity: dealt ? 1 : 0,
        transition: "transform 300ms ease-out, opacity 300ms",
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 500ms cubic-bezier(.4,.05,.2,1)",
        }}
      >
        {/* BACK - Light Blue Patterned Card like Video */}
        <div
          className={`absolute inset-0 rounded-lg border border-cyan-200/40 shadow-md flex items-center justify-center bg-gradient-to-br from-[#3b82f6] via-[#2563eb] to-[#1d4ed8] ${
            highlight ? "ring-2 ring-yellow-300" : ""
          }`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="w-[80%] h-[82%] rounded border border-white/40 bg-white/15 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white/30" />
          </div>
        </div>

        {/* FRONT - White Card with Rank and Suit */}
        <div
          className={`absolute inset-0 rounded-lg bg-white border border-slate-300 shadow-md flex flex-col items-center justify-center leading-none p-0.5 ${
            isRed ? "text-red-600" : "text-slate-900"
          } ${highlight ? "ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]" : ""}`}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {card ? (
            <>
              <div className="text-[12px] font-black tracking-tighter">
                {card.rank}
              </div>
              <div className="text-[14px] leading-tight">
                {card.suit}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
