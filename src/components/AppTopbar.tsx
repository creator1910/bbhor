import { Activity } from "lucide-react";

export const AppTopbar = ({ right }: { right?: React.ReactNode }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="font-mono text-sm font-semibold tracking-tight">
            <span className="text-primary">$JOB</span>
            <span className="text-muted-foreground"> · Career Markets</span>
            <span className="text-muted-foreground/70 text-[10px] align-super">™</span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
          {right}
          <span className="hidden sm:inline">MKT OPEN</span>
          <span className="hidden sm:inline-flex h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
        </div>
      </div>
    </header>
  );
};
