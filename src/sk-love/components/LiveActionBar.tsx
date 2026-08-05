// @ts-nocheck
/* ============================================================================
 *  LiveActionBar.tsx — 7-Button Bottom Action Bar for Live Stream.
 * ----------------------------------------------------------------------------
 *  Exact Button Order requested:
 *    1. 💬 Comment (কমেন্ট)
 *    2. 🎁 Gift (গিফট)
 *    3. 👍 Emoji / React (ইমোজি)
 *    4. 🎮 Game (গেম) — [EXACT CENTER / 4th of 7]
 *    5. 🍔 Hamburger / Menu (হ্যামবার্গার)
 *    6. 🎙️ Microphone / Sound (মাইক্রোফোন)
 *    7. 📞 Call / Co-host / Seat (কল বাটন)
 * ==========================================================================*/

import React, { useState } from "react";
import { MessageSquare, Gift, Smile, Gamepad2, Menu, Sofa, Phone } from "lucide-react";
import commentImg from "../assets/stream-icons/comment.png";
import giftImg from "../assets/stream-icons/gift.png";
import reactImg from "../assets/stream-icons/react.png";
import gameImg from "../assets/stream-icons/game.png";
import menuImg from "../assets/stream-icons/menu.png";
import seatImg from "../assets/stream-icons/seat.png";
import phoneImg from "../assets/stream-icons/phone.png";

type SafeStreamIconProps = {
  src: string;
  alt: string;
  fallbackIcon: React.ElementType;
  fallbackColor: string;
  className?: string;
  glowColor?: string;
};

function getCanonicalIconFileName(alt: string): string {
  const lower = alt.toLowerCase();
  if (lower.includes("comment")) return "comment";
  if (lower.includes("gift")) return "gift";
  if (lower.includes("react") || lower.includes("emoji") || lower.includes("smile")) return "react";
  if (lower.includes("game")) return "game";
  if (lower.includes("menu") || lower.includes("hamburger")) return "menu";
  if (lower.includes("seat") || lower.includes("sofa")) return "seat";
  if (lower.includes("call") || lower.includes("phone") || lower.includes("co-host") || lower.includes("cohost")) return "phone";
  return lower.replace(/[^a-z]/g, "") || "comment";
}

