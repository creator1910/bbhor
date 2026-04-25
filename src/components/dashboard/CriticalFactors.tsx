import type { SignalScore, JobAnalysis } from "@/lib/mockData";

interface Props {
  signals: SignalScore[];
  debugSignals?: JobAnalysis["debugSignals"];
  bullCase: string[];
  bearCase: string[];
}

function scoreColor(score: number): string {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-warning";
  return "bg-destructive";
}

function scoreBorder(score: number): string {
  if (score >= 70) return "border-success/30";
  if (score >= 40) return "border-warning/30";
  return "border-destructive/30";
}

function scoreText(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-destructive-strong";
}

// Match each signal to the best available explanation text
function getExplanation(
  signal: SignalScore,
  debugSignals: JobAnalysis["debugSignals"],
  bullCase: string[],
  bearCase: string[],
  index: number,
): string {
  const ds = debugSignals;
  if (!ds) {
    // Fallback: use bull/bear case bullets
    return signal.score >= 60
      ? (bullCase[index] ?? "")
      : (bearCase[index] ?? "");
  }

  const label = signal.label.toLowerCase();

  if (label.includes("momentum")) {
    return ds.newsSignals?.[0] ?? ds.riskSignals?.[0] ?? bearCase[0] ?? "";
  }
  if (label.includes("salary")) {
    return ds.hiringSignals?.[0] ?? bullCase[1] ?? bullCase[0] ?? "";
  }
  if (label.includes("volatility")) {
    return ds.riskSignals?.[0] ?? bearCase[0] ?? "";
  }
  if (label.includes("upside")) {
    return ds.hiringSignals?.[0] ?? bullCase[0] ?? "";
  }

  // Generic fallback
  return signal.score >= 60
    ? (bullCase[index] ?? ds.companySummary?.slice(0, 120) ?? "")
    : (bearCase[index] ?? ds.riskSignals?.[0] ?? "");
}

export const CriticalFactors = ({ signals, debugSignals, bullCase, bearCase }: Props) => {
  // Pick the 3 most decision-relevant signals (lowest momentum, highest volatility, highest salary)
  const ordered = [...signals].sort((a, b) => {
    const priority = (s: SignalScore) => {
      if (s.label.toLowerCase().includes("momentum")) return 0;
      if (s.label.toLowerCase().includes("salary")) return 1;
      if (s.label.toLowerCase().includes("volatility")) return 2;
      return 3;
    };
    return priority(a) - priority(b);
  });
  const top3 = ordered.slice(0, 3);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {top3.map((signal, i) => {
        const explanation = getExplanation(signal, debugSignals, bullCase, bearCase, i);
        const color = scoreColor(signal.score);
        const border = scoreBorder(signal.score);
        const text = scoreText(signal.score);
        const delay = `delay-[${150 + i * 100}ms]`;

        return (
          <div
            key={signal.label}
            className={`rounded-2xl border ${border} bg-card p-5 shadow-card-elevated animate-slide-up ${delay}`}
          >
            <div className="flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {signal.label}
              </div>
              <div className={`font-mono text-lg font-semibold tabular-nums ${text}`}>
                {signal.score}
                <span className="text-[11px] text-muted-foreground font-normal"> /100</span>
              </div>
            </div>

            {/* Score bar */}
            <div className="mt-3 h-0.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`}
                style={{ width: `${signal.score}%` }}
              />
            </div>

            {/* Explanation */}
            {explanation && (
              <p className="mt-3 text-sm text-foreground/80 leading-snug line-clamp-3">
                {explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
