import type { SignalScore } from "@/lib/mockData";

const toneClass: Record<SignalScore["tone"], string> = {
  success: "bg-success",
  primary: "bg-primary",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

const toneText: Record<SignalScore["tone"], string> = {
  success: "text-success",
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive-strong",
};

export const SignalBars = ({ signals }: { signals: SignalScore[] }) => {
  return (
    <div className="space-y-4">
      {signals.map((s) => (
        <div key={s.label}>
          <div className="flex items-baseline justify-between font-mono text-xs">
            <span className="text-muted-foreground tracking-wide uppercase">{s.label}</span>
            <span className={`font-semibold ${toneText[s.tone]}`}>{s.score}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full ${toneClass[s.tone]} transition-all duration-700`}
              style={{ width: `${s.score}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
