import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import { AppTopbar } from "@/components/AppTopbar";
import { TickerTape } from "@/components/TickerTape";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { RatingBadge, ratingStyles } from "@/components/dashboard/RatingBadge";
import { SignalBars } from "@/components/dashboard/SignalBars";
import { SourceList } from "@/components/dashboard/SourceList";
import { getJobAnalysis, mockAnalysis, type JobAnalysis } from "@/lib/mockData";

const formatSalary = (n: number) =>
  `$${(n / 1000).toFixed(1)}K`;

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as { company?: string; role?: string; data?: JobAnalysis };

  // Use data passed from Loading page — only fetch directly if someone hits /dashboard cold
  const [data, setData] = useState<JobAnalysis>(state.data || mockAnalysis);
  const [vote, setVote] = useState<"BUY" | "HOLD" | "SELL" | null>(null);

  useEffect(() => {
    if (state.data) return; // already have real data from the loading page
    let cancelled = false;
    getJobAnalysis({ company: state.company || "N26", role: state.role || "Product Manager" })
      .then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const positive = data.salaryChangePct >= 0;
  const r = ratingStyles[data.rating];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TickerTape />
      <AppTopbar
        right={
          <button
            onClick={() => navigate("/")}
            className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-2.5 py-1 hover:border-primary/40 hover:text-primary transition"
          >
            New quote
          </button>
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
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Annual Salary Price</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-3xl md:text-4xl font-semibold tabular-nums">{formatSalary(data.salary)}</span>
                      <span className={`inline-flex items-center font-mono text-sm ${positive ? "text-success" : "text-destructive-strong"}`}>
                        {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        {positive ? "+" : ""}{data.salaryChangePct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Market Cap</div>
                    <div className="mt-1 font-mono text-lg text-foreground">{data.marketCap}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Analyst Consensus</div>
                    <div className="mt-1 font-mono text-lg text-warning">{data.consensus}</div>
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
                  <h2 className="text-sm font-medium">Synthetic Price · 12 mo</h2>
                  <p className="font-mono text-[11px] text-muted-foreground">{formatSalary(data.priceSeries[0].price)} → {formatSalary(data.priceSeries.at(-1)!.price)}</p>
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
                <span className="font-mono text-[10px] text-muted-foreground">$JOB-AI · 04/25</span>
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

            {/* Alternatives */}
            <div>
              <h2 className="mb-3 px-1 text-sm font-medium">Alternative Trades</h2>
              <div className="grid gap-4 md:grid-cols-3">
                {data.alternatives.map((alt) => {
                  const isPositive = alt.delta.trim().startsWith("+");
                  const isNeutralDelta = alt.delta.trim().startsWith("±");
                  const deltaClass = isNeutralDelta
                    ? "text-warning"
                    : isPositive
                    ? "text-success"
                    : "text-destructive-strong";
                  return (
                    <div key={alt.title} className="group rounded-2xl border border-card-border bg-card p-5 transition hover:border-primary/30 hover:shadow-orange-glow">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{alt.subtitle}</span>
                        <RatingBadge rating={alt.rating} />
                      </div>
                      <h3 className="mt-3 text-base font-medium">{alt.title}</h3>
                      <div className={`mt-1 font-mono text-sm ${deltaClass}`}>{alt.delta}</div>
                      <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{alt.note}</p>
                    </div>
                  );
                })}
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
          <span>$JOB Career Markets™ · Data is synthetic. Not investment advice.</span>
          <span>v0.1 · {new Date().getFullYear()}</span>
        </footer>
      </main>
    </div>
  );
};

export default Dashboard;
