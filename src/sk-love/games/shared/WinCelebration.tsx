// @ts-nocheck
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface WinCelebrationProps {
  amount: number | null;   // coins won; null = no celebration
  onDone?: () => void;
  duration?: number;       // ms
}

/**
 * Full-overlay confetti + floating "+X coins" burst.
 * Set `amount` to trigger, resets after `duration`.
 */
export default function WinCelebration({
  amount,
  onDone,
  duration = 2200,
}: WinCelebrationProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (amount != null && amount > 0) {
      setShow(true);
      const t = setTimeout(() => {
        setShow(false);
        onDone?.();
      }, duration);
      return () => clearTimeout(t);
    }
  }, [amount, duration, onDone]);

  const pieces = Array.from({ length: 24 });

  return (
    <AnimatePresence>
      {show && amount != null && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* radial glow */}
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at center, rgba(250,204,21,0.35), transparent 60%)",
            }}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* confetti */}
          {pieces.map((_, i) => {
            const angle = (i / pieces.length) * Math.PI * 2;
            const dist = 140 + Math.random() * 80;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            const colors = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#eab308"];
            const bg = colors[i % colors.length];
            return (
              <motion.span
                key={i}
                className="absolute w-2 h-3 rounded-sm"
                style={{ backgroundColor: bg }}
                initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                animate={{
                  x: dx,
                  y: dy,
                  opacity: 0,
                  rotate: 360 + Math.random() * 360,
                }}
                transition={{ duration: duration / 1000, ease: "easeOut" }}
              />
            );
          })}

          {/* floating amount */}
          <motion.div
            className="relative z-10 flex flex-col items-center"
            initial={{ scale: 0.3, y: 20 }}
            animate={{ scale: 1, y: -30 }}
            exit={{ scale: 0.5, opacity: 0, y: -80 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <div className="text-6xl">🎉</div>
            <div className="mt-1 text-3xl font-black text-yellow-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              +{amount.toLocaleString()}
            </div>
            <div className="text-xs uppercase tracking-widest text-white font-bold">
              Coins Won
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
