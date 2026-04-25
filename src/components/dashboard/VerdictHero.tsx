import { Link2 } from "lucide-react";
import type { Rating } from "@/lib/mockData";

const ratingColor: Record<Rating, { text: string; bg: string; glow: string }> = {
  BUY:         { text: "text-success",          bg: "bg-success/5 border-success/20",         glow: "" },
  HOLD:        { text: "text-warning",          bg: "bg-warning/5 border-warning/20",         glow: "bg-gradient-amber-glow" },
  SELL:        { text: "text-destructive-strong", bg: "bg-destructive/5 border-destructive/20", glow: "" },
  SHORT:       { text: "text-destructive-strong", bg: "bg-destructive/5 border-destructive/20", glow: "" },
  SPECULATIVE: { text: "text-primary",          bg: "bg-primary/5 border-primary/20",         glow: "bg-gradient-orange-glow" },
};

const qualityDot: Record<string, string> = {
  high: "bg-success", medium: "bg-warning", low: "bg-muted-foreground",
};

interface Props {
  rating: Rating;
  ratingNote: string;
  company: string;
  role: string;
  dataQuality?: string;
  sourceCount: number;
  mode: "new" | "current";
  onShare: () => void;
  copied: boolean;
  onBack: () => void;
}

export const VerdictHero = ({ rating, ratingNote, company, role, dataQuality, sourceCount, mode, onShare, copied, onBack }: Props) => {
  const c = ratingColor[rating] ?? ratingColor.HOLD;
  const dq = dataQuality ?? "low";

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${c.bg} p-8 md:p-12 animate-fade-in`}>
      {c.glow && (
        <div className={`absolute inset-0 ${c.glow} opacity-60 pointer-events-none`} />
      )}

      <div className="relative">
        {/* Top meta row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground border border-muted-foreground/30 rounded px-2 py-0.5">
              {mode === "new" ? "NEW OFFER" : "CURRENT ROLE"}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {company} · {role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onShare}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 font-mono text-[11px] hover:border-primary/40 hover:text-primary transition"
            >
              <Link2 className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Share"}
            </button>
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 font-mono text-[11px] hover:border-primary/40 hover:text-primary transition"
            >
              ← New quote
            </button>
          </div>
        </div>

        {/* Big rating word */}
        <div className={`mt-8 font-mono font-bold leading-none tracking-tight ${c.text} text-[80px] md:text-[120px] animate-verdict-in`}>
          {rating}
        </div>

        {/* One-line verdict */}
        <p className="mt-4 max-w-2xl text-base md:text-lg text-foreground/90 leading-relaxed">
          {ratingNote}
        </p>

        {/* Data quality metadata */}
        <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${qualityDot[dq]}`} />
          <span className="uppercase tracking-wider">{dq} confidence</span>
          <span>·</span>
          <span>{sourceCount} sources</span>
        </div>
      </div>
    </div>
  );
};
