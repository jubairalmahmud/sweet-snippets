// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/sk-love/lib/api";
import RouletteWheel from "./casino/RouletteWheel";
import { CircularTimer, ResultsHistoryBar, WinCelebration, useGameSound } from "./shared";

/**
 * Casino Roulette — European single-zero (0..36).
 * Wire matches Laravel GameController (deployed):
 *   POST /api/games/casino/play
 *     body: { bets: [ { target: "red"|"17"|..., amount: <coins> }, ... ] }
 *   resp: { ok, round: { result: { number, color, parity, half },
 *                        payout_total, net, balance_after },
 *           coins }
 */

type Chip = number;
type OutsideKey = "red" | "black" | "odd" | "even" | "low" | "high";

// UI bet keys:  "n:<0-36>"  or  "o:<outside>".  API target = key after prefix.
type BetMap = Record<string, number>;

interface Props {
  chips: Chip[];
  timerSeconds: number;
  onBalance: (coins: number) => void;
  balance: number;
}

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const numberColor = (n: number): "green" | "red" | "black" =>
  n === 0 ? "green" : RED.has(n) ? "red" : "black";

const OUTSIDE: [OutsideKey, string][] = [
  ["low", "1-18"],
  ["even", "EVEN"],
  ["red", "RED"],
  ["black", "BLACK"],
  ["odd", "ODD"],
  ["high", "19-36"],
];

const keyToTarget = (k: string) => (k.startsWith("n:") || k.startsWith("o:") ? k.slice(2) : k);

type RoundResult = {
  number: number;
  color: "green" | "red" | "black";
  payout: number;
  net: number;
};

