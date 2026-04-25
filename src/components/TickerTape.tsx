import { tickerSymbols } from "@/lib/mockData";

interface HighlightTicker {
  sym: string;
  pct: number;
  rating?: string;
}

interface Props {
  highlight?: HighlightTicker;
}

export const TickerTape = ({ highlight }: Props) => {
  const base = [...tickerSymbols, ...tickerSymbols];

  return (
    <div className="w-full overflow-hidden border-b border-border bg-card/60 backdrop-blur">
      <div className="ticker-track flex w-max gap-10 py-2.5 font-mono text-xs whitespace-nowrap">
        {/* Highlighted analyzed ticker — appears first, styled differently */}
        {highlight && (
          <>
            <div className="flex items-center gap-2 pl-4">
              <span className="text-primary font-semibold tracking-wider">{highlight.sym}</span>
              {highlight.rating && (
                <span className="text-[9px] border border-primary/40 rounded px-1 py-px text-primary uppercase">
                  {highlight.rating}
                </span>
              )}
              <span className={highlight.pct >= 0 ? "text-success" : "text-destructive-strong"}>
                {highlight.pct >= 0 ? "+" : ""}{highlight.pct.toFixed(1)}%
              </span>
              <span className="text-border">|</span>
            </div>
          </>
        )}
        {base.map((t, i) => {
          const positive = t.pct >= 0;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-muted-foreground tracking-wider">{t.sym}</span>
              <span className={positive ? "text-success" : "text-destructive-strong"}>
                {positive ? "+" : ""}
                {t.pct.toFixed(1)}%
              </span>
              <span className="text-border">|</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
