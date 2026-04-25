import { useState, useEffect, useRef } from "react";
import type { SignalScore, JobAnalysis } from "@/lib/mockData";

function useCountUp(target: number, duration = 800, delay = 300): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const timeout = setTimeout(() => {
      let start: number | null = null;
      const step = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / duration, 1);
        setVal(Math.round(progress * target));
        if (progress < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);
  return val;
}

function barColor(score: number): string {
  if (score >= 70) return "hsl(142, 71%, 45%)";
  if (score >= 40) return "hsl(38, 92%, 50%)";
  return "hsl(0, 84%, 60%)";
}

function textColor(score: number): string {
  if (score >= 70) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-destructive-strong";
}

function getTooltip(signal: SignalScore, debugSignals?: JobAnalysis["debugSignals"]): string {
  if (!debugSignals) return "";
  const label = signal.label.toLowerCase();
  if (label.includes("momentum")) return debugSignals.newsSignals?.[0] ?? debugSignals.companySummary ?? "";
  if (label.includes("salary"))   return debugSignals.hiringSignals?.[0] ?? "";
  if (label.includes("volatility")) return debugSignals.riskSignals?.[0] ?? "";
  if (label.includes("upside"))   return debugSignals.hiringSignals?.[0] ?? debugSignals.newsSignals?.[0] ?? "";
  return debugSignals.companySummary ?? "";
}

interface SignalRowProps {
  label: string;
  score: number;
  index: number;
  tooltip?: string;
  isComposite?: boolean;
}

const SignalRow = ({ label, score, index, tooltip, isComposite }: SignalRowProps) => {
  const [ready, setReady] = useState(false);
  const displayed = useCountUp(score, 800, 300 + index * 80);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 200 + index * 80);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div className={`relative group ${isComposite ? "pt-3 mt-1 border-t border-border/50" : ""}`}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className={`font-mono uppercase tracking-wider ${isComposite ? "text-[10px] text-foreground/80" : "text-[9px] text-muted-foreground"}`}>
          {label}
        </span>
        <span className={`font-mono font-semibold tabular-nums ${textColor(score)} ${isComposite ? "text-base" : "text-[13px]"}`}>
          {displayed}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            backgroundColor: barColor(score),
            transform: ready ? "scaleX(1)" : "scaleX(0)",
            transformOrigin: "left center",
            transition: "transform 700ms cubic-bezier(0.4, 0, 0.2, 1)",
            transitionDelay: `${200 + index * 80}ms`,
          }}
        />
      </div>

      {/* Styled tooltip */}
      {tooltip && (
        <div className="absolute left-0 bottom-[calc(100%+8px)] z-30 w-64 rounded-lg border border-border bg-card px-3 py-2.5 text-[11px] text-foreground/85 leading-snug opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-lg">
          {tooltip.slice(0, 200)}
        </div>
      )}
    </div>
  );
};

interface Props {
  signals: SignalScore[];
  debugSignals?: JobAnalysis["debugSignals"];
}

export const SignalPanel = ({ signals, debugSignals }: Props) => {
  const composite = Math.round(signals.reduce((s, x) => s + x.score, 0) / signals.length);

  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 flex flex-col gap-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Signals</div>

      <div className="flex flex-col gap-3.5 flex-1">
        {signals.map((s, i) => (
          <SignalRow
            key={s.label}
            label={s.label}
            score={s.score}
            index={i}
            tooltip={getTooltip(s, debugSignals)}
          />
        ))}
        <SignalRow
          label="Composite"
          score={composite}
          index={signals.length}
          isComposite
        />
      </div>
    </div>
  );
};
