// @ts-nocheck
interface ResultItem {
  id: string | number;
  label: string;        // "17", "🍎", "A♠"
  color?: string;       // tailwind bg class or hex
  win?: boolean;
}

interface ResultsHistoryBarProps {
  items: ResultItem[];
  max?: number;
  title?: string;
}

/**
 * Horizontal pill strip of recent results (newest on the left).
 * Used across all three games as a "last N rounds" feel.
 */
export default function ResultsHistoryBar({
  items,
  max = 10,
  title = "Recent",
}: ResultsHistoryBarProps) {
  const shown = items.slice(0, max);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px] uppercase tracking-widest text-white/60">
          {title}
        </span>
        <span className="text-[10px] text-white/40">last {max}</span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
        {shown.length === 0 && (
          <span className="text-xs text-white/40 italic">No rounds yet</span>
        )}
        {shown.map((it) => {
          const isHex = it.color?.startsWith("#");
          return (
            <div
              key={it.id}
              className={`shrink-0 min-w-[28px] h-7 px-2 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm border border-white/10 ${
                !isHex ? it.color ?? "bg-white/10" : ""
              } ${it.win ? "ring-2 ring-yellow-300" : ""}`}
              style={isHex ? { backgroundColor: it.color } : undefined}
              title={it.label}
            >
              {it.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
