import { Link2 } from "lucide-react";
import type { Rating } from "@/lib/mockData";

const ratingColor: Record<Rating, { text: string; bg: string; border: string }> = {
  BUY:         { text: "text-success",            bg: "bg-success/5",     border: "border-success/20" },
  HOLD:        { text: "text-warning",            bg: "bg-warning/5",     border: "border-warning/20" },
  SELL:        { text: "text-destructive-strong", bg: "bg-destructive/5", border: "border-destructive/20" },
  SHORT:       { text: "text-destructive-strong", bg: "bg-destructive/5", border: "border-destructive/20" },
  SPECULATIVE: { text: "text-primary",            bg: "bg-primary/5",     border: "border-primary/20" },
};

const qualityDot: Record<string, string> = {
  high: "bg-success", medium: "bg-warning", low: "bg-muted-foreground",
};

function fmtSalary(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function currencySymbol(code?: string): string {
  if (code === "EUR") return "€";
  if (code === "GBP") return "£";
  return "$";
}

interface Props {
  rating: Rating;
  ratingNote: string;
  company: string;
  role: string;
  dataQuality?: string;
  sourceCount: number;
  dataSourcesHit?: number;
  mode: "new" | "current";
  onShare: () => void;
  copied: boolean;
  onBack: () => void;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
}

export const VerdictCard = ({
  rating, ratingNote, company, role, dataQuality, sourceCount, dataSourcesHit,
  mode, onShare, copied, onBack,
  salaryMin, salaryMax, salaryCurrency,
}: Props) => {
  const c = ratingColor[rating] ?? ratingColor.HOLD;
  const dq = dataQuality ?? "low";

  return (
    <div className={`relative flex flex-col rounded-2xl border ${c.border} ${c.bg} p-5 animate-fade-in`}>
      {/* Mode badge + company */}
      <div className="flex flex-col gap-1 mb-4">
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground border border-muted-foreground/30 rounded px-1.5 py-0.5 w-fit">
          {mode === "new" ? "NEW OFFER" : "CURRENT ROLE"}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground leading-tight">{company}</span>
        <span className="font-mono text-[9px] text-muted-foreground/70 leading-tight truncate">{role}</span>
      </div>

      {/* Rating word */}
      <div
        className={`font-mono font-bold leading-none tracking-tight ${c.text} text-[64px] md:text-[72px] animate-verdict-in`}
        style={{ animationDelay: "100ms" }}
      >
        {rating}
      </div>

      {/* One-line verdict */}
      <p className="mt-3 text-[13px] text-foreground/85 leading-snug line-clamp-3">
        {ratingNote}
      </p>

      {/* Salary range */}
      {salaryMin && (
        <div className="mt-2 font-mono text-[11px] text-success">
          {currencySymbol(salaryCurrency)}{fmtSalary(salaryMin)}
          {salaryMax ? ` – ${fmtSalary(salaryMax)}` : ""}
          {salaryCurrency ? ` ${salaryCurrency}` : ""}
        </div>
      )}

      <div className="flex-1" />

      {/* Data quality + source count with tooltip */}
      <div className="mt-4 relative group cursor-default w-fit">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${qualityDot[dq]}`} />
          <span className="uppercase tracking-wider">{dq}</span>
          <span>·</span>
          <span>{sourceCount} sources</span>
        </div>
        <div className="absolute left-0 bottom-[calc(100%+6px)] z-30 w-52 rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-foreground/85 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-lg whitespace-nowrap">
          {dataSourcesHit != null
            ? `${dataSourcesHit}/13 data sources confirmed`
            : `${sourceCount} source signals retrieved`}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onShare}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card/60 px-2 py-1.5 font-mono text-[10px] hover:border-primary/40 hover:text-primary transition"
        >
          <Link2 className="h-3 w-3" />
          {copied ? "Copied!" : "Share"}
        </button>
        <button
          onClick={onBack}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1.5 font-mono text-[10px] hover:border-primary/40 hover:text-primary transition"
        >
          ← Back
        </button>
      </div>
    </div>
  );
};
