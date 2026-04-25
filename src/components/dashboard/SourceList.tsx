import type { SourceItem } from "@/lib/mockData";

const tagStyles: Record<SourceItem["tag"], string> = {
  NEWS:   "bg-primary/15 text-primary border-primary/30",
  FILING: "bg-warning/15 text-warning border-warning/30",
  DATA:   "bg-success/15 text-success border-success/30",
};

const sentimentStyles: Record<SourceItem["sentiment"], string> = {
  bullish: "text-success",
  bearish: "text-destructive-strong",
  neutral: "text-muted-foreground",
};

const sentimentDot: Record<SourceItem["sentiment"], string> = {
  bullish: "bg-success",
  bearish: "bg-destructive",
  neutral: "bg-muted-foreground",
};

export const SourceList = ({ items }: { items: SourceItem[] }) => {
  return (
    <ul className="divide-y divide-border">
      {items.map((item, i) => (
        <li key={i} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${tagStyles[item.tag]}`}>
              {item.tag}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">{item.date}</span>
            <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
              <span className={`h-1.5 w-1.5 rounded-full ${sentimentDot[item.sentiment]}`} />
              <span className={sentimentStyles[item.sentiment]}>{item.sentiment}</span>
            </span>
          </div>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 block text-sm leading-snug text-foreground hover:text-primary transition-colors"
            >
              {item.title}
            </a>
          ) : (
            <p className="mt-1.5 text-sm leading-snug text-foreground">{item.title}</p>
          )}
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.outlet}</p>
        </li>
      ))}
    </ul>
  );
};