export default function CasinoGame({ chips, timerSeconds, onBalance, balance }: Props) {
  const chipList = chips.length ? chips : [100, 200, 500, 1000];
  const [selectedChip, setSelectedChip] = useState<Chip>(chipList[0]);
  const [bets, setBets] = useState<BetMap>({});
  const [lastBets, setLastBets] = useState<BetMap>({});
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [phase, setPhase] = useState<"betting" | "spinning" | "result">("betting");
  const [result, setResult] = useState<RoundResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sound = useGameSound();

  const totalBet = useMemo(
    () => Object.values(bets).reduce((s, v) => s + v, 0),
    [bets],
  );

  // countdown timer while betting
  useEffect(() => {
    if (phase !== "betting") return;
    if (tickRef.current) clearInterval(tickRef.current);
    setTimeLeft(timerSeconds);
    tickRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          void submit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timerSeconds]);

  const addBet = (key: string) => {
    if (phase !== "betting") return;
    if (selectedChip > balance) {
      setError("পর্যাপ্ত coin নাই");
      sound.play("lose");
      return;
    }
    setError(null);
    sound.play("chip");
    setBets((prev) => ({ ...prev, [key]: (prev[key] || 0) + selectedChip }));
    onBalance?.(balance - selectedChip);
  };

  const clearBets = () => {
    if (phase !== "betting") return;
    sound.play("click");
    if (totalBet > 0) {
      onBalance?.(balance + totalBet);
    }
    setBets({});
  };

  const repeatBets = () => {
    if (phase !== "betting") return;
    const total = Object.values(lastBets).reduce((s, v) => s + v, 0);
    if (!total) return;
    if (total > balance) {
      setError("পর্যাপ্ত coin নাই");
      return;
    }
    sound.play("click");
    setBets({ ...lastBets });
    onBalance?.(balance - total);
  };

  const submit = async () => {
    if (busy) return;
    if (totalBet <= 0) {
      // no bet placed → reset for a new round
      setPhase("betting");
      setTimeLeft(timerSeconds);
      return;
    }
    setBusy(true);
    setPhase("spinning");
    sound.play("spin");
    try {
      const payload = Object.entries(bets).map(([k, v]) => ({
        target: keyToTarget(k),
        amount: v,
      }));

      const res = await api.post<{
        ok: boolean;
        message?: string;
        coins?: number;
        round?: {
          result: { number: number; color: "green" | "red" | "black" };
          payout_total: number;
          net: number;
          balance_after: number;
        };
      }>("/api/games/casino/play", { bets: payload });

      if (!res?.ok || !res.round) {
        throw new Error(res?.message || "Play failed");
      }

      const r = res.round;
      const n = r.result.number;
      const rr: RoundResult = {
        number: n,
        color: r.result.color ?? numberColor(n),
        payout: r.payout_total,
        net: r.net,
      };
      setResult(rr);
      setHistory((h) => [n, ...h].slice(0, 12));
      onBalance(res.coins ?? r.balance_after);
      setLastBets(bets);

      // Wait for wheel animation, then reveal result banner.
      window.setTimeout(() => {
        setPhase("result");
        sound.play(rr.net > 0 ? "win" : "lose");
        // After showing result, return to betting.
        window.setTimeout(() => {
          setBets({});
          setResult(null);
          setPhase("betting");
        }, 3200);
      }, 4200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Play failed";
      setError(msg);
      sound.play("lose");
      setPhase("betting");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-gradient-to-b from-emerald-950 via-emerald-900 to-black text-white overflow-hidden">
      {/* ============ TOP: timer + history ============ */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <CircularTimer
            seconds={timerSeconds}
            remaining={timeLeft}
            size={56}
          />
          <div className="text-[11px] leading-tight text-white/70">
            {phase === "betting" && <>বেট করুন<br /><span className="text-yellow-300 font-bold">{totalBet}</span> coin</>}
            {phase === "spinning" && "স্পিন হচ্ছে…"}
            {phase === "result" && "রাউন্ড শেষ"}
          </div>
        </div>
        <div className="max-w-[55%]">
          <ResultsHistoryBar
            title="Last"
            items={history.map((n, i) => ({
              id: `${i}-${n}`,
              label: String(n),
              color:
                numberColor(n) === "red"
                  ? "#dc2626"
                  : numberColor(n) === "black"
                  ? "#1a1a1a"
                  : "#059669",
            }))}
          />
        </div>
      </div>

      {/* ============ WHEEL ============ */}
      <div className="flex flex-col items-center justify-center py-3">
        <RouletteWheel
          targetNumber={result?.number ?? null}
          spinning={phase === "spinning"}
          size={280}
        />
      </div>

      {/* ============ RESULT BANNER ============ */}
      {phase === "result" && result && (
        <div className="absolute inset-x-0 top-[46%] flex justify-center pointer-events-none z-30">
          <div
            className={`px-6 py-3 rounded-2xl text-center shadow-2xl animate-scale-in ${
              result.color === "red"
                ? "bg-red-600"
                : result.color === "black"
                ? "bg-neutral-900 border border-white/30"
                : "bg-emerald-600"
            }`}
          >
            <div className="text-4xl font-extrabold leading-none">{result.number}</div>
            <div
              className={`mt-1 text-sm font-semibold ${
                result.net > 0 ? "text-yellow-300" : "text-white/80"
              }`}
            >
              {result.net > 0 ? `+${result.net}` : result.net} coin
            </div>
          </div>
        </div>
      )}

      {/* Win celebration overlay */}
      {phase === "result" && result && result.net > 0 && (
        <WinCelebration amount={result.net} />
      )}

      {/* ============ BOARD ============ */}
      <div className="flex-1 overflow-y-auto px-3 pb-1">
        {/* Zero */}
        <button
          onClick={() => addBet("n:0")}
          disabled={phase !== "betting"}
          className="w-full h-9 rounded-md bg-emerald-600 font-bold mb-1.5 relative active:scale-95 transition text-sm disabled:opacity-60"
        >
          0
          {bets["n:0"] ? (
            <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-bold rounded-full px-1.5 py-0.5 shadow">
              {bets["n:0"]}
            </span>
          ) : null}
        </button>

        {/* 1..36 */}
        <div className="grid grid-cols-6 gap-1">
          {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
            const key = `n:${n}`;
            const c = numberColor(n);
            return (
              <button
                key={n}
                onClick={() => addBet(key)}
                disabled={phase !== "betting"}
                className={`h-9 rounded-md text-xs font-bold relative active:scale-95 transition disabled:opacity-60 ${
                  c === "red" ? "bg-red-600" : "bg-neutral-800 border border-white/10"
                }`}
              >
                {n}
                {bets[key] ? (
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-black text-[10px] font-bold rounded-full px-1 py-0.5 shadow">
                    {bets[key]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Outside bets */}
        <div className="grid grid-cols-3 gap-1 mt-1.5">
          {OUTSIDE.map(([k, label]) => {
            const bk = `o:${k}`;
            return (
              <button
                key={k}
                onClick={() => addBet(bk)}
                disabled={phase !== "betting"}
                className={`h-10 rounded-md text-[11px] font-bold relative active:scale-95 transition disabled:opacity-60 ${
                  k === "red"
                    ? "bg-red-600"
                    : k === "black"
                    ? "bg-neutral-900 border border-white/20"
                    : "bg-white/10 border border-white/15"
                }`}
              >
                {label}
                {bets[bk] ? (
                  <span className="absolute -top-1.5 -right-1.5 bg-yellow-400 text-black text-[10px] font-bold rounded-full px-1 py-0.5 shadow">
                    {bets[bk]}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-2 text-center text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-md py-1.5">
            {error}
          </div>
        )}
      </div>

      {/* ============ BOTTOM: chips + actions ============ */}
      <div className="border-t border-white/10 bg-black/50 px-3 py-2.5">
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-white/70">
            Balance: <span className="text-yellow-300 font-bold">{balance}</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={repeatBets}
              disabled={phase !== "betting" || !Object.keys(lastBets).length}
              className="px-3 py-1 rounded-md bg-white/10 border border-white/20 disabled:opacity-40 text-[11px]"
            >
              Repeat
            </button>
            <button
              onClick={clearBets}
              disabled={phase !== "betting" || !totalBet}
              className="px-3 py-1 rounded-md bg-white/10 border border-white/20 disabled:opacity-40 text-[11px]"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {chipList.map((c) => (
            <button
              key={c}
              onClick={() => {
                setSelectedChip(c);
                sound.play("click");
              }}
              className={`shrink-0 w-12 h-12 rounded-full font-bold text-xs border-4 transition ${
                selectedChip === c
                  ? "border-yellow-300 bg-yellow-500 text-black scale-110 shadow-lg"
                  : "border-white/20 bg-neutral-800 text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
