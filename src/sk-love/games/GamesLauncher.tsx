// @ts-nocheck
import { Component, type ErrorInfo, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import { api } from "@/sk-love/lib/api";
import CasinoGame from "./CasinoGame";
import FerryWheelGame from "./FerryWheelGame";
import TeenPattiGame from "./TeenPattiGame";

/**
 * FitToViewport — measures its child's natural size and scales it down so it
 * always fits inside the parent box on any phone. Never scales up beyond 1.
 */
function FitToViewport({ baseWidth = 380, children }: { baseWidth?: number; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState<number>(0);

  useLayoutEffect(() => {
    const compute = () => {
      const c = containerRef.current;
      const i = innerRef.current;
      if (!c || !i) return;
      const cw = c.clientWidth;
      const ch = c.clientHeight;
      const iw = baseWidth;
      const ih = i.scrollHeight || i.offsetHeight || 1;
      const s = Math.min(1, cw / iw, ch > 0 ? ch / ih : 1);
      setScale(s > 0 ? s : 1);
      setInnerH(ih);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [baseWidth]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden flex justify-center">
      <div
        style={{
          width: baseWidth,
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          height: innerH ? innerH * scale : undefined,
        }}
      >
        <div ref={innerRef} style={{ width: baseWidth }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export type GameKey = "casino" | "ferry" | "teenpatti";

export type GameConfig = {
  casino: { chips: number[]; timer_seconds: number };
  ferry: { chips: number[]; timer_seconds: number; slots: { key: string; label: string; multiplier: number }[] };
  teenpatti: { chips: number[]; timer_seconds: number; hands: string[] };
};

const DEFAULT_CONFIG: GameConfig = {
  casino: { chips: [1000, 5000, 10000, 50000, 100000], timer_seconds: 10 },
  ferry: {
    chips: [1000, 5000, 10000, 50000, 100000],
    timer_seconds: 20,
    slots: [
      { key: "strawberry", label: "🍓", multiplier: 5, icon: "🍓", color: "#ef4444" } as any,
      { key: "chicken", label: "🍗", multiplier: 45, icon: "🍗", color: "#f59e0b" } as any,
      { key: "octopus", label: "🐙", multiplier: 25, icon: "🐙", color: "#ec4899" } as any,
      { key: "fish", label: "🐟", multiplier: 15, icon: "🐟", color: "#0ea5e9" } as any,
      { key: "meat", label: "🥩", multiplier: 10, icon: "🥩", color: "#dc2626" } as any,
      { key: "grape", label: "🍇", multiplier: 5, icon: "🍇", color: "#a855f7" } as any,
      { key: "cabbage", label: "🥬", multiplier: 5, icon: "🥬", color: "#22c55e" } as any,
      { key: "corn", label: "🌽", multiplier: 5, icon: "🌽", color: "#eab308" } as any,
    ],
  },
  teenpatti: { chips: [1000, 5000, 10000, 50000, 100000], timer_seconds: 20, hands: ["A", "B", "C"] },
};

const toArray = <T,>(value: unknown, fallback: T[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      const parts = value.split(",").map((item) => item.trim()).filter(Boolean);
      if (parts.length) return parts as T[];
    }
  }
  return fallback;
};

const toNumberArray = (value: unknown, fallback: number[]) => {
  const arr = toArray<unknown>(value, fallback);
  const numbers = arr.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
  return numbers.length ? numbers : fallback;
};

const toPositiveNumber = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const normalizeConfig = (raw: any): GameConfig => {
  const root = raw?.data || raw?.config || raw || {};
  const casino = root.casino || root.roulette || {};
  const ferry = root.ferry || root.ferry_wheel || root.food_wheel || {};
  const teenpatti = root.teenpatti || root.teen_patti || {};

  return {
    casino: {
      chips: toNumberArray(casino.chips, DEFAULT_CONFIG.casino.chips),
      timer_seconds: toPositiveNumber(casino.timer_seconds ?? casino.timerSeconds, DEFAULT_CONFIG.casino.timer_seconds),
    },
    ferry: {
      chips: toNumberArray(ferry.chips, DEFAULT_CONFIG.ferry.chips),
      timer_seconds: toPositiveNumber(ferry.timer_seconds ?? ferry.timerSeconds, DEFAULT_CONFIG.ferry.timer_seconds),
      slots: toArray<any>(ferry.slots, DEFAULT_CONFIG.ferry.slots).map((slot, index) => ({
        key: String(slot?.key ?? slot?.id ?? index),
        label: String(slot?.label ?? slot?.name ?? slot?.key ?? `Slot ${index + 1}`),
        multiplier: toPositiveNumber(slot?.multiplier ?? slot?.x, DEFAULT_CONFIG.ferry.slots[index]?.multiplier ?? 5),
        color: slot?.color,
        icon: slot?.icon,
      })),
    },
    teenpatti: {
      chips: toNumberArray(teenpatti.chips, DEFAULT_CONFIG.teenpatti.chips),
      timer_seconds: toPositiveNumber(teenpatti.timer_seconds ?? teenpatti.timerSeconds, DEFAULT_CONFIG.teenpatti.timer_seconds),
      hands: toArray<string>(teenpatti.hands, DEFAULT_CONFIG.teenpatti.hands),
    },
  };
};

const safeBalance = (raw: any) =>
  Number(raw?.coins ?? raw?.r_coins ?? raw?.balance ?? raw?.data?.coins ?? raw?.data?.r_coins ?? raw?.data?.balance ?? 0);

class GameCrashBoundary extends Component<
  { gameKey: GameKey | null; onBack: () => void; children: ReactNode },
  { crashed: boolean; message: string }
> {
  state = { crashed: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { crashed: true, message: error?.message || "Game could not open" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SK Games render failed", { gameKey: this.props.gameKey, error, info });
  }

  componentDidUpdate(prevProps: { gameKey: GameKey | null }) {
    if (prevProps.gameKey !== this.props.gameKey && this.state.crashed) {
      this.setState({ crashed: false, message: "" });
    }
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="p-5 text-center text-white bg-neutral-950 min-h-full flex flex-col items-center justify-center gap-3">
          <div className="text-4xl">⚠️</div>
          <div className="text-sm font-bold">গেম ওপেন করা যায়নি</div>
          <div className="text-xs text-white/55 break-words max-w-xs">{this.state.message}</div>
          <button onClick={this.props.onBack} className="mt-2 px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-bold">
            Back to Games
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Optional: pre-select a game when opening */
  initialGame?: GameKey | null;
  /** When true (e.g. inside Party Room), open at ~70% screen instead of full-screen */
  compact?: boolean;
};

const GAMES: { key: GameKey; title: string; emoji: string; tagline: string; gradient: string }[] = [
  { key: "casino", title: "Casino", emoji: "🎰", tagline: "Roulette 0-36", gradient: "from-red-500 via-rose-600 to-red-700" },
  { key: "ferry", title: "Ferry Wheel", emoji: "🎡", tagline: "x5 → x45", gradient: "from-amber-400 via-orange-500 to-pink-600" },
  { key: "teenpatti", title: "Teen Patti", emoji: "🃏", tagline: "3 Hand Battle", gradient: "from-emerald-500 via-teal-600 to-cyan-700" },
];

export function GamesLauncher({ open, onClose, initialGame = null, compact = false }: Props) {
  const [selected, setSelected] = useState<GameKey | null>(initialGame);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedConfig = useMemo(() => normalizeConfig(config), [config]);

  const loadBalance = useCallback(async () => {
    try {
      const res = await api.get<{ coins: number }>("/api/games/balance");
      setBalance(safeBalance(res));
    } catch (e: any) {
      setError(e?.message || "Balance load failed");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(initialGame);
    setError(null);
    setLoading(true);
    Promise.all([
      api.get<GameConfig>("/api/games/config", { auth: false }).then((res) => setConfig(normalizeConfig(res))),
      loadBalance(),
    ])
      .catch((e: any) => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, initialGame, loadBalance]);

  if (!open) return null;

  const activeGame = selected;

  // Compact = opened from Party Room → 70% viewport sheet; Full = 100% full screen
  const shellSize = compact
    ? "max-w-md h-[70vh] max-h-[70vh] rounded-t-2xl rounded-b-none border border-white/10"
    : "w-full h-full max-w-full h-screen max-h-screen rounded-none border-none";

  return (
    <div className={
      compact
        ? "fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 backdrop-blur-[2px] p-0 sk-preserve-dark"
        : "fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-md p-0 sk-preserve-dark"
    } onClick={onClose}>
      <div className={`relative w-full ${shellSize} overflow-hidden bg-neutral-950 shadow-2xl flex flex-col`} onClick={(e) => e.stopPropagation()}>


        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600">
          <div className="flex items-center gap-1.5 min-w-0">
            {activeGame && (
              <button
                onClick={() => setSelected(null)}
                className="text-white/90 hover:text-white text-base leading-none px-1.5"
                aria-label="Back"
              >
                ←
              </button>
            )}
            <div className="text-white font-bold text-sm truncate">
              {activeGame ? GAMES.find((g) => g.key === activeGame)?.title : "🎮 Games"}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="px-2 py-0.5 rounded-full bg-black/30 text-white text-[11px] font-semibold flex items-center gap-1">
              <span>🪙</span>
              <span>{balance == null ? "…" : balance.toLocaleString()}</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 text-white text-base flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={`flex-1 ${activeGame ? "overflow-hidden relative" : "overflow-y-auto"}`}>
          {error && (
            <div className="m-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-xs">
              {error}
            </div>
          )}

          {loading && !config && (
            <div className="flex items-center justify-center h-40 text-white/60 text-sm">Loading…</div>
          )}

          {!activeGame && config && (
            <div className="p-3 grid gap-2.5">
              {GAMES.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setSelected(g.key)}
                  className={`group relative overflow-hidden rounded-2xl p-3 text-left bg-gradient-to-br ${g.gradient} shadow-lg hover:scale-[1.02] active:scale-[0.99] transition`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-11 h-11 rounded-xl bg-black/25 flex items-center justify-center text-2xl shrink-0">
                      {g.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-base truncate">{g.title}</div>
                      <div className="text-white/85 text-[11px] truncate">{g.tagline}</div>
                    </div>
                    <div className="text-white/90 text-xl shrink-0">›</div>
                  </div>
                </button>
              ))}
              <div className="text-center text-white/40 text-[11px] mt-2">
                Bet coins, win coins. Provably fair.
              </div>
            </div>
          )}

          {activeGame === "casino" && config && (
            <GameCrashBoundary gameKey={activeGame} onBack={() => setSelected(null)}>
              <FitToViewport>
                <CasinoGame
                  chips={normalizedConfig.casino.chips}
                  timerSeconds={normalizedConfig.casino.timer_seconds}
                  balance={balance ?? 0}
                  onBalance={setBalance}
                />
              </FitToViewport>
            </GameCrashBoundary>
          )}
          {activeGame === "ferry" && config && (
            <GameCrashBoundary gameKey={activeGame} onBack={() => setSelected(null)}>
              <FitToViewport>
                <FerryWheelGame
                  chips={normalizedConfig.ferry.chips}
                  timerSeconds={normalizedConfig.ferry.timer_seconds}
                  slots={normalizedConfig.ferry.slots.map((s: any, i: number) => ({
                    id: i,
                    label: s.label ?? s.key ?? String(i),
                    multiplier: Number(s.multiplier ?? 0),
                    color: s.color ?? "bg-pink-500",
                    icon: s.icon,
                  }))}
                  balance={balance ?? 0}
                  onBalance={setBalance}
                />
              </FitToViewport>
            </GameCrashBoundary>
          )}
          {activeGame === "teenpatti" && config && (
            <GameCrashBoundary gameKey={activeGame} onBack={() => setSelected(null)}>
              <FitToViewport>
                <TeenPattiGame
                  chips={normalizedConfig.teenpatti.chips}
                  timerSeconds={normalizedConfig.teenpatti.timer_seconds}
                  balance={balance ?? 0}
                  onBalance={setBalance}
                />
              </FitToViewport>
            </GameCrashBoundary>
          )}
        </div>
      </div>
    </div>
  );
}

export default GamesLauncher;
