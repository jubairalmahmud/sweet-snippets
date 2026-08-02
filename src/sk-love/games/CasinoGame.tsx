// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { ResultsHistoryBar, WinCelebration, useGameSound, ChipStack, CircularTimer } from "./shared";
import RouletteWheel from "./casino/RouletteWheel";
import { emitGameWin } from "../components/TopGameWinnerBanner";

const ROUND_SECONDS = 10;

type Props = {
  chips?: number[];
  timerSeconds?: number;
  balance?: number;
  onBalance?: (balance: number) => void;
  // legacy
  onBalanceChange?: (balance: number) => void;
  onClose?: () => void;
};

type HistoryItem = { number: number; color: "red" | "black" | "green" };

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const colorOf = (n: number): "red" | "black" | "green" =>
  n === 0 ? "green" : RED_NUMBERS.has(n) ? "red" : "black";

const DEFAULT_CHIPS = [1000, 5000, 10000, 50000, 100000];

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

export default function CasinoGame({ chips, balance: balanceProp, onBalance, onBalanceChange, onClose }: Props) {
  const chipOptions = chips && chips.length ? chips : DEFAULT_CHIPS;
  const [balance, setBalance] = useState<number>(balanceProp ?? 0);
  const [selectedChip, setSelectedChip] = useState<number>(chipOptions[0]);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [spinning, setSpinning] = useState(false);
  const [resultNumber, setResultNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [win, setWin] = useState<{ amount: number; show: boolean }>({ amount: 0, show: false });
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

  // Sync when parent prop changes
  useEffect(() => {
    if (typeof balanceProp === "number") setBalance(balanceProp);
  }, [balanceProp]);

  // Fallback self-fetch only if parent didn't provide
  useEffect(() => {
    if (typeof balanceProp === "number" && balanceProp > 0) return;
    (async () => {
      try {
        const res: any = await api.get("/api/games/balance");
        pushBalance(parseBalance(res));
      } catch {
        /* silent */
      }
    })();
  }, [balanceProp, pushBalance]);

  const placeBet = (key: string) => {
    if (spinning) return;
    if (balance <= 0 || selectedChip > balance) {
      toast.error("পর্যাপ্ত কয়েন নেই");
      return;
    }
    setBets((prev) => ({ ...prev, [key]: (prev[key] || 0) + selectedChip }));
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
    setResultNumber(null);
    play("spin");

    const runResult = (num: number, winAmount: number, newBal: number) => {
      setResultNumber(num);
      setTimeout(() => {
        setHistory((h) => [{ number: num, color: colorOf(num) }, ...h].slice(0, 20));
        pushBalance(newBal);
        setSpinning(false);
        setBets({});
        if (winAmount > 0) {
          setWin({ amount: winAmount, show: true });
          play("win");
          emitGameWin({ amount: winAmount, game: "Roulette" });
          setTimeout(() => setWin({ amount: 0, show: false }), 2500);
        } else {
          play("lose");
        }
      }, 4200);
    };

    try {
      const betsArray = Object.entries(bets).map(([target, amount]) => ({ target, amount }));
      const res: any = await api.post("/api/games/casino/play", { bets: betsArray, total: totalBet });
      const num = Number(
        res?.result_number ?? res?.number ?? res?.round?.result?.number ?? res?.result?.number ?? res?.data?.result_number ?? 0,
      );
      const winAmount = Number(
        res?.win ?? res?.payout ?? res?.round?.payout_total ?? res?.payout_total ?? res?.data?.win ?? 0,
      );
      const newBal = parseBalance(res, balance + winAmount);
      runResult(num, winAmount, newBal);
    } catch {
      // Local fallback so the wheel still spins in preview / offline
      const num = Math.floor(Math.random() * 37);
      const c = colorOf(num);
      let winAmount = 0;
      for (const [k, amt] of Object.entries(bets)) {
        if (k === c) winAmount += amt * (c === "green" ? 14 : 2);
        else if (k === "even" && num !== 0 && num % 2 === 0) winAmount += amt * 2;
        else if (k === "odd" && num % 2 === 1) winAmount += amt * 2;
        else if (k === "low" && num >= 1 && num <= 18) winAmount += amt * 2;
        else if (k === "high" && num >= 19 && num <= 36) winAmount += amt * 2;
        else if (k === "d1" && num >= 1 && num <= 12) winAmount += amt * 3;
        else if (k === "d2" && num >= 13 && num <= 24) winAmount += amt * 3;
      }
      runResult(num, winAmount, balance + winAmount);
    }
  };


  // Auto 10s round timer — freezes during spin, auto-fires spin at 0 if bets exist
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

  // Reset to full round after a spin completes
  useEffect(() => {
    if (!spinning) setCountdown(ROUND_SECONDS);
  }, [spinning]);

  const BetBox = ({ label, betKey, className = "" }: { label: string; betKey: string; className?: string }) => (
    <button
      onClick={() => placeBet(betKey)}
      disabled={spinning}
      className={`relative rounded-lg border-2 border-yellow-500/40 py-2 px-3 text-xs font-bold text-white transition active:scale-95 ${className}`}
    >
      {label}
      {bets[betKey] ? (
        <span className="absolute -top-2 -right-2 rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-black text-black shadow">
          {bets[betKey]}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="relative flex h-full flex-col bg-gradient-to-b from-[#1a0033] via-[#0d0020] to-black text-white">
      {/* Header (only show if standalone onClose is passed) */}
      {onClose && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-yellow-500/20">
          <button onClick={onClose} className="text-yellow-400 text-xl">✕</button>
          <div className="text-sm font-bold text-yellow-400">🎰 CASINO ROULETTE</div>
          <div className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-300">
            🪙 {balance.toLocaleString()}
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        <ResultsHistoryBar items={history.map((h, i) => ({ id: i, label: String(h.number), color: h.color }))} />
      </div>

      <div className="relative flex flex-1 items-center justify-center">
        <RouletteWheel spinning={spinning} targetNumber={resultNumber} />
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
        <div className="grid grid-cols-3 gap-2 mb-2">
          <BetBox label="RED" betKey="red" className="bg-red-600" />
          <BetBox label="GREEN 0" betKey="green" className="bg-green-600" />
          <BetBox label="BLACK" betKey="black" className="bg-neutral-900" />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <BetBox label="1-18" betKey="low" className="bg-purple-700/70" />
          <BetBox label="EVEN" betKey="even" className="bg-purple-700/70" />
          <BetBox label="ODD" betKey="odd" className="bg-purple-700/70" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <BetBox label="19-36" betKey="high" className="bg-purple-700/70" />
          <BetBox label="1st 12" betKey="d1" className="bg-blue-800/70" />
          <BetBox label="2nd 12" betKey="d2" className="bg-blue-800/70" />
        </div>
      </div>

      <div className="border-t border-yellow-500/20 bg-black/50 px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] text-white/60">
            Bet: <span className="text-yellow-400 font-bold">{totalBet}</span>
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
