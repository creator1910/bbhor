import type { JobAnalysis } from "@/lib/mockData";

function fmtSalary(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function currencySymbol(code?: string | null): string {
  if (code === "EUR") return "€";
  if (code === "GBP") return "£";
  return "$";
}

interface MetricCardProps {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
  tooltip?: string;
}

const MetricCard = ({ label, value, sub, valueClass = "text-foreground", tooltip }: MetricCardProps) => (
  <div className={`rounded-xl border border-card-border bg-card p-4 ${tooltip ? "relative group cursor-default" : ""}`}>
    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
      {label}
    </div>
    <div className={`font-mono text-xl font-semibold tabular-nums ${valueClass}`}>
      {value}
    </div>
    <div className="font-mono text-[10px] text-muted-foreground mt-0.5">{sub}</div>
    {tooltip && (
      <div className="absolute left-0 bottom-[calc(100%+6px)] z-30 w-64 rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-foreground/85 leading-snug opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-lg">
        {tooltip}
      </div>
    )}
  </div>
);

interface Props {
  debugSignals?: JobAnalysis["debugSignals"];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
}

export const MetricsStrip = ({ debugSignals: ds, salaryMin, salaryMax, salaryCurrency }: Props) => {
  const sym = currencySymbol(ds?.salaryCurrency ?? salaryCurrency);
  const sMin = ds?.salaryMin ?? salaryMin;
  const sMax = ds?.salaryMax ?? salaryMax;
  const sCur = ds?.salaryCurrency ?? salaryCurrency;
  const culture = ds?.cultureScore;
  const hn = ds?.hnJobPostCount;
  const vacancies = ds?.bundesagenturVacancies;
  const secFilings = ds?.secFilingCount;

  const salaryValue = sMin ? `${sym}${fmtSalary(sMin)}–${fmtSalary(sMax ?? sMin)}` : "—";
  const salarySub = sMin ? `${sCur ?? "USD"} · annual` : "data unavailable";
  const salaryClass = sMin ? "text-success" : "text-muted-foreground";

  const cultureValue = culture != null ? `${culture.toFixed(1)} / 5` : "—";
  const cultureSub = culture != null ? "from employee reviews" : "data unavailable";
  const cultureClass = culture == null ? "text-muted-foreground" : culture >= 4 ? "text-success" : culture >= 3 ? "text-warning" : "text-destructive-strong";
  const cultureTooltip = ds?.cultureSummary?.trim() ? ds.cultureSummary.slice(0, 240) : undefined;

  let marketLabel = "MARKET ACTIVITY";
  let marketValue = "—";
  let marketSub = "data unavailable";
  if (hn != null) {
    marketValue = `${hn} posts`;
    marketSub = "Hacker News mentions";
    marketLabel = "COMMUNITY SIGNAL";
  }

  let hiringLabel = "HIRING SIGNAL";
  let hiringValue = "—";
  let hiringSub = "data unavailable";
  if (vacancies != null) {
    hiringValue = `${vacancies.toLocaleString()}`;
    hiringSub = "open DE vacancies";
    hiringLabel = "OPEN ROLES";
  } else if (secFilings != null) {
    hiringValue = `${secFilings}`;
    hiringSub = "SEC filings found";
    hiringLabel = "SEC FILINGS";
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: "400ms", animationFillMode: "both" }}>
      <MetricCard label="SALARY RANGE"   value={salaryValue}  sub={salarySub}  valueClass={salaryClass} />
      <MetricCard label="CULTURE SCORE"  value={cultureValue} sub={cultureSub} valueClass={cultureClass} tooltip={cultureTooltip} />
      <MetricCard label={marketLabel}    value={marketValue}  sub={marketSub} />
      <MetricCard label={hiringLabel}    value={hiringValue}  sub={hiringSub} />
    </div>
  );
};
