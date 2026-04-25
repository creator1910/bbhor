import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Link2, Sparkles } from "lucide-react";
import { AppTopbar } from "@/components/AppTopbar";
import { TickerTape } from "@/components/TickerTape";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { RatingBadge, ratingStyles } from "@/components/dashboard/RatingBadge";
import { SignalBars } from "@/components/dashboard/SignalBars";
import { SourceList } from "@/components/dashboard/SourceList";
import { streamJobAnalysis, getJobAnalysis, mockAnalysis, type JobAnalysis } from "@/lib/mockData";

const qualityDot: Record<string, string> = {
  high:   "bg-success",
  medium: "bg-warning",
  low:    "bg-muted-foreground",
};
const qualityLabel: Record<string, string> = {
  high:   "HIGH",
  medium: "MEDIUM",
  low:    "LOW",
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state || {}) as { company?: string; role?: string; data?: JobAnalysis };

  const coldCompany = searchParams.get("company") || state.company || "N26";
  const coldRole = searchParams.get("role") || state.role || "Product Manager";

  const [data, setData] = useState<JobAnalysis>(state.data || mockAnalysis);
  const [vote, setVote] = useState<"BUY" | "HOLD" | "SELL" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state.data) return;
    let cancelled = false;
    getJobAnalysis({ company: coldCompany, role: coldRole })
      .then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.pathname = "/dashboard";
    url.search = `?company=${encodeURIComponent(data.company)}&role=${encodeURIComponent(data.role)}`;
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const positive = data.priceChangePct >= 0;
  const r = ratingStyles[data.rating] ?? ratingStyles["HOLD"];
  const dq = data.dataQuality ?? "low";
  const hasSalary = data.salaryMin != null && data.salaryMax != null;
  const ds = data.debugSignals;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TickerTape />
      <AppTopbar
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 hover:border-primary/40 hover:text-primary transition font-mono text-[11px]"
            >
              <Link2 className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Share"}
            </button>
            <button
              onClick={() => navigate("/")}
              className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 hover:border-primary/40 hover:text-primary transition"
            >
              New quote
            </button>
          </div>
        }
      />

      <main className="container py-8">
        {/* TOP HEADER ROW */}
        <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card-elevated">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="font-mono text-4xl md:text-5xl font-semibold text-primary tracking-tight">
                    {data.ticker}
                  </h1>
                  <RatingBadge rating={data.consensus} size="md" />
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <span className="text-foreground">{data.company}</span> · {data.role}
                </p>

                <div className="mt-6 flex flex-wrap items-baseline gap-x-8 gap-y-3">
                  {/* Career Index — replaces the false "Annual Salary Price" */}
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Career Index</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-3xl md:text-4xl font-semibold tabular-nums">{data.priceIndex.toFixed(1)}</span>
                      <span className={`inline-flex items-center font-mono text-sm ${positive ? "text-success" : "text-destructive-strong"}`}>
                        {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        {positive ? "+" : ""}{data.priceChangePct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Salary Range — only shown when real data is available */}
                  {hasSalary && (
                    <div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Salary Range</div>
                      <div className="mt-1 font-mono text-lg text-foreground">
                        {data.salaryCurrency ?? "€"}{(data.salaryMin! / 1000).toFixed(0)}K – {data.salaryCurrency ?? "€"}{(data.salaryMax! / 1000).toFixed(0)}K
                      </div>
                    </div>
                  )}

                  {/* Data Quality */}
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Data Quality</div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-sm">
                      <span className={`h-2 w-2 rounded-full ${qualityDot[dq]}`} />
                      <span className="text-foreground">{qualityLabel[dq]}</span>
                      {ds?.dataSourcesHit != null && (
                        <span className="text-muted-foreground text-[11px]">· {ds.dataSourcesHit} sources</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Glowing rating card */}
          <div className={`relative rounded-2xl border ${r.border} bg-card p-6 overflow-hidden animate-amber-pulse`}>
            <div className="absolute inset-0 bg-gradient-amber-glow opacity-80 pointer-events-none" />
            <div className="relative">
              <div className="font-mono text-[10px] uppercase tracking-widest text-warning/80">$JOB Rating</div>
              <div className={`mt-2 font-mono text-7xl font-bold ${r.text} tracking-tight`}>{r.label}</div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{data.ratingNote}</p>
            </div>
          </div>
        </section>

        {/* BUY / HOLD / SELL prompt */}
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-card-border bg-card/70 p-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm">Would you <span className="text-foreground font-medium">buy your own job</span>?</span>
          </div>
          <div className="flex gap-2">
            {(["BUY", "HOLD", "SELL"] as const).map((v) => {
              const s = ratingStyles[v];
              const active = vote === v;
              return (
                <button
                  key={v}
                  onClick={() => setVote(v)}
                  className={`rounded-lg border px-4 py-2 font-mono text-xs font-semibold tracking-wider transition
                    ${active ? `${s.bg} ${s.text} ${s.border}` : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"}`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </section>

        {/* MAIN GRID */}
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* LEFT */}
          <div className="space-y-6">
            {/* Chart */}
            <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card-elevated">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-medium">Career Price Index · 12 mo</h2>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {data.priceSeries[0]?.price.toFixed(1)} → {data.priceSeries.at(-1)?.price.toFixed(1)}
                  </p>
                </div>
                <div className="flex gap-1 font-mono text-[10px]">
                  {["1M", "3M", "6M", "1Y", "ALL"].map((p, i) => (
                    <button
                      key={p}
                      className={`rounded px-2 py-1 ${i === 3 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <PriceChart data={data.priceSeries} />
              </div>
            </div>

            {/* Analyst memo */}
            <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card-elevated">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Analyst Memo</h2>
                <span className="font-mono text-[10px] text-muted-foreground">$JOB-AI · {new Date().toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-success/25 bg-success/5 p-4">
                  <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-success">
                    <ArrowUpRight className="h-3.5 w-3.5" /> Bull Case
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                    {data.bullCase.map((b, i) => (
                      <li key={i} className="flex gap-2"><span className="text-success">▲</span>{b}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
                  <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-destructive-strong">
                    <ArrowDownRight className="h-3.5 w-3.5" /> Bear Case
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                    {data.bearCase.map((b, i) => (
                      <li key={i} className="flex gap-2"><span className="text-destructive-strong">▼</span>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
                <div className="font-mono text-[11px] uppercase tracking-wider text-warning">Recommendation</div>
                <p className="mt-2 text-sm text-foreground/95 leading-relaxed">{data.recommendation}</p>
              </div>
            </div>

            {/* Signal Details — collapsible */}
            {ds && (
              <div className="rounded-2xl border border-card-border bg-card shadow-card-elevated overflow-hidden">
                <button
                  onClick={() => setDetailsOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition"
                >
                  <span className="text-sm font-medium">Signal Details</span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                    Raw intelligence
                    {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {detailsOpen && (
                  <div className="border-t border-border px-6 pb-6 pt-4 space-y-4">
                    {ds.companySummary && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Company Summary</div>
                        <p className="text-sm text-foreground/90 leading-relaxed">{ds.companySummary}</p>
                      </div>
                    )}
                    {ds.newsSignals && ds.newsSignals.length > 0 && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">News Signals</div>
                        <ul className="space-y-1 text-sm text-foreground/80">
                          {ds.newsSignals.map((s, i) => <li key={i}>· {s}</li>)}
                        </ul>
                      </div>
                    )}
                    {ds.hiringSignals && ds.hiringSignals.length > 0 && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Hiring Signals</div>
                        <ul className="space-y-1 text-sm text-foreground/80">
                          {ds.hiringSignals.map((s, i) => <li key={i}>· {s}</li>)}
                        </ul>
                      </div>
                    )}
                    {ds.riskSignals && ds.riskSignals.length > 0 && (
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Risk Signals</div>
                        <ul className="space-y-1 text-sm text-destructive-strong/80">
                          {ds.riskSignals.map((s, i) => <li key={i}>· {s}</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="font-mono text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-border">
                      {ds.ycStatus && <span>YC: {ds.ycStatus}</span>}
                      {ds.hnJobPostCount != null && <span>HN posts: {ds.hnJobPostCount}</span>}
                      {ds.secFilingCount != null && <span>SEC filings: {ds.secFilingCount}</span>}
                      {ds.bundesagenturVacancies != null && <span>DE vacancies: {ds.bundesagenturVacancies}</span>}
                      {ds.cultureScore != null && <span>Culture score: {ds.cultureScore}/5</span>}
                      {ds.dataSourcesHit != null && <span>Sources hit: {ds.dataSourcesHit}</span>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Alternatives */}
            <div>
              <h2 className="mb-3 px-1 text-sm font-medium">Alternative Trades</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {data.alternatives.map((alt) => (
                  <div key={alt.title} className="group rounded-2xl border border-card-border bg-card p-5 transition hover:border-primary/30 hover:shadow-orange-glow">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{alt.subtitle}</span>
                      <RatingBadge rating={alt.rating} />
                    </div>
                    <h3 className="mt-3 text-base font-medium">{alt.title}</h3>
                    <div className="mt-1 font-mono text-sm text-muted-foreground">{alt.delta}</div>
                    <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{alt.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <aside className="space-y-6">
            <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card-elevated">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Signal Scores</h2>
                <span className="font-mono text-[10px] text-muted-foreground">/ 100</span>
              </div>
              <div className="mt-5">
                <SignalBars signals={data.signals} />
              </div>
            </div>

            <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card-elevated">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Sources</h2>
                <span className="font-mono text-[10px] text-muted-foreground">{data.sources.length} signals</span>
              </div>
              <div className="mt-4">
                <SourceList items={data.sources} />
              </div>
            </div>
          </aside>
        </section>

        <footer className="mt-12 border-t border-border pt-6 font-mono text-[11px] text-muted-foreground flex flex-wrap justify-between gap-2">
          <span>$JOB Career Markets™ · AI-assisted analysis. Not career advice.</span>
          <span>v0.2 · {new Date().getFullYear()}</span>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
