interface Props {
  bullCase: string[];
  bearCase: string[];
}

export const BullBearSection = ({ bullCase, bearCase }: Props) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="rounded-2xl border border-success/25 bg-success/5 p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-success mb-3">Bull Case</div>
      <ul className="space-y-2">
        {bullCase.map((b, i) => (
          <li
            key={i}
            className="flex gap-2 text-sm text-foreground/85 animate-slide-up"
            style={{ animationDelay: `${600 + i * 60}ms`, animationFillMode: "both" }}
          >
            <span className="text-success shrink-0 mt-0.5">▲</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
    <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5">
      <div className="font-mono text-[10px] uppercase tracking-widest text-destructive-strong mb-3">Bear Case</div>
      <ul className="space-y-2">
        {bearCase.map((b, i) => (
          <li
            key={i}
            className="flex gap-2 text-sm text-foreground/85 animate-slide-up"
            style={{ animationDelay: `${600 + i * 60}ms`, animationFillMode: "both" }}
          >
            <span className="text-destructive-strong shrink-0 mt-0.5">▼</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  </div>
);
