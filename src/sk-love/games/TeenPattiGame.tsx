// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { useGameSound, WinCelebration } from "./shared";
import FlipCard from "./teenpatti/FlipCard";
import Stacked3DChips from "./teenpatti/Stacked3DChips";
import { RefreshCw, Users, X, HelpCircle, History } from "lucide-react";
import { emitGameWin } from "../components/TopGameWinnerBanner";

type Card = { rank: string; suit: "♠" | "♥" | "♦" | "♣" };
type Hand = { cards: Card[]; label: string };
type HandKey = "A" | "B" | "C";

type Props = {
  chips?: number[];
  timerSeconds?: number;
  balance?: number;
  onBalance?: (balance: number) => void;
  onBalanceChange?: (balance: number) => void;
  onClose?: () => void;
};

type FlyingChip = {
  id: number;
  target: HandKey;
  amount: number;
  startX: number;
  startY: number;
};

const DEFAULT_CHIPS = [1000, 10000, 100000, 1000000];
const ROUND_SECONDS = 12;

const HAND_CONFIGS: Record<HandKey, { name: string; drink: string }> = {
  A: { name: "Player A", drink: "🍹" },
  B: { name: "Player B", drink: "🍸" },
  C: { name: "Player C", drink: "🍺" },
};

const formatKMB = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}k`;
  if (num >= 1000) return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k`;
  return `${num}`;
};

const getStarsForLabel = (label: string): string => {
  const l = label.toLowerCase();
  if (l.includes("flush") || l.includes("three")) return "⭐⭐⭐";
  if (l.includes("straight")) return "⭐⭐";
  return "⭐";
};

const getChipStyle = (val: number) => {
  if (val >= 1000000)
    return { bg: "from-amber-400 via-yellow-300 to-amber-500", text: "1000K", label: "1000K", border: "border-yellow-200" };
  if (val >= 100000)
    return { bg: "from-sky-400 via-cyan-300 to-blue-500", text: "100K", label: "100K", border: "border-cyan-200" };
  if (val >= 10000)
    return { bg: "from-amber-500 via-orange-400 to-amber-600", text: "10K", label: "10K", border: "border-amber-200" };
  return { bg: "from-purple-500 via-fuchsia-400 to-purple-600", text: "1K", label: "1K", border: "border-purple-200" };
};

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

