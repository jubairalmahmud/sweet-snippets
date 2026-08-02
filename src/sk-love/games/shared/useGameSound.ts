// @ts-nocheck
import { useCallback, useRef } from "react";

type SoundKey = "click" | "chip" | "spin" | "tick" | "win" | "lose" | "flip";

/**
 * Zero-asset sound engine using Web Audio API oscillators.
 * Call `play('win')` from anywhere; safe to call in SSR (no-op).
 */
export function useGameSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = () => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const AC =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current!.state === "suspended") {
      ctxRef.current!.resume().catch(() => {});
    }
    return ctxRef.current;
  };

  const beep = useCallback(
    (freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15) => {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    },
    []
  );

  const slide = useCallback(
    (from: number, to: number, dur: number, type: OscillatorType = "sawtooth", vol = 0.1) => {
      const ctx = getCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    },
    []
  );

  const play = useCallback(
    (key: SoundKey) => {
      switch (key) {
        case "click":
          beep(600, 0.05, "square", 0.08);
          break;
        case "chip":
          beep(320, 0.06, "triangle", 0.12);
          setTimeout(() => beep(260, 0.05, "triangle", 0.09), 30);
          break;
        case "spin":
          slide(180, 900, 0.5, "sawtooth", 0.06);
          break;
        case "tick":
          beep(1200, 0.03, "square", 0.05);
          break;
        case "win":
          [523, 659, 784, 1046].forEach((f, i) =>
            setTimeout(() => beep(f, 0.18, "triangle", 0.18), i * 90)
          );
          break;
        case "lose":
          slide(400, 100, 0.4, "sawtooth", 0.12);
          break;
        case "flip":
          beep(800, 0.04, "square", 0.06);
          setTimeout(() => beep(500, 0.04, "square", 0.05), 40);
          break;
      }
    },
    [beep, slide]
  );

  return { play };
}
