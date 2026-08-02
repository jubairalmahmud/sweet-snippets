// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/sk-love/lib/api";
import {
  CircularTimer,
  ResultsHistoryBar,
  WinCelebration,
  useGameSound,
} from "./shared";
import FlipCard, { PlayingCard } from "./teenpatti/FlipCard";

type Chip = number;
type Hand = "A" | "B" | "C";

interface Props {
  chips: Chip[];
  timerSeconds: number;
  onBalance: (coins: number) => void;
  balance: number;
}

const HANDS: Hand[] = ["A", "B", "C"];
const HAND_COLORS: Record<Hand, string> = {
  A: "from-rose-600 to-rose-800",
  B: "from-amber-500 to-amber-700",
  C: "from-sky-600 to-sky-800",
};
const HAND_SOLID: Record<Hand, string> = {
  A: "bg-rose-600",
  B: "bg-amber-500",
  C: "bg-sky-600",
};

// Timing (ms)
const DEAL_STEP = 180;     // between each card deal
const REVEAL_HAND = 700;   // between hand reveals
const REVEAL_CARD = 220;   // between cards within a hand
const RESULT_DELAY = 400;  // after last card reveal

export default function TeenPattiGame({
  chips,
  timerSeconds,
  onBalance,
  balance,
}: Props) {
  const sound = useGameSound();
  const [selectedChip, setSelectedChip] = useState<Chip>(chips[0] ?? 100);
  const [bets, setBets] = useState<Record<Hand, number>>({ A: 0, B: 0, C: 0 });
  const [lastBets, setLastBets] = useState<Record<Hand, number>>({ A: 0, B: 0, C: 0 });
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [phase, setPhase] = useState<"betting" | "dealing" | "result">("betting");
  const [hands, setHands] = useState<Record<Hand, PlayingCard[]> | null>(null);
  const [winner, setWinner] = useState<Hand | null>(null);
  const [revealed, setRevealed] = useState<Record<Hand, boolean>>({
    A: false, B: false, C: false,
  });
  const [dealtRound, setDealtRound] = useState(0); // incremented per round to reset FlipCards
  const [result, setResult] = useState<{ payout: number; net: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { id: string; label: string; color: string }[]
  >([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalBet = useMemo(() => bets.A + bets.B + bets.C, [bets]);

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

  const addBet = (h: Hand) => {
    if (phase !== "betting") return;
    if (totalBet + selectedChip > balance) {
      setError("পর্যাপ্ত coin নাই");
      return;
    }
    setError(null);
    sound.play("click");
    setBets((p) => ({ ...p, [h]: p[h] + selectedChip }));
  };

  const clearBets = () => phase === "betting" && setBets({ A: 0, B: 0, C: 0 });
  const repeatBets = () => {
    if (phase !== "betting") return;
    const total = lastBets.A + lastBets.B + lastBets.C;
    if (!total || total > balance) return;
    setBets({ ...lastBets });
  };

  const submit = async () => {
    if (busy) return;
    if (totalBet <= 0) {
      setPhase("betting");
      setTimeLeft(timerSeconds);
      return;
    }
    setBusy(true);
    setPhase("dealing");
    setRevealed({ A: false, B: false, C: false });
    setDealtRound((n) => n + 1);
    sound.play("spin");
    try {
      const res = await api.post<{
        result: { winner: Hand; hands: Record<Hand, PlayingCard[]> };
        payout: number;
        net: number;
        balance: number;
      }>("/api/games/teenpatti/play", { bets: { hands: bets } });

      setHands(res.result.hands);

      // Deal takes ~9 cards * DEAL_STEP
      const dealDone = 9 * DEAL_STEP + 300;

      // Reveal hands A → B → C
      HANDS.forEach((h, idx) => {
        setTimeout(() => {
          sound.play("click");
          setRevealed((prev) => ({ ...prev, [h]: true }));
        }, dealDone + idx * REVEAL_HAND);
      });

      const lastReveal =
        dealDone + (HANDS.length - 1) * REVEAL_HAND + 2 * REVEAL_CARD + 550;

      setTimeout(() => {
        const w = res.result.winner;
        setWinner(w);
        setResult({ payout: res.payout, net: res.net });
        setHistory((h) => [
          {
            id: `${Date.now()}`,
            label: w,
            color: HAND_SOLID[w],
          },
          ...h,
        ].slice(0, 10));
        onBalance(res.balance);
        setLastBets(bets);
        sound.play(res.net >= 0 ? "win" : "lose");
        setPhase("result");
      }, lastReveal + RESULT_DELAY);

      setTimeout(() => {
        setBets({ A: 0, B: 0, C: 0 });
        setHands(null);
        setWinner(null);
        setResult(null);
        setRevealed({ A: false, B: false, C: false });
        setPhase("betting");
      }, lastReveal + RESULT_DELAY + 3500);
    } catch (e: any) {
      setError(e?.message || "Play failed");
      setPhase("betting");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-emerald-950 via-green-900 to-black text-white overflow-hidden">
      {/* Top */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 gap-2">
        <CircularTimer seconds={timerSeconds} remaining={timeLeft} size={56} />
        <div className="flex-1 mx-2">
          <ResultsHistoryBar items={history} />
        </div>
        <div className="text-right text-[11px] text-white/70">
          <div>Balance</div>
          <div className="text-yellow-300 font-bold text-sm">{balance}</div>
        </div>
      </div>

      {/* Hands */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {HANDS.map((h, handIdx) => {
          const isWin = winner === h;
          const dim = winner && !isWin;
          return (
            <button
              key={h}
              onClick={() => addBet(h)}
              disabled={phase !== "betting"}
              className={`w-full relative rounded-2xl p-3 bg-gradient-to-br ${HAND_COLORS[h]} transition ${
                isWin
                  ? "ring-4 ring-yellow-300 scale-[1.03] shadow-lg shadow-yellow-500/40"
                  : "ring-2 ring-white/10"
              } ${dim ? "opacity-50" : ""} active:scale-[0.98]`}
            >
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <div className="text-2xl font-extrabold">Hand {h}</div>
                  <div className="text-[11px] opacity-90">Payout x3</div>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <FlipCard
                      key={`${dealtRound}-${h}-${i}`}
                      card={hands?.[h]?.[i]}
                      faceUp={revealed[h]}
                      dealDelay={(handIdx * 3 + i) * DEAL_STEP}
                      delay={i * REVEAL_CARD}
                      highlight={isWin}
                    />
                  ))}
                </div>
              </div>
              {bets[h] ? (
                <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[11px] font-bold rounded-full px-2 py-0.5 shadow">
                  {bets[h]}
                </span>
              ) : null}
            </button>
          );
        })}

        {error && (
          <div className="text-center text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md py-2">
            {error}
          </div>
        )}
      </div>

      {/* Winner banner */}
      {result && winner && (
        <div className="absolute inset-x-0 top-1/3 flex justify-center pointer-events-none z-20 animate-scale-in">
          <div
            className={`px-8 py-5 rounded-2xl text-center shadow-2xl bg-gradient-to-br ${HAND_COLORS[winner]} border-2 border-yellow-300`}
          >
            <div className="text-xs opacity-90 tracking-widest">WINNER</div>
            <div className="text-4xl font-extrabold mt-1">Hand {winner}</div>
            <div
              className={`mt-2 text-base font-bold ${
                result.net >= 0 ? "text-yellow-300" : "text-white/80"
              }`}
            >
              {result.net >= 0 ? `+${result.net}` : result.net} coin
            </div>
          </div>
        </div>
      )}

      {/* Bottom */}
      <div className="border-t border-white/10 bg-black/40 px-3 py-3">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-white/70">
            বেট: <span className="text-yellow-300 font-bold">{totalBet}</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={repeatBets}
              disabled={
                phase !== "betting" || !(lastBets.A + lastBets.B + lastBets.C)
              }
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
      {result && result.net > 0 && <WinCelebration amount={result.net} />}
    </div>
  );
}
