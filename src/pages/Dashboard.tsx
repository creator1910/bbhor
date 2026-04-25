import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AppTopbar } from "@/components/AppTopbar";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { SignalBars } from "@/components/dashboard/SignalBars";
import { SourceList } from "@/components/dashboard/SourceList";
import { VerdictHero } from "@/components/dashboard/VerdictHero";
import { CriticalFactors } from "@/components/dashboard/CriticalFactors";
import { MoveSection } from "@/components/dashboard/MoveSection";
import { getJobAnalysis, mockAnalysis, type JobAnalysis } from "@/lib/mockData";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state || {}) as { company?: string; role?: string; mode?: "new" | "current"; data?: JobAnalysis };

  const coldCompany = searchParams.get("company") || state.company || "N26";
  const coldRole    = searchParams.get("role")    || state.role    || "Product Manager";
  const mode        = state.mode ?? "new";

  const [data, setData]           = useState<JobAnalysis>(state.data || mockAnalysis);
  const [fullOpen, setFullOpen]   = useState(false);
  const [copied, setCopied]       = useState(false);

  useEffect(() => {
    if (state.data) return;
    let cancelled = false;
    getJobAnalysis({ company: coldCompany, role: coldRole })
      .then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update document title so share previews show the rating
  useEffect(() => {
    document.title = `${data.rating} — ${data.company} ${data.role} · $JOB`;
    return () => { document.title = "$JOB — Trade your job like an asset"; };
  }, [data.rating, data.company, data.role]);

  const handleShare = () => {
    const url = new URL(window.location.href);
    url.pathname = "/dashboard";
    url.search = `?company=${encodeURIComponent(data.company)}&role=${encodeURIComponent(data.role)}`;
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const ds = data.debugSignals;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppTopbar />

      <main className="container py-8 space-y-5">

        {/* 1 — VERDICT HERO */}
        <VerdictHero
          rating={data.rating}
          ratingNote={data.ratingNote}
          company={data.company}
          role={data.role}
          dataQuality={data.dataQuality}
          sourceCount={data.sources.length}
          mode={mode}
          onShare={handleShare}
          copied={copied}
          onBack={() => navigate("/")}
        />

        {/* 2 — 3 CRITICAL FACTORS */}
        <CriticalFactors
          signals={data.signals}
          debugSignals={ds}
          bullCase={data.bullCase}
          bearCase={data.bearCase}
        />

        {/* 3 — YOUR MOVE */}
        <MoveSection
          recommendation={data.recommendation}
          alternatives={data.alternatives}
          mode={mode}
        />

        {/* 4 — SIGNAL BREAKDOWN */}
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-card-elevated">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium">Signal Breakdown</h2>
            <span className="font-mono text-[10px] text-muted-foreground">/ 100</span>
          </div>
          <SignalBars signals={data.signals} />
        </div>

        {/* 5 — FULL ANALYSIS (collapsible) */}
        <div className="rounded-2xl border border-card-border bg-card shadow-card-elevated overflow-hidden">
          <button
            onClick={() => setFullOpen((o) => !o)}
            className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition"
          >
            <span className="text-sm font-medium">Full Analysis</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              Career chart · Sources · Company context
              {fullOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
          </button>

          {fullOpen && (
            <div className="border-t border-border">
              {/* Chart */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium">Career Price Index · 12 mo</h3>
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
                <PriceChart data={data.priceSeries} />
              </div>

              {/* Bull / Bear detail */}
              <div className="p-6 border-b border-border grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-success/25 bg-success/5 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-success mb-2">Bull Case</div>
                  <ul className="space-y-2 text-sm text-foreground/90">
                    {data.bullCase.map((b, i) => (
                      <li key={i} className="flex gap-2"><span className="text-success">▲</span>{b}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-destructive-strong mb-2">Bear Case</div>
                  <ul className="space-y-2 text-sm text-foreground/90">
                    {data.bearCase.map((b, i) => (
                      <li key={i} className="flex gap-2"><span className="text-destructive-strong">▼</span>{b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Company context */}
              {ds?.companySummary && (
                <div className="p-6 border-b border-border">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Company Context</div>
                  <p className="text-sm text-foreground/85 leading-relaxed">{ds.companySummary}</p>
                  {ds.dataSourcesHit != null && (
                    <div className="mt-3 font-mono text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      {ds.ycStatus && ds.ycStatus !== "unknown" && <span>YC: {ds.ycStatus}</span>}
                      {ds.hnJobPostCount != null && <span>HN posts: {ds.hnJobPostCount}</span>}
                      {ds.secFilingCount != null && <span>SEC filings: {ds.secFilingCount}</span>}
                      {ds.bundesagenturVacancies != null && <span>DE vacancies: {ds.bundesagenturVacancies}</span>}
                      {ds.cultureScore != null && <span>Culture: {ds.cultureScore}/5</span>}
                      <span>Sources hit: {ds.dataSourcesHit}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Sources */}
              {data.sources.length > 0 && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium">Sources</h3>
                    <span className="font-mono text-[10px] text-muted-foreground">{data.sources.length} signals</span>
                  </div>
                  <SourceList items={data.sources} />
                </div>
              )}
            </div>
          )}
        </div>

      </main>

      <footer className="mt-8 border-t border-border py-6 font-mono text-[11px] text-muted-foreground flex flex-wrap justify-between gap-2 container">
        <span>$JOB Career Markets™ · AI-assisted analysis. Not career advice.</span>
        <span>v0.2 · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
};

export default Dashboard;
