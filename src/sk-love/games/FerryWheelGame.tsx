// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { ResultsHistoryBar, WinCelebration, useGameSound, ChipStack, CircularTimer } from "./shared";
import FortuneWheel from "./ferry/FortuneWheel";
import { emitGameWin } from "../components/TopGameWinnerBanner";

const ROUND_SECONDS = 10;

type Slot = { label: string; multiplier: number; color?: string; icon?: string };
type Props = {
  chips?: number[];
  slots?: Slot[];
  timerSeconds?: number;
  balance?: number;
  onBalance?: (balance: number) => void;
  onBalanceChange?: (balance: number) => void;
  onClose?: () => void;
};

const DEFAULT_CHIPS = [1000, 5000, 10000, 50000, 100000];
const DEFAULT_SLOTS: Slot[] = [
  { label: "🍓", multiplier: 5, color: "#ef4444" },
  { label: "🍗", multiplier: 45, color: "#f59e0b" },
  { label: "🐙", multiplier: 25, color: "#ec4899" },
  { label: "🐟", multiplier: 15, color: "#0ea5e9" },
  { label: "🥩", multiplier: 10, color: "#dc2626" },
  { label: "🍇", multiplier: 5, color: "#a855f7" },
  { label: "🥬", multiplier: 5, color: "#22c55e" },
  { label: "🌽", multiplier: 5, color: "#eab308" },
];

const parseBalance = (raw: any, fallback = 0) =>
  Number(
    raw?.coins ??
      raw?.balance ??
      raw?.r_coins ??
      raw?.data?.coins ??
      raw?.data?.balance ??
      raw?.data?.r_coins ??
      fallback,
  );

