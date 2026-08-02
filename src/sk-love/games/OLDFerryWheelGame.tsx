// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/sk-love/lib/api";
import {
  CircularTimer,
  ResultsHistoryBar,
  WinCelebration,
  useGameSound,
} from "./shared";
import FortuneWheel from "./ferry/FortuneWheel";

type Chip = number;

interface SlotCfg {
  id: number;
  label: string;
  multiplier: number;
  color: string;
  icon?: string;
}

interface Props {
  chips: Chip[];
  timerSeconds: number;
  slots: SlotCfg[];
  onBalance: (coins: number) => void;
  balance: number;
}

const DEFAULT_ICONS = ["🍎", "🍇", "🍊", "🍉", "🍓", "🍍", "🥭", "🍒"];

export default function FerryWheelGame({
  chips,
  timerSeconds,
  slots,
  onBalance,
  balance,
}: Props) {
  const sound = useGameSound();
  const [selectedChip, setSelectedChip] = useState<Chip>(chips[0] ?? 100);
  const [bets, setBets] = useState<Record<number, number>>({});
  const [lastBets, setLastBets] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [phase, setPhase] = useState<"betting" | "spinning" | "result">(
    "betting",
  );
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [result, setResult] = useState<{
    slot: number;
    payout: number;
    net: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { id: string; label: string; color: string }[]
  >([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalBet = useMemo(
    () => Object.values(bets).reduce((s, v) => s + v, 0),
    [bets],
  );

  useEffect(() => {
    if (phase !== "betting") return;
    tickRef.current && clearInterval(tickRef.current);
    setTimeLeft(timerSeconds);
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(tickRef.current!);
          void submit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      tickRef.current && clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timerSeconds]);

  const addBet = (slotId: number) => {
    if (phase !== "betting") return;
    if (totalBet + selectedChip > balance) {
      setError("পর্যাপ্ত coin নাই");
      return;
    }
    setError(null);
    sound.play("click");
    setBets((p) => ({ ...p, [slotId]: (p[slotId] || 0) + selectedChip }));
  };

  const clearBets = () => phase === "betting" && setBets({});
  const repeatBets = () => {
    if (phase !== "betting") return;
    const total = Object.values(lastBets).reduce((s, v) => s + v, 0);
    if (!total || total > balance) return;
    setBets({ ...lastBets });
  };

  const slotIndexById = (id: number) => slots.findIndex((s) => s.id === id);

  const submit = async () => {
    if (busy) return;
    if (totalBet <= 0) {
      setPhase("betting");
      setTimeLeft(timerSeconds);
      return;
    }
    setBusy(true);
    setPhase("spinning");
    sound.play("spin");
    try {
      const res = await api.post<{
        result: { slot: number };
        payout: number;
        net: number;
        balance: number;
      }>("/api/games/ferry/play", { bets: { slots: bets } });

      const idx = slotIndexById(res.result.slot);
      setTargetIndex(idx >= 0 ? idx : 0);

      // wait for wheel animation (~4.5s)
      setTimeout(() => {
        const cfg = slots[idx];
        setResult({ slot: res.result.slot, payout: res.payout, net: res.net });
        setHistory((h) =>
          [
            {
              id: `${Date.now()}`,
              label: cfg?.label || "?",
              color: cfg?.color || "bg-white/10",
            },
            ...h,
          ].slice(0, 10),
        );
        onBalance(res.balance);
        setLastBets(bets);
        sound.play(res.net >= 0 ? "win" : "lose");
        setPhase("result");
      }, 4500);

      setTimeout(() => {
        setBets({});
        setResult(null);
        setTargetIndex(null);
        setPhase("betting");
      }, 7500);
    } catch (e: any) {
      setError(e?.message || "Play failed");
      setPhase("betting");
      setTargetIndex(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-fuchsia-950 via-purple-900 to-black text-white overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <CircularTimer
          seconds={timerSeconds}
          remaining={timeLeft}
          size={56}
        />
        <div className="flex-1 mx-3">
          <ResultsHistoryBar items={history} />
        </div>
        <div className="text-right text-[11px] text-white/70">
          <div>Balance</div>
          <div className="text-yellow-300 font-bold text-sm">{balance}</div>
        </div>
      </div>

      {/* Wheel */}
      <div className="flex items-center justify-center py-4">
        <FortuneWheel
          slots={slots}
          spinning={phase === "spinning"}
          targetIndex={targetIndex}
          size={280}
        />
      </div>

      {/* Bet grid */}
      <div className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="grid grid-cols-4 gap-2">
          {slots.map((s, i) => {
            const isWin = result && slots[targetIndex ?? -1]?.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => addBet(s.id)}
                disabled={phase !== "betting"}
                className={`relative h-16 rounded-xl flex flex-col items-center justify-center font-bold transition ${
                  s.color?.startsWith("bg-") ? s.color : "bg-white/10"
                } ${
                  isWin
                    ? "ring-4 ring-yellow-300 scale-105"
                    : "ring-2 ring-white/10"
                } active:scale-95 disabled:opacity-70`}
              >
                <div className="text-xl leading-none">
                  {s.icon || DEFAULT_ICONS[i % DEFAULT_ICONS.length]}
                </div>
                <div className="text-[10px] text-yellow-200">
                  x{s.multiplier}
                </div>
                {bets[s.id] ? (
                  <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-bold rounded-full px-1.5 py-0.5">
                    {bets[s.id]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {error && (
          <div className="mt-3 text-center text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md py-2">
            {error}
          </div>
        )}
      </div>

      {/* Bottom chips */}
      <div className="border-t border-white/10 bg-black/40 px-3 py-3">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-white/70">
            বেট:{" "}
            <span className="text-yellow-300 font-bold">{totalBet}</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={repeatBets}
              disabled={phase !== "betting" || !Object.keys(lastBets).length}
              className="px-3 py-1 rounded-md bg-white/10 border border-white/20 disabled:opacity-40"
            >
              Repeat
            </button>
            <button
              onClick={clearBets}
              disabled={phase !== "betting" || !totalBet}
              className="px-3 py-1 rounded-md bg-white/10 border border-white/20 disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {chips.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedChip(c)}
              className={`shrink-0 w-14 h-14 rounded-full font-bold text-sm border-4 transition ${
                selectedChip === c
                  ? "border-yellow-300 bg-yellow-500 text-black scale-110"
                  : "border-white/20 bg-neutral-800 text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Win celebration */}
      {result && result.net > 0 && (
        <WinCelebration amount={result.net} />
      )}
    </div>
  );
}
