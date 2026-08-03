// @ts-nocheck
import React from "react";

export interface RoyalGiftBannerProps {
  giverName: string;
  giverAvatar?: string;
  giverBadge?: string; // e.g., "Agency Holder" or "VIP 5"
  iconEmoji?: string; // e.g., "🍷" or "🎁"
  tagLetter?: string; // e.g., "B"
  mainActionText?: string; // e.g., "WON" or "SENT"
  amountText?: string; // e.g., "50,000"
  secondaryText?: string; // e.g., "FROM" or "GIFTS TO"
  giftName?: string; // e.g., "GREEDY KING" or "Ferrari"
  giftIcon?: string; // e.g., emoji or icon string
  giftImage?: string; // image URL
  className?: string;
}

export default function RoyalGiftBanner({
  giverName = "Player",
  giverAvatar,
  giverBadge = "Agency Holder",
  iconEmoji = "🍷",
  tagLetter,
  mainActionText = "WON",
  amountText = "50,000",
  secondaryText = "FROM",
  giftName = "GREEDY KING",
  giftIcon = "🎰",
  giftImage,
  className = "",
}: RoyalGiftBannerProps) {
  const initialLetter = tagLetter || (giverName ? giverName.trim().charAt(0).toUpperCase() : "B");
  const displayName = giverName || "Player";

  return (
    <div
      className={`relative w-full max-w-[480px] mx-auto select-none overflow-visible ${className}`}
      style={{ height: "100px", filter: "drop-shadow(0 10px 25px rgba(0, 0, 0, 0.75))" }}
    >
      {/* ── Vector SVG Royal Banner Frame Background ── */}
      <svg
        viewBox="0 0 520 110"
        className="absolute inset-0 h-full w-full pointer-events-none overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Metallic Gold Primary Gradient */}
          <linearGradient id="royalGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="20%" stopColor="#fef08a" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="75%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Light Gold Highlight Gradient */}
          <linearGradient id="royalGoldHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#fef08a" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Dark Purple Crystal Gem Background */}
          <linearGradient id="purpleGemBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2d0059" />
            <stop offset="35%" stopColor="#1a0038" />
            <stop offset="70%" stopColor="#310063" />
            <stop offset="100%" stopColor="#160030" />
          </linearGradient>

          {/* Top Crown Purple Diamond Gradient */}
          <radialGradient id="topGemRadial" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f5d0fe" />
            <stop offset="35%" stopColor="#e879f9" />
            <stop offset="70%" stopColor="#c026d3" />
            <stop offset="100%" stopColor="#581c87" />
          </radialGradient>

          {/* White Feather Highlight Gradient */}
          <linearGradient id="whiteFeatherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#e0f2fe" />
            <stop offset="100%" stopColor="#bae6fd" />
          </linearGradient>

          {/* Purple Ribbon Gradient */}
          <linearGradient id="purpleRibbonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6b21a8" />
          </linearGradient>

          {/* Drop Glow Filter */}
          <filter id="royalGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* ── 1. MAIN CENTER PURPLE BANNER BOX ── */}
        <path
          d="M 92,26 L 435,26 L 452,42 L 438,78 L 415,82 L 105,82 L 80,62 Z"
          fill="url(#purpleGemBg)"
          stroke="url(#royalGoldGrad)"
          strokeWidth="4"
        />

        {/* Inner Gold Bezel line */}
        <path
          d="M 96,29 L 431,29 L 446,43 L 434,75 L 412,79 L 108,79 L 85,60 Z"
          fill="none"
          stroke="#fde047"
          strokeWidth="1.2"
          strokeOpacity="0.75"
        />

        {/* Crystal Facet Highlights on Center Banner */}
        <path
          d="M 120,29 L 180,79 M 240,29 L 300,79 M 360,29 L 420,79"
          stroke="#a855f7"
          strokeWidth="1"
          strokeOpacity="0.25"
        />

        {/* ── 2. RIGHT SIDE GOLDEN WINGS & ACCENTS ── */}
        {/* Upper Right Wing (White/Sky Blue Feathers + Gold Trim) */}
        <path
          d="M 430,22 Q 460,8 495,12 Q 510,25 490,48 Q 465,58 438,42 Z"
          fill="url(#whiteFeatherGrad)"
          stroke="url(#royalGoldGrad)"
          strokeWidth="2.5"
        />
        <path
          d="M 435,24 Q 465,14 492,18 Q 502,28 485,45 Z"
          fill="none"
          stroke="url(#royalGoldHighlight)"
          strokeWidth="1.5"
        />

        {/* Lower Right Wing Feathers */}
        <path
          d="M 425,58 Q 460,56 498,68 Q 512,85 482,98 Q 450,105 422,82 Z"
          fill="url(#royalGoldGrad)"
          stroke="#78350f"
          strokeWidth="2"
        />
        <path
          d="M 432,62 Q 462,60 492,72 Q 502,82 480,92 Z"
          fill="url(#whiteFeatherGrad)"
        />

        {/* Purple Tail Ribbon Accents on Right */}
        <path
          d="M 465,72 L 500,88 L 492,102 L 460,85 Z"
          fill="url(#purpleRibbonGrad)"
          stroke="url(#royalGoldGrad)"
          strokeWidth="1.5"
        />
        <path
          d="M 478,78 L 512,94 L 505,106 L 472,90 Z"
          fill="url(#purpleRibbonGrad)"
          stroke="url(#royalGoldGrad)"
          strokeWidth="1.5"
        />

        {/* ── 3. TOP CENTER CROWN & PURPLE GEMSTONE ── */}
        {/* Top Gold Arch / Wings Spreading Left & Right */}
        <path
          d="M 120,28 Q 180,12 250,8 Q 320,12 380,28 Q 320,20 250,18 Q 180,20 120,28 Z"
          fill="url(#royalGoldGrad)"
          stroke="#78350f"
          strokeWidth="1.5"
        />
        {/* Top Gold Crown Pedestal */}
        <path
          d="M 225,18 L 240,4 L 250,0 L 260,4 L 275,18 L 250,22 Z"
          fill="url(#royalGoldHighlight)"
          stroke="#78350f"
          strokeWidth="2"
        />
        {/* Center Glowing Purple Diamond Gem */}
        <polygon
          points="250,2 262,12 250,24 238,12"
          fill="url(#topGemRadial)"
          stroke="#fef08a"
          strokeWidth="2"
          filter="url(#royalGlow)"
        />
        <polygon
          points="250,5 258,12 250,19 242,12"
          fill="#f472b6"
          opacity="0.6"
        />

        {/* ── 4. BOTTOM CENTER WING EMBLEM ── */}
        <path
          d="M 180,78 Q 215,76 250,95 Q 285,76 320,78 Q 280,98 250,105 Q 220,98 180,78 Z"
          fill="url(#royalGoldGrad)"
          stroke="#78350f"
          strokeWidth="2"
        />
        <path
          d="M 195,80 Q 222,80 250,92 Q 278,80 305,80 Q 278,92 250,98 Q 222,92 195,80 Z"
          fill="url(#purpleRibbonGrad)"
          stroke="url(#royalGoldHighlight)"
          strokeWidth="1.2"
        />

        {/* ── 5. LEFT SIDE ORNATE GOLD AVATAR CREST / FRAME ── */}
        {/* Outer Laurel Wreath / Wings Around Avatar Ring */}
        <path
          d="M 15,32 Q 5,55 18,85 Q 38,105 60,95 Q 85,82 78,50 Q 72,25 45,15 Q 28,15 15,32 Z"
          fill="url(#royalGoldGrad)"
          stroke="#78350f"
          strokeWidth="2.5"
        />

        {/* Left & Right Swords / Wing Feathers On Avatar Frame */}
        <path d="M 8,20 L 22,35 L 14,48 L 4,32 Z" fill="url(#whiteFeatherGrad)" stroke="url(#royalGoldGrad)" strokeWidth="1" />
        <path d="M 85,20 L 72,35 L 80,48 L 90,32 Z" fill="url(#whiteFeatherGrad)" stroke="url(#royalGoldGrad)" strokeWidth="1" />

        {/* Top Gold Mini Crown on Avatar Ring */}
        <path d="M 40,16 L 48,6 L 53,12 L 58,6 L 66,16 Z" fill="url(#royalGoldHighlight)" stroke="#78350f" strokeWidth="1.5" />

        {/* Gold Outer Circle Rim for Avatar */}
        <circle cx="53" cy="52" r="38" fill="url(#royalGoldGrad)" stroke="#78350f" strokeWidth="2.5" />
        {/* Inner Gold Bezel */}
        <circle cx="53" cy="52" r="33.5" fill="#180030" stroke="url(#royalGoldHighlight)" strokeWidth="2" />
        {/* Dark Avatar Spot */}
        <circle cx="53" cy="52" r="29.5" fill="#0d001e" />

        {/* Gold Title Plate Banner below Avatar Ring */}
        <path
          d="M 24,84 L 82,84 L 78,96 L 28,96 Z"
          fill="url(#royalGoldGrad)"
          stroke="#78350f"
          strokeWidth="1.5"
        />
        <path
          d="M 26,86 L 80,86 L 76,94 L 30,94 Z"
          fill="#451a03"
        />
      </svg>

      {/* ── HTML CONTENT OVERLAY ── */}
      <div className="relative z-10 flex h-full w-full items-center justify-between pl-[14px] pr-[38px] pt-[2px]">
        {/* ── Left Avatar Container ── */}
        <div className="relative shrink-0 flex flex-col items-center justify-center" style={{ width: "80px", height: "80px" }}>
          {/* Avatar Image */}
          <div className="relative flex items-center justify-center overflow-hidden rounded-full border-2 border-amber-300/80 shadow-[0_0_12px_rgba(245,158,11,0.8)]" style={{ width: "57px", height: "57px", marginTop: "-2px" }}>
            {giverAvatar ? (
              <img src={giverAvatar} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-800 to-purple-950 font-black text-amber-200 text-lg">
                {initialLetter}
              </div>
            )}
          </div>

          {/* Giver Tag / Rank Label Badge below Avatar */}
          <div className="absolute -bottom-1 z-20 flex items-center justify-center px-1">
            <span className="truncate max-w-[68px] text-[8px] font-black uppercase tracking-tight text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
              {giverBadge}
            </span>
          </div>
        </div>

        {/* ── Center Banner Text Layout ── */}
        <div className="flex-1 min-w-0 px-2 flex items-center justify-center gap-1.5 text-center">
          {/* Optional Icon (e.g., 🍷 or 🎁) */}
          {iconEmoji && (
            <span className="text-xl shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {iconEmoji}
            </span>
          )}

          {/* Initial Tag Badge (Red square badge with white letter) */}
          <div className="shrink-0 flex items-center justify-center bg-red-600 border border-amber-200 rounded px-1.5 py-0.5 text-white font-black text-[12px] leading-none shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
            {initialLetter}
          </div>

          <span className="text-white font-black text-[12px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">...</span>

          {/* Main Statement Text: e.g., "WON 50,000 FROM" or "SENT 10,000 GIFTS TO" */}
          <div className="flex items-center gap-1 min-w-0 truncate">
            <span className="font-black text-white text-[13px] tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
              {mainActionText}
            </span>
            <span className="font-black text-amber-300 text-[14px] tracking-tight drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]">
              {amountText}
            </span>
            {secondaryText && (
              <span className="font-black text-white text-[12px] tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                {secondaryText}
              </span>
            )}
          </div>
        </div>

        {/* ── Right Gift Card Box ── */}
        <div className="relative shrink-0 ml-1 flex flex-col items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 p-[2px] shadow-[0_0_12px_rgba(245,158,11,0.6)]">
            <div className="flex h-full w-full flex-col items-center justify-center rounded-[10px] bg-slate-950 p-0.5 text-center">
              {giftImage ? (
                <img src={giftImage} alt={giftName} className="h-full w-full object-cover rounded-md" />
              ) : (
                <span className="text-xl">{giftIcon || "🎁"}</span>
              )}
            </div>
          </div>
          {giftName && (
            <span className="absolute -bottom-2 whitespace-nowrap rounded bg-gradient-to-r from-amber-600 to-amber-800 px-1.5 py-[1px] text-[7.5px] font-black uppercase tracking-wider text-amber-100 border border-amber-300 shadow-md">
              {giftName.slice(0, 11)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
