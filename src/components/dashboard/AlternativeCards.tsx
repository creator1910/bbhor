import { RatingBadge } from "@/components/dashboard/RatingBadge";
import type { Alternative } from "@/lib/mockData";

interface Props {
  alternatives: Alternative[];
  mode: "new" | "current";
}

export const AlternativeCards = ({ alternatives, mode }: Props) => (
  <div>
    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3 px-1">
      Alternative paths
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {alternatives.map((alt, i) => (
        <div
          key={alt.title}
          className="flex flex-col gap-2.5 rounded-xl border border-card-border bg-card px-4 py-4 hover:border-primary/30 transition-colors animate-fade-in min-h-[100px]"
          style={{ animationDelay: `${1100 + i * 80}ms`, animationFillMode: "both" }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <RatingBadge rating={alt.rating} size="sm" />
            <div className="text-sm font-medium leading-tight">{alt.title}</div>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-widest border border-muted-foreground/25 text-muted-foreground rounded px-1.5 py-0.5">
              {alt.subtitle}
            </span>
          </div>
          {alt.note && (
            <p className="text-[13px] text-foreground/75 leading-snug">{alt.note}</p>
          )}
        </div>
      ))}
    </div>
  </div>
);