export default function TeenPattiGame({
  chips,
  balance: balanceProp,
  onBalance,
  onBalanceChange,
  onClose,
}: Props) {
  const rawChipOptions = chips && chips.length ? chips : DEFAULT_CHIPS;
  const chipOptions = Array.from(
    new Map(rawChipOptions.map((c) => [getChipStyle(c).label, c])).values()
  );
  const [balance, setBalance] = useState(balanceProp ?? 70717656);
  const [selectedChip, setSelectedChip] = useState(chipOptions[3] ?? 1000000); // 1000K default selected
  const [bets, setBets] = useState<Record<HandKey, number>>({ A: 0, B: 0, C: 0 });
  const [lastBets, setLastBets] = useState<Record<HandKey, number>>({ A: 0, B: 0, C: 0 });
  const [simulatedPots, setSimulatedPots] = useState<Record<HandKey, number>>({ A: 0, B: 0, C: 0 });
  const [roundNumber, setRoundNumber] = useState(186);
  const [gameId] = useState("10000013");
  const [phase, setPhase] = useState<"betting" | "starting" | "dealing" | "result">("betting");
  const [countdown, setCountdown] = useState(ROUND_SECONDS);
  const [startingCountdown, setStartingCountdown] = useState(2);
  const [hands, setHands] = useState<Record<HandKey, Hand | null>>({ A: null, B: null, C: null });
  const [revealed, setRevealed] = useState<Record<HandKey, boolean>>({ A: false, B: false, C: false });
  const [winner, setWinner] = useState<HandKey | null>(null);
  const [win, setWin] = useState({ amount: 0, show: false });
  const [floatingWinText, setFloatingWinText] = useState<string | null>(null);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [flyingChips, setFlyingChips] = useState<FlyingChip[]>([]);
  const spotRefs = useRef<Record<HandKey, HTMLButtonElement | null>>({ A: null, B: null, C: null });
  const { play } = useGameSound();

  const totalUserBet = bets.A + bets.B + bets.C;
  const totalPot = simulatedPots.A + simulatedPots.B + simulatedPots.C;

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

  // Fetch initial balance
  useEffect(() => {
    if (typeof balanceProp === "number" && balanceProp > 0) return;
    (async () => {
      try {
        const res: any = await api.get("/api/games/balance");
        const b = parseBalance(res);
        if (b > 0) pushBalance(b);
      } catch {}
    })();
  }, [balanceProp, pushBalance]);

  // Handle betting timer
  useEffect(() => {
    if (phase !== "betting") return;
    if (countdown <= 0) {
      setPhase("starting");
      setStartingCountdown(2);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, phase]);

  // Handle starting countdown overlay ("Starting 2s", "Starting 1s", "Starting 0s")
  useEffect(() => {
    if (phase !== "starting") return;
    if (startingCountdown < 0) {
      void deal();
      return;
    }
    const timer = setTimeout(() => setStartingCountdown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [startingCountdown, phase]);

  const triggerFlyingChip = (target: HandKey, amount: number) => {
    const chipId = Date.now() + Math.random();
    const newChip: FlyingChip = {
      id: chipId,
      target,
      amount,
      startX: window.innerWidth / 2,
      startY: window.innerHeight - 60,
    };
    setFlyingChips((prev) => [...prev, newChip]);
    setTimeout(() => {
      setFlyingChips((prev) => prev.filter((c) => c.id !== chipId));
    }, 500);
  };

  const placeBet = (k: HandKey) => {
    if (phase !== "betting") return;
    if (balance <= 0 || selectedChip > balance) {
      toast.error("পর্যাপ্ত কয়েন নেই!");
      return;
    }
    triggerFlyingChip(k, selectedChip);
    setBets((p) => ({ ...p, [k]: p[k] + selectedChip }));
    setSimulatedPots((p) => ({
      ...p,
      [k]: p[k] + selectedChip,
    }));
    pushBalance(balance - selectedChip);
    play("chip");
  };

  const handleRepeatBets = () => {
    if (phase !== "betting") return;
    const totalLast = lastBets.A + lastBets.B + lastBets.C;
    if (totalLast <= 0) {
      toast.error("আগের কোনো বেট নেই!");
      return;
    }
    if (totalLast > balance) {
      toast.error("পর্যাপ্ত কয়েন নেই!");
      return;
    }
    if (lastBets.A > 0) triggerFlyingChip("A", lastBets.A);
    if (lastBets.B > 0) triggerFlyingChip("B", lastBets.B);
    if (lastBets.C > 0) triggerFlyingChip("C", lastBets.C);

    setBets({ ...lastBets });
    setSimulatedPots((p) => ({
      A: p.A + lastBets.A,
      B: p.B + lastBets.B,
      C: p.C + lastBets.C,
    }));
    pushBalance(balance - totalLast);
    play("chip");
  };

  const generateCardsForWinner = (winnerKey: HandKey): Record<HandKey, Hand> => {
    const topHands: Hand[] = [
      { cards: [{ rank: "A", suit: "♣" }, { rank: "K", suit: "♣" }, { rank: "9", suit: "♣" }], label: "flush" },
      { cards: [{ rank: "Q", suit: "♦" }, { rank: "J", suit: "♠" }, { rank: "10", suit: "♥" }], label: "straight" },
      { cards: [{ rank: "A", suit: "♠" }, { rank: "A", suit: "♥" }, { rank: "A", suit: "♦" }], label: "three of a kind" },
    ];
    const lowerHands: Hand[] = [
      { cards: [{ rank: "J", suit: "♥" }, { rank: "3", suit: "♦" }, { rank: "7", suit: "♠" }], label: "high card" },
      { cards: [{ rank: "8", suit: "♣" }, { rank: "8", suit: "♠" }, { rank: "4", suit: "♥" }], label: "pair" },
      { cards: [{ rank: "10", suit: "♦" }, { rank: "5", suit: "♣" }, { rank: "2", suit: "♠" }], label: "high card" },
      { cards: [{ rank: "9", suit: "♥" }, { rank: "6", suit: "♦" }, { rank: "3", suit: "♣" }], label: "high card" },
    ];

    const winningHand = topHands[Math.floor(Math.random() * topHands.length)];
    const remainingKeys = (["A", "B", "C"] as HandKey[]).filter((k) => k !== winnerKey);
    const shuffledLower = [...lowerHands].sort(() => Math.random() - 0.5);

    return {
      [winnerKey]: winningHand,
      [remainingKeys[0]]: shuffledLower[0],
      [remainingKeys[1]]: shuffledLower[1],
    } as Record<HandKey, Hand>;
  };

  const deal = async () => {
    setPhase("dealing");
    setHands({ A: null, B: null, C: null });
    setRevealed({ A: false, B: false, C: false });
    setWinner(null);
    play("spin");

    const runResult = (dealt: Record<HandKey, Hand>, winKey: HandKey, winAmount: number, newBal: number) => {
      setHands(dealt);
      
      // Reveal cards A -> B -> C sequentially
      (["A", "B", "C"] as HandKey[]).forEach((k, idx) => {
        setTimeout(() => {
          setRevealed((r) => ({ ...r, [k]: true }));
          play("flip");
        }, 400 + idx * 600);
      });

      // Announce result
      setTimeout(() => {
        setWinner(winKey);
        setPhase("result");
        pushBalance(newBal);
        if (totalUserBet > 0) setLastBets(bets);

        if (winAmount > 0) {
          setWin({ amount: winAmount, show: true });
          setFloatingWinText(`+${formatKMB(winAmount)}`);
          play("win");
          emitGameWin({ amount: winAmount, game: "Teen Patti" });
        } else if (totalUserBet > 0) {
          setWin({ amount: 0, show: false });
          setFloatingWinText(`-${formatKMB(totalUserBet)}`);
          play("lose");
          toast.error("হারছেন! পরবর্তী রাউন্ডে চেষ্টা করুন।");
        } else {
          setWin({ amount: 0, show: false });
          setFloatingWinText(null);
        }

        // Hide win popup after 3.5s and reset for next round
        setTimeout(() => {
          setWin({ amount: 0, show: false });
          setFloatingWinText(null);
          setBets({ A: 0, B: 0, C: 0 });
          setSimulatedPots({ A: 0, B: 0, C: 0 });
          setHands({ A: null, B: null, C: null });
          setRevealed({ A: false, B: false, C: false });
          setWinner(null);
          setRoundNumber((r) => r + 1);
          setCountdown(ROUND_SECONDS);
          setPhase("betting");
        }, 3800);
      }, 400 + 3 * 600 + 200);
    };

    // Determine outcome locally using 20% win rate logic
    const betKeys = (["A", "B", "C"] as HandKey[]).filter((k) => bets[k] > 0);
    const nonBetKeys = (["A", "B", "C"] as HandKey[]).filter((k) => bets[k] === 0);

    let localWinKey: HandKey = "A";
    let localWinAmount = 0;

    if (totalUserBet > 0) {
      // 20% win chance for user
      const isUserWin = Math.random() < 0.2;
      if (isUserWin && betKeys.length > 0) {
        localWinKey = betKeys[Math.floor(Math.random() * betKeys.length)];
        localWinAmount = bets[localWinKey] * 2;
      } else {
        if (nonBetKeys.length > 0) {
          localWinKey = nonBetKeys[Math.floor(Math.random() * nonBetKeys.length)];
          localWinAmount = 0;
        } else {
          localWinKey = (["A", "B", "C"] as HandKey[])[Math.floor(Math.random() * 3)];
          localWinAmount = bets[localWinKey] * 2;
        }
      }
    } else {
      localWinKey = (["A", "B", "C"] as HandKey[])[Math.floor(Math.random() * 3)];
      localWinAmount = 0;
    }

    const localDealt = generateCardsForWinner(localWinKey);
    const localNewBal = Math.max(0, balance + localWinAmount);

    try {
      const betsObj: Record<string, number> = {};
      (Object.keys(bets) as HandKey[]).forEach((k) => {
        if (bets[k] > 0) betsObj[k] = bets[k];
      });
      const res: any = await api.post("/api/games/teenpatti/play", {
        bets: betsObj,
        total: totalUserBet,
      });

      const handsSrc = res?.hands ?? res?.round?.result?.hands ?? res?.result?.hands ?? {};
      const winKey = (res?.winner ?? res?.round?.result?.winner ?? res?.result?.winner ?? localWinKey) as HandKey;
      const winAmount = Number(res?.win ?? res?.payout ?? res?.round?.payout_total ?? res?.payout_total ?? localWinAmount);
      const newBal = parseBalance(res, localNewBal);

      const dealt: Record<HandKey, Hand> = {
        A: handsSrc?.A ? { cards: handsSrc.A.cards, label: handsSrc.A.label || "flush" } : localDealt.A,
        B: handsSrc?.B ? { cards: handsSrc.B.cards, label: handsSrc.B.label || "high card" } : localDealt.B,
        C: handsSrc?.C ? { cards: handsSrc.C.cards, label: handsSrc.C.label || "straight" } : localDealt.C,
      };

      runResult(dealt, winKey, winAmount, newBal);
    } catch {
      // Offline / Local calculation with 20% win rate
      runResult(localDealt, localWinKey, localWinAmount, localNewBal);
    }
  };

  return (
    <div className="relative flex flex-col h-full w-full bg-gradient-to-b from-[#0e2a3c] via-[#0d2232] to-[#081520] text-white overflow-hidden font-sans select-none">
      {/* ANIMATED FLYING CHIPS */}
      {flyingChips.map((fc) => (
        <div
          key={fc.id}
          className="fixed pointer-events-none z-50 animate-ping rounded-full w-8 h-8 bg-amber-400 border-2 border-yellow-200 shadow-xl flex items-center justify-center font-black text-[9px] text-black"
          style={{
            top: fc.startY,
            left: fc.startX,
            transition: "all 400ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          🪙
        </div>
      ))}

      {/* 1. TOP HEADER BAR WITH SEATS 1, 2, 3, 4 */}
      <div className="flex items-center justify-between px-3 py-1 bg-black/40 border-b border-cyan-500/10 shrink-0">
        <div className="flex items-center gap-1 bg-black/50 rounded-full px-2.5 py-0.5 border border-amber-500/30">
          <span className="text-amber-400 text-xs">🪙</span>
          <span className="text-xs font-bold text-amber-300 font-mono">
            {balance.toLocaleString()}
          </span>
        </div>

        {/* Top seats numbers bar */}
        <div className="flex items-center gap-6 text-[11px] text-cyan-100/40 font-semibold tracking-widest">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-cyan-200/60 font-mono">
            ID:{gameId}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition border border-white/10"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. SUB-HEADER CONTROLS (Round: 186, Icons, NEW Gift) */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs shrink-0">
        <div className="flex items-center gap-2 text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-300">Round: {roundNumber}</span>
            <button
              onClick={() => setRoundNumber((r) => r + 1)}
              className="p-1 rounded-full bg-cyan-900/30 text-cyan-300 hover:bg-cyan-800/50 transition"
              title="Refresh Round"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <HelpCircle className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
          <History className="w-3.5 h-3.5 text-slate-400 cursor-pointer" />
        </div>

        {/* NEW Gift Badge */}
        <div className="flex items-center gap-1 bg-slate-800/90 border border-amber-400/40 rounded-full px-2 py-0.5 text-[10px] text-amber-300 font-bold shadow">
          <span>NEW</span>
          <span>🎁</span>
        </div>
      </div>

      {/* 3. CENTER CROWN & MULTIPLIERS BOX */}
      <div className="flex flex-col items-center justify-center my-1 relative px-4 text-center shrink-0">
        {/* Crown & Multipliers Box */}
        <div className="relative flex flex-col items-center bg-gradient-to-b from-cyan-950/30 to-slate-900/50 border border-cyan-400/20 rounded-2xl p-2 w-full max-w-xs shadow-lg">
          <div className="text-2xl mb-0.5 filter drop-shadow-[0_2px_6px_rgba(234,179,8,0.5)]">👑</div>
          <div className="text-[9px] font-extrabold tracking-wider text-cyan-200 uppercase space-y-0.5">
            <div className="flex items-center justify-center gap-3">
              <span>FLUSH <span className="text-amber-300 font-mono">STRAIGHT *2</span></span>
            </div>
            <div>STRAIGHT FLUSH <span className="text-amber-300 font-mono">*10</span></div>
            <div>THREE OF A KIND <span className="text-amber-300 font-mono">*25</span></div>
          </div>

          {/* Real-time Pot Bar */}
          <div className="mt-1.5 w-full bg-black/60 border border-cyan-500/20 rounded-full px-3 py-0.5 text-[10px] font-mono font-bold text-amber-300 flex items-center justify-center gap-1">
            <span>{formatKMB(totalPot)}</span>
            <span className="text-slate-500">/</span>
            <span>{formatKMB(Math.max(300000, totalPot))}</span>
          </div>
        </div>

        {/* Game State Center Timer */}
        <div className="mt-1.5 min-h-[26px] flex items-center justify-center">
          {phase === "betting" && (
            <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-400/40 rounded-full px-4 py-1 text-xs font-black text-emerald-300 shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Game Start ({countdown})</span>
            </div>
          )}

          {phase === "starting" && (
            <div className="flex items-center gap-2 bg-slate-900/90 border border-cyan-400/40 rounded-2xl px-6 py-2 text-sm font-black text-cyan-200 shadow-2xl backdrop-blur-md">
              <span>Starting {Math.max(0, startingCountdown)}s</span>
            </div>
          )}

          {phase === "dealing" && (
            <div className="flex items-center gap-2 bg-cyan-950/60 border border-cyan-400/40 rounded-full px-4 py-1 text-xs font-black text-cyan-300">
              <span>Revealing Cards...</span>
            </div>
          )}

          {phase === "result" && (
            <div className="flex items-center gap-2 bg-purple-950/60 border border-purple-400/40 rounded-full px-4 py-1 text-xs font-black text-purple-300">
              <span>Winner: Player {winner}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. THREE DRINK BOXES (PLAYER SPOTS) */}
      <div className="flex-1 grid grid-cols-3 gap-2 px-3 py-1 items-stretch max-w-md mx-auto w-full">
        {(["A", "B", "C"] as HandKey[]).map((k) => {
          const cfg = HAND_CONFIGS[k];
          const hand = hands[k];
          const isWin = winner === k;
          const userBetOnHand = bets[k];
          const handPot = simulatedPots[k];

          return (
            <button
              key={k}
              type="button"
              ref={(el) => { spotRefs.current[k] = el; }}
              onClick={() => placeBet(k)}
              disabled={phase !== "betting"}
              className={`relative flex flex-col items-center justify-between rounded-2xl p-2 transition-all duration-300 cursor-pointer border ${
                isWin
                  ? "border-amber-300 bg-gradient-to-b from-amber-500/30 via-yellow-400/20 to-amber-600/30 ring-2 ring-amber-400/80 shadow-[0_0_30px_rgba(251,191,36,0.6)] scale-[1.03] z-10"
                  : "border-cyan-500/15 bg-gradient-to-b from-slate-900/60 to-slate-950/80 hover:border-cyan-400/30 active:scale-95"
              } disabled:cursor-default`}
            >
              {/* Drink Icon Header */}
              <div className="text-3xl filter drop-shadow my-0.5">
                {cfg.drink}
              </div>

              {/* 3 Playing Cards Stack */}
              <div className="flex gap-0.5 items-center justify-center my-1">
                {[0, 1, 2].map((idx) => (
                  <FlipCard
                    key={`card-${k}-${idx}`}
                    card={hand?.cards[idx]}
                    faceUp={revealed[k]}
                    delay={idx * 150}
                    size="sm"
                    highlight={isWin}
                  />
                ))}
              </div>

              {/* Revealed Hand Badge with Stars */}
              <div className="h-6 flex flex-col items-center justify-center my-0.5">
                {revealed[k] && hand?.label ? (
                  <div className="flex flex-col items-center bg-yellow-400 text-black font-black text-[9px] px-2 py-0.5 rounded-full shadow-md uppercase">
                    <span>{hand.label}</span>
                    <span className="text-[7px] leading-tight text-amber-900">{getStarsForLabel(hand.label)}</span>
                  </div>
                ) : null}
              </div>

              {/* 3D Stacked Chips Visual on Spot */}
              <Stacked3DChips amount={userBetOnHand > 0 ? userBetOnHand : handPot} size="sm" />

              {/* Pot & Mine Box */}
              <div className="w-full mt-auto space-y-1 text-[9px]">
                <div className="bg-black/60 border border-cyan-500/15 rounded-lg py-1 px-1.5 text-center">
                  <span className="text-slate-300 font-semibold">Pot: </span>
                  <span className="text-amber-300 font-mono font-bold">{formatKMB(handPot)}</span>
                </div>

                <div className="bg-black/80 border border-amber-500/20 rounded-lg py-1 px-1.5 text-center">
                  <span className="text-slate-300 font-semibold">Mine: </span>
                  <span className="text-amber-300 font-mono font-bold">{formatKMB(userBetOnHand)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* WINNING CELEBRATION POPUP MATCHING VIDEO */}
      {win.show && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative flex flex-col items-center bg-slate-900/90 border-2 border-amber-400/80 rounded-3xl p-6 shadow-[0_0_50px_rgba(245,158,11,0.6)] text-center animate-scale-in">
            {/* Top Cards Graphic */}
            <div className="flex gap-1 text-2xl mb-1">
              <span>🎴</span>
              <span>👑</span>
              <span>🎴</span>
            </div>
            
            {/* Red WIN Ribbon */}
            <div className="bg-gradient-to-r from-red-600 via-rose-500 to-red-600 text-white font-black text-xl px-8 py-1 rounded-full shadow-lg tracking-widest my-1 border border-red-300">
              WIN
            </div>

            {/* Total Win Amount in Big Gold Text */}
            <div className="text-4xl font-mono font-black text-amber-300 my-2 drop-shadow-[0_2px_12px_rgba(245,158,11,0.9)]">
              {win.amount.toLocaleString()}
            </div>
          </div>
          <WinCelebration amount={win.amount} />
        </div>
      )}

      {/* 5. BOTTOM CONTROL BAR */}
      <div className="bg-black/90 border-t border-cyan-500/20 p-2 flex flex-col gap-2 shrink-0">
        {/* Chip Selection Row */}
        <div className="flex items-center justify-center gap-3 px-2">
          {chipOptions.map((c) => {
            const isSelected = selectedChip === c;
            const style = getChipStyle(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => setSelectedChip(c)}
                disabled={phase !== "betting"}
                className={`flex flex-col items-center justify-center rounded-full w-10 h-10 border-2 bg-gradient-to-b ${style.bg} ${style.border} text-black font-black transition-all cursor-pointer ${
                  isSelected
                    ? "scale-110 ring-4 ring-yellow-300 shadow-xl -translate-y-1 z-10"
                    : "opacity-80 hover:opacity-100"
                } disabled:opacity-40 disabled:cursor-default`}
              >
                <span className="text-[9px] font-mono leading-none drop-shadow">
                  {style.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom Actions Row */}
        <div className="flex items-center justify-between px-2 pt-1 border-t border-white/5">
          {/* Bottom Left Balance */}
          <div className="relative flex items-center gap-1.5 text-xs text-amber-300 font-mono font-bold">
            <span className="text-sm">🪙</span>
            <span>{balance.toLocaleString()}</span>
            {floatingWinText && (
              <span className="absolute -top-4 left-4 text-emerald-400 font-mono font-black text-xs animate-bounce">
                {floatingWinText}
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPlayersModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-cyan-500/20 text-[10px] font-bold text-cyan-200 transition cursor-pointer"
            >
              <Users className="w-3 h-3 text-cyan-400" />
              <span>players</span>
            </button>

            <button
              type="button"
              onClick={handleRepeatBets}
              disabled={phase !== "betting" || (lastBets.A === 0 && lastBets.B === 0 && lastBets.C === 0)}
              className="px-3.5 py-1 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-[10px] font-black transition cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-default active:scale-95 uppercase tracking-wider"
            >
              AGAIN
            </button>
          </div>
        </div>
      </div>

      {/* PLAYERS LIST MODAL */}
      {showPlayersModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPlayersModal(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-slate-900 border border-cyan-500/30 p-4 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
                <Users className="w-4 h-4" />
                <span>Online Players (186)</span>
              </div>
              <button
                onClick={() => setShowPlayersModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
              {[
                { name: "King_Gamer", bet: "100k", hand: "Player A" },
                { name: "Lucky_Star", bet: "50k", hand: "Player B" },
                { name: "Royal_Flush", bet: "300k", hand: "Player A" },
                { name: "Queen_99", bet: "10k", hand: "Player C" },
                { name: "Pro_Patti", bet: "500k", hand: "Player B" },
              ].map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800"
                >
                  <span className="font-semibold text-slate-200">{p.name}</span>
                  <div className="text-right">
                    <span className="text-amber-300 font-mono font-bold">🪙 {p.bet}</span>
                    <span className="text-[10px] text-slate-400 block">{p.hand}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
