import { tickerSymbols } from "@/lib/mockData";

export const TickerTape = () => {
  // Duplicate the list so the CSS keyframes can loop seamlessly via -50% translateX.
  const items = [...tickerSymbols, ...tickerSymbols];
  return (
    <div className="w-full overflow-hidden border-b border-border bg-card/60 backdrop-blur">
      <div className="ticker-track flex w-max gap-10 py-2.5 font-mono text-xs whitespace-nowrap">
        {items.map((t, i) => {
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
