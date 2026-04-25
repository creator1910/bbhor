import { RatingBadge } from "@/components/dashboard/RatingBadge";
import type { Alternative } from "@/lib/mockData";

const MODE_NOTES: Record<string, Record<string, string>> = {
  new: {
    Low:    "Stable choice — take it if it fits your goals",
    Medium: "Worth negotiating before committing",
    High:   "High upside, high variance — know your risk tolerance",
  },
  current: {
    Low:    "Stay put — stability beats uncertainty right now",
    Medium: "Time to explore options discreetly",
    High:   "Bold move — make sure you're ready",
  },
};

interface Props {
  recommendation: string;
  alternatives: Alternative[];
  mode: "new" | "current";
}

export const MoveSection = ({ recommendation, alternatives, mode }: Props) => {
  const modeNotes = MODE_NOTES[mode] ?? MODE_NOTES.new;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] animate-fade-in" style={{ animationDelay: "300ms" }}>
      {/* Recommendation */}
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-6 shadow-card-elevated">
        <div className="font-mono text-[10px] uppercase tracking-widest text-warning mb-3">
          {mode === "new" ? "Our recommendation" : "Our verdict"}
        </div>
        <p className="text-sm text-foreground/95 leading-relaxed">{recommendation}</p>
      </div>

      {/* Alternatives */}
      <div className="space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground px-1">
          Alternative paths
        </div>
        {alternatives.map((alt) => (
          <div
            key={alt.title}
            className="flex items-start gap-3 rounded-xl border border-card-border bg-card px-4 py-3 hover:border-primary/30 transition-colors"
          >
            <div className="pt-0.5">
              <RatingBadge rating={alt.rating} size="sm" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium leading-tight">{alt.title}</div>
              <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {modeNotes[alt.subtitle.replace(" risk", "")] ?? alt.note}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