export default function FerryWheelGame({ chips, slots, balance: balanceProp, onBalance, onBalanceChange, onClose }: Props) {
  const chipOptions = chips && chips.length ? chips : DEFAULT_CHIPS;
  const wheelSlots = slots && slots.length ? slots : DEFAULT_SLOTS;

  const [balance, setBalance] = useState(balanceProp ?? 0);
  const [selectedChip, setSelectedChip] = useState(chipOptions[0]);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [spinning, setSpinning] = useState(false);
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [history, setHistory] = useState<{ label: string }[]>([]);
  const [win, setWin] = useState({ amount: 0, show: false });
  const { play } = useGameSound();

  const totalBet = Object.values(bets).reduce((a, b) => a + b, 0);
  const [countdown, setCountdown] = useState(ROUND_SECONDS);

  const pushBalance = useCallback(
    (bal: number) => {
      setBalance(bal);
      onBalance?.(bal);
      onBalanceChange?.(bal);
    },
    [onBalance, onBalanceChange],
  );

  useEffect(() => {
    if (typeof balanceProp === "number") setBalance(balanceProp);
  }, [balanceProp]);

  useEffect(() => {
    if (typeof balanceProp === "number" && balanceProp > 0) return;
    (async () => {
      try {
        const res: any = await api.get("/api/games/balance");
        pushBalance(parseBalance(res));
      } catch {}
    })();
  }, [balanceProp, pushBalance]);

  const placeBet = (idx: number) => {
    if (spinning) return;
    if (balance <= 0 || selectedChip > balance) {
      toast.error("পর্যাপ্ত কয়েন নেই");
      return;
    }
    const k = `slot_${idx}`;
    setBets((p) => ({ ...p, [k]: (p[k] || 0) + selectedChip }));
    pushBalance(balance - selectedChip);
    play("chip");
  };

  const clearBets = () => {
    if (spinning) return;
    if (totalBet > 0) {
      pushBalance(balance + totalBet);
    }
    setBets({});
  };

  const spin = async () => {
    if (spinning) return;
    if (totalBet <= 0) {
      toast.error("আগে bet রাখো");
      return;
    }
    setSpinning(true);
    setResultIndex(null);
    play("spin");

    const runResult = (idx: number, winAmount: number, newBal: number) => {
      setResultIndex(idx);
      setTimeout(() => {
        setHistory((h) => [{ label: wheelSlots[idx]?.label || "?" }, ...h].slice(0, 20));
        pushBalance(newBal);
        setSpinning(false);
        setBets({});
        if (winAmount > 0) {
          setWin({ amount: winAmount, show: true });
          play("win");
          emitGameWin({ amount: winAmount, game: "Fortune Wheel" });
          setTimeout(() => setWin({ amount: 0, show: false }), 2500);
        } else {
          play("lose");
        }
      }, 4500);
    };

    try {
      const betsArray = Object.entries(bets)
        .filter(([, v]) => Number(v) > 0)
        .map(([target, amount]) => ({ target, amount }));
      const res: any = await api.post("/api/games/ferry/play", { bets, bets_array: betsArray, total: totalBet });
      const idx = Number(res?.result_index ?? res?.slot_index ?? res?.round?.result?.index ?? res?.result?.index ?? 0);
      const winAmount = Number(res?.win ?? res?.payout ?? res?.round?.payout_total ?? 0);
      const newBal = parseBalance(res, balance + winAmount);
      runResult(idx, winAmount, newBal);
    } catch {
      const idx = Math.floor(Math.random() * wheelSlots.length);
      const bet = bets[`slot_${idx}`] || 0;
      const winAmount = bet * (wheelSlots[idx]?.multiplier || 0);
      runResult(idx, winAmount, balance + winAmount);
    }
  };


  useEffect(() => {
    if (spinning) return;
    if (countdown <= 0) {
      if (totalBet > 0) spin();
      setCountdown(ROUND_SECONDS);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, spinning]);

  useEffect(() => {
    if (!spinning) setCountdown(ROUND_SECONDS);
  }, [spinning]);

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-[#001a2e] via-[#001020] to-black text-white">
      {/* Header (only show if standalone onClose is passed) */}
      {onClose && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/20">
          <button onClick={onClose} className="text-cyan-400 text-xl">✕</button>
          <div className="text-sm font-bold text-cyan-400">🎡 FORTUNE WHEEL</div>
          <div className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300">
            🪙 {balance.toLocaleString()}
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        <ResultsHistoryBar items={history.map((h, i) => ({ id: i, label: h.label }))} />
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <FortuneWheel slots={wheelSlots as any} spinning={spinning} targetIndex={resultIndex} />
        {!spinning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/60 p-2 backdrop-blur-sm">
              <CircularTimer
                seconds={ROUND_SECONDS}
                remaining={countdown}
                size={72}
                stroke={6}
                label={totalBet > 0 ? "SPIN IN" : "BET"}
              />
            </div>
          </div>
        )}
      </div>


      <div className="px-3 pb-2">
        <div className="grid grid-cols-4 gap-2">
          {wheelSlots.map((s, i) => (
            <button
              key={i}
              onClick={() => placeBet(i)}
              disabled={spinning}
              className="relative rounded-lg border-2 py-2 text-lg font-bold transition active:scale-95"
              style={{ borderColor: s.color || "#22d3ee", background: `${s.color || "#22d3ee"}22` }}
            >
              <div>{s.label}</div>
              <div className="text-[10px] text-white/70">x{s.multiplier}</div>
              {bets[`slot_${i}`] ? (
                <span className="absolute -top-2 -right-2 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-black shadow">
                  {bets[`slot_${i}`]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-cyan-500/20 bg-black/50 px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] text-white/60">
            Bet: <span className="text-cyan-400 font-bold">{totalBet}</span>
          </div>
          <button
            onClick={clearBets}
            disabled={spinning || totalBet === 0}
            className="text-[11px] text-white/60 underline disabled:opacity-30"
          >
            Clear
          </button>
        </div>
        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
          {chipOptions.map((c) => (
            <ChipStack key={c} value={c} selected={selectedChip === c} onClick={() => setSelectedChip(c)} disabled={spinning} />
          ))}
        </div>
      </div>


      {win.show && <WinCelebration amount={win.amount} />}
    </div>
  );
}