export function SafeStreamIcon({
  src,
  alt,
  fallbackIcon: FallbackIcon,
  fallbackColor,
  className = "h-12 w-12 object-contain filter drop-shadow-[0_0_6px_rgba(0,0,0,0.35)]",
  glowColor = "rgba(236,72,153,0.6)",
}: SafeStreamIconProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900/90 border border-white/20 shadow-lg ${fallbackColor}`}
        style={{ boxShadow: `0 0 12px ${glowColor}` }}
      >
        <FallbackIcon className="h-5.5 w-5.5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={(e) => {
        const target = e.currentTarget;
        const iconName = getCanonicalIconFileName(alt);
        const step = parseInt(target.dataset.tried || "0", 10);
        if (step === 0) {
          target.dataset.tried = "1";
          target.src = `/stream-icons/${iconName}.png`;
        } else if (step === 1) {
          target.dataset.tried = "2";
          target.src = `stream-icons/${iconName}.png`;
        } else if (step === 2) {
          target.dataset.tried = "3";
          target.src = `./stream-icons/${iconName}.png`;
        } else if (step === 3) {
          target.dataset.tried = "4";
          target.src = `assets/stream-icons/${iconName}.png`;
        } else {
          setHasError(true);
        }
      }}
      className={className}
    />
  );
}

export type LiveActionBarProps = {
  /** 1. Comment button handler */
  onComment: () => void;

  /** 2. Gift button handler */
  onGift: () => void;
  giftLabel?: string;

  /** 3. Emoji / React picker options */
  reactions: readonly string[];
  isReactionPickerOpen: boolean;
  onToggleReactionPicker: () => void;
  onReact: (emoji: string) => void;

  /** 4. Game button handler (CENTER) */
  onGame: () => void;

  /** 5. Hamburger / Menu handler & popup */
  onMenuToggle: () => void;
  isMenuOpen: boolean;
  menuPopup?: React.ReactNode;

  /** 6. Microphone / Speaker button element */
  micElement?: React.ReactNode;

  /** 7. Call / Seat button element or seat props */
  callElement?: React.ReactNode;
  showSeat?: boolean;
  seatActive?: boolean;
  seatPending?: boolean;
  onSeat?: () => void;
};

export default function LiveActionBar({
  onComment,
  onGift,
  giftLabel = "Send gift",
  reactions,
  isReactionPickerOpen,
  onToggleReactionPicker,
  onReact,
  onGame,
  onMenuToggle,
  isMenuOpen,
  menuPopup,
  micElement,
  callElement,
  showSeat,
  seatActive,
  seatPending,
  onSeat,
}: LiveActionBarProps) {
  // Collect all active action buttons into an array so every button gets an equal flex slot
  const actionItems: { key: string; content: React.ReactNode }[] = [
    {
      key: "comment",
      content: (
        <button
          type="button"
          onClick={onComment}
          className="group relative flex h-12 w-12 shrink-0 items-center justify-center transition-all duration-200 active:scale-90 hover:scale-110 focus:outline-none cursor-pointer"
          aria-label="Comment"
          title="Comment"
        >
          <SafeStreamIcon
            src={commentImg}
            alt="Comment"
            fallbackIcon={MessageSquare}
            fallbackColor="text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-400/40"
            glowColor="rgba(232,121,249,0.8)"
            className="h-12 w-12 object-contain filter drop-shadow-[0_0_6px_rgba(0,0,0,0.35)] transition-all duration-200 group-hover:drop-shadow-[0_0_12px_rgba(232,121,249,0.8)]"
          />
        </button>
      ),
    },
    {
      key: "gift",
      content: (
        <button
          type="button"
          onClick={onGift}
          className="group relative flex h-12 w-12 shrink-0 items-center justify-center transition-all duration-200 active:scale-90 hover:scale-110 focus:outline-none cursor-pointer"
          aria-label={giftLabel}
          title={giftLabel}
        >
          <SafeStreamIcon
            src={giftImg}
            alt="Gift"
            fallbackIcon={Gift}
            fallbackColor="text-rose-400 bg-rose-500/10 border-rose-400/40"
            glowColor="rgba(244,63,94,0.6)"
            className="h-12 w-12 object-contain filter drop-shadow-[0_0_6px_rgba(0,0,0,0.35)] transition-all duration-200 group-hover:drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]"
          />
        </button>
      ),
    },
    {
      key: "react",
      content: (
        <div className="relative flex items-center justify-center">
          {isReactionPickerOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 z-[70] mb-2 grid grid-cols-7 gap-1.5 rounded-2xl border border-white/20 bg-slate-950/95 p-2.5 shadow-2xl backdrop-blur-md w-max max-w-[280px] sm:max-w-[320px]">
              {reactions.map((emoji) => (
                <button
                  key={`live-reaction-${emoji}`}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 hover:bg-white/20 text-xl leading-none transition hover:scale-125 active:scale-90 cursor-pointer"
                  aria-label={`React ${emoji}`}
                  title={`React ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onToggleReactionPicker}
            className="group relative flex h-12 w-12 shrink-0 items-center justify-center transition-all duration-200 active:scale-90 hover:scale-110 focus:outline-none cursor-pointer"
            aria-label="React"
            title="React"
          >
            <SafeStreamIcon
              src={reactImg}
              alt="React"
              fallbackIcon={Smile}
              fallbackColor="text-emerald-400 bg-emerald-500/10 border-emerald-400/40"
              glowColor="rgba(52,211,153,0.6)"
              className="h-12 w-12 object-contain filter drop-shadow-[0_0_6px_rgba(0,0,0,0.35)] transition-all duration-200 group-hover:drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]"
            />
          </button>
        </div>
      ),
    },
    {
      key: "game",
      content: (
        <button
          type="button"
          onClick={onGame}
          className="group relative flex h-12 w-12 shrink-0 items-center justify-center transition-all duration-200 active:scale-90 hover:scale-110 focus:outline-none cursor-pointer"
          aria-label="PK Battle & Games"
          title="PK Battle & Games"
        >
          <SafeStreamIcon
            src={gameImg}
            alt="Game"
            fallbackIcon={Gamepad2}
            fallbackColor="text-violet-400 bg-violet-500/10 border-violet-400/40"
            glowColor="rgba(167,139,250,0.6)"
            className="h-12 w-12 object-contain filter drop-shadow-[0_0_6px_rgba(0,0,0,0.35)] transition-all duration-200 group-hover:drop-shadow-[0_0_12px_rgba(167,139,250,0.8)]"
          />
        </button>
      ),
    },
    {
      key: "menu",
      content: (
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={onMenuToggle}
            className="flex h-12 w-12 shrink-0 items-center justify-center transition-transform active:scale-90 hover:scale-110 focus:outline-none cursor-pointer"
            aria-label="Open menu"
            title="Menu"
          >
            <SafeStreamIcon
              src={menuImg}
              alt="Menu"
              fallbackIcon={Menu}
              fallbackColor="text-amber-400 bg-amber-500/10 border-amber-400/40"
              glowColor="rgba(251,191,36,0.8)"
              className="h-12 w-12 object-contain filter drop-shadow-[0_0_6px_rgba(0,0,0,0.35)]"
            />
          </button>
          {isMenuOpen && menuPopup}
        </div>
      ),
    },
  ];

  if (micElement) {
    actionItems.push({
      key: "mic",
      content: (
        <div className="flex shrink-0 items-center justify-center">
          {micElement}
        </div>
      ),
    });
  }

  if (callElement) {
    actionItems.push({
      key: "call",
      content: (
        <div className="flex shrink-0 items-center justify-center">
          {callElement}
        </div>
      ),
    });
  } else if (showSeat) {
    actionItems.push({
      key: "seat",
      content: (
        <button
          type="button"
          onClick={onSeat}
          className={`group relative flex h-12 w-12 shrink-0 items-center justify-center transition-all duration-200 active:scale-90 hover:scale-110 focus:outline-none cursor-pointer ${
            seatActive
              ? "rounded-full bg-gradient-to-br from-rose-500/30 to-red-600/30 ring-2 ring-rose-400/80 shadow-[0_0_16px_rgba(244,63,94,0.8)]"
              : seatPending
              ? "rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-600/30 ring-2 ring-emerald-400/80 shadow-[0_0_16px_rgba(52,211,153,0.8)] animate-pulse"
              : ""
          }`}
          aria-label={
            seatActive
              ? "Leave Stage / End Call"
              : seatPending
              ? "Co-host Request Pending (Green Call)"
              : "Cohost Seat"
          }
          title={
            seatActive
              ? "Leave Stage (End Call)"
              : seatPending
              ? "Co-host Request Pending (Green Call)"
              : "Cohost Seat"
          }
        >
          {seatActive ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_0_14px_rgba(244,63,94,0.85)] ring-2 ring-rose-400/60">
              <Phone className="h-5.5 w-5.5" strokeWidth={2.4} />
            </div>
          ) : seatPending ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_0_14px_rgba(52,211,153,0.85)] ring-2 ring-emerald-300/60 animate-pulse">
              <Phone className="h-5.5 w-5.5" strokeWidth={2.4} />
            </div>
          ) : (
            <SafeStreamIcon
              src={seatImg}
              alt="Seat"
              fallbackIcon={Sofa}
              fallbackColor="text-indigo-400 bg-indigo-500/10 border-indigo-400/40"
              glowColor="rgba(99,102,241,0.8)"
              className="h-12 w-12 object-contain filter drop-shadow-[0_0_6px_rgba(0,0,0,0.35)] transition-all duration-200 group-hover:drop-shadow-[0_0_12px_rgba(99,102,241,0.8)]"
            />
          )}
        </button>
      ),
    });
  }

  return (
    <div className="relative flex items-center justify-between w-full max-w-lg mx-auto shrink-0 z-40 select-none pointer-events-auto pb-1">
      {actionItems.map((item) => (
        <div key={item.key} className="flex flex-1 items-center justify-center">
          {item.content}
        </div>
      ))}
    </div>
  );
}
