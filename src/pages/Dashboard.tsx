import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AppTopbar } from "@/components/AppTopbar";
import { TickerTape } from "@/components/TickerTape";
import { VerdictCard } from "@/components/dashboard/VerdictCard";
import { CareerChart } from "@/components/dashboard/CareerChart";
import { SignalPanel } from "@/components/dashboard/SignalPanel";
import { MetricsStrip } from "@/components/dashboard/MetricsStrip";
import { BullBearSection } from "@/components/dashboard/BullBearSection";
import { AlternativeCards } from "@/components/dashboard/AlternativeCards";
import { SourceList } from "@/components/dashboard/SourceList";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { getJobAnalysis, mockAnalysis, type JobAnalysis, type SourceItem } from "@/lib/mockData";

function extractSalaryFromSources(
  sources: SourceItem[],
): { salaryMin: number; salaryMax: number; salaryCurrency: string } | null {
  // Matches: "€72K–€122K+", "$193K–$1.28M+", "£60K-£90K"
  const re = /([€$£])(\d[\d,.]+[KMkm]?)\s*[–\-]+\s*[€$£]?(\d[\d,.]+[KMkm+]+)/i;
  for (const src of sources) {
    const m = src.title?.match(re);
    if (!m) continue;
    const sym = m[1];
    const parse = (s: string) => {
      const n = parseFloat(s.replace(/,/g, "").replace(/[+]/g, ""));
      if (/[Mm]/.test(s)) return n * 1_000_000;
      if (/[Kk]/.test(s)) return n * 1_000;
      return n;
    };
    const min = parse(m[2]);
    const max = parse(m[3]);
    if (min > 0 && max > 0) {
      return {
        salaryMin: min,
        salaryMax: max,
        salaryCurrency: sym === "€" ? "EUR" : sym === "£" ? "GBP" : "USD",
      };
    }
  }
  return null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state || {}) as { company?: string; role?: string; mode?: "new" | "current"; data?: JobAnalysis };

  const coldCompany = searchParams.get("company") || state.company || "N26";
  const coldRole    = searchParams.get("role")    || state.role    || "Product Manager";
  const mode        = state.mode ?? "new";

  const [data, setData]         = useState<JobAnalysis>(state.data || mockAnalysis);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    if (state.data) return;
    let cancelled = false;
    getJobAnalysis({ company: coldCompany, role: coldRole })
      .then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Salary: prefer debugSignals, then fallback from source titles, then top-level
  const fallbackSalary = !ds?.salaryMin ? extractSalaryFromSources(data.sources) : null;
  const salaryMin = ds?.salaryMin ?? fallbackSalary?.salaryMin ?? data.salaryMin;
  const salaryMax = ds?.salaryMax ?? fallbackSalary?.salaryMax ?? data.salaryMax;
  const salaryCurrency = ds?.salaryCurrency ?? fallbackSalary?.salaryCurrency ?? data.salaryCurrency;

  const priceChangePct = data.priceChangePct;
  const ticker = data.ticker;
  const highlightTicker = {
    sym: ticker,
    pct: parseFloat(priceChangePct.toFixed(1)),
    rating: data.rating,
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TickerTape highlight={highlightTicker} />
      <AppTopbar />

      <main className="container py-6 space-y-4">

        {/* TOP ZONE — 3 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_210px] gap-4 items-stretch">
          <VerdictCard
            rating={data.rating}
            ratingNote={data.ratingNote}
            company={data.company}
            role={data.role}
            dataQuality={data.dataQuality}
            sourceCount={data.sources.length}
            dataSourcesHit={ds?.dataSourcesHit}
            mode={mode}
            onShare={handleShare}
            copied={copied}
            onBack={() => navigate("/")}
            salaryMin={salaryMin ?? undefined}
            salaryMax={salaryMax ?? undefined}
            salaryCurrency={salaryCurrency ?? undefined}
          />
          <CareerChart data={data.priceSeries} annotations={data.chartAnnotations} />
          <SignalPanel signals={data.signals} debugSignals={ds} />
        </div>

        {/* INSOLVENCY WARNING — only shown when Handelsregister flags it */}
        {ds?.handelsregisterInsolvency && (
          <div
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-start gap-3 animate-fade-in"
            style={{ animationFillMode: "both" }}
          >
            <span className="font-mono text-destructive-strong text-base mt-0.5">⚠</span>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-destructive-strong mb-1">
                Insolvency Risk Detected
              </div>
              <p className="text-[13px] text-foreground/85 leading-snug">
                Handelsregister records indicate insolvency proceedings for {data.company}.
                Exercise extreme caution — this significantly elevates volatility and threatens role stability.
              </p>
            </div>
          </div>
        )}

        {/* METRICS STRIP */}
        <MetricsStrip
          debugSignals={ds}
          salaryMin={salaryMin ?? undefined}
          salaryMax={salaryMax ?? undefined}
          salaryCurrency={salaryCurrency ?? undefined}
        />

        {/* BULL / BEAR */}
        <BullBearSection bullCase={data.bullCase} bearCase={data.bearCase} />

        {/* RECOMMENDATION */}
        <div
          className="rounded-2xl border border-warning/30 bg-warning/5 p-6 animate-fade-in"
          style={{ animationDelay: "900ms", animationFillMode: "both" }}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-warning mb-3">
            {mode === "new" ? "Our Recommendation" : "Our Verdict"}
          </div>
          <p className="text-sm text-foreground/95 leading-relaxed">{data.recommendation}</p>
        </div>

        {/* ALTERNATIVES */}
        <AlternativeCards alternatives={data.alternatives} mode={mode} />

        {/* DEEP INTELLIGENCE — collapsible */}
        <div className="rounded-2xl border border-card-border bg-card overflow-hidden">
          <button
            onClick={() => setAnalysisOpen((o) => !o)}
            className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition"
          >
            <span className="text-sm font-medium">Deep Intelligence</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              Chart · Company · Market · Signals
              {analysisOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </span>
          </button>

          {analysisOpen && (
            <div className="border-t border-border divide-y divide-border/50">

              {/* Career Price Index chart */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium">Career Price Index · 12 mo</h3>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {data.priceSeries[0]?.price.toFixed(1)} → {data.priceSeries.at(-1)?.price.toFixed(1)}
                  </p>
                </div>
                <PriceChart data={data.priceSeries} />
              </div>

              {/* Company Profile */}
              <div className="p-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                  Company Profile
                </div>
                {ds?.companySummary?.trim() && (
                  <p className="text-sm text-foreground/85 leading-relaxed mb-4">{ds.companySummary}</p>
                )}
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
                  {ds?.ycStatus && ds.ycStatus !== "unknown" && (
                    <span>YC: {ds.ycStatus}{ds.ycBatch ? ` · ${ds.ycBatch}` : ""}</span>
                  )}
                  {ds?.ycTeamSize != null && <span>Team: ~{ds.ycTeamSize}</span>}
                  {ds?.ycIndustry && <span>Industry: {ds.ycIndustry}</span>}
                  {ds?.handelsregisterFounded && <span>Founded: {ds.handelsregisterFounded}</span>}
                  {ds?.handelsregisterInsolvency && (
                    <span className="text-destructive-strong">⚠ Insolvency risk</span>
                  )}
                  {ds?.cultureScore != null && <span>Culture: {ds.cultureScore}/5</span>}
                  {ds?.hnJobPostCount != null && <span>HN posts: {ds.hnJobPostCount}</span>}
                  {ds?.secFilingCount != null && <span>SEC filings: {ds.secFilingCount}</span>}
                  {ds?.bundesagenturVacancies != null && (
                    <span>DE market vacancies: {ds.bundesagenturVacancies}</span>
                  )}
                  {ds?.dataSourcesHit != null && <span>Sources hit: {ds.dataSourcesHit}/13</span>}
                </div>
              </div>

              {/* Market Intelligence — Gemini grounding + market context */}
              {(ds?.groundingSummary?.trim() || (ds?.bundesagenturTopEmployers?.length ?? 0) > 0 || (ds?.hnTopJobTitles?.length ?? 0) > 0) && (
                <div className="p-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                    Market Intelligence
                  </div>
                  {ds?.groundingSummary?.trim() && (
                    <p className="text-sm text-foreground/85 leading-relaxed mb-4">{ds.groundingSummary}</p>
                  )}
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
                    {(ds?.bundesagenturTopEmployers?.length ?? 0) > 0 && (
                      <span>Top DE employers: {ds!.bundesagenturTopEmployers!.slice(0, 3).join(" · ")}</span>
                    )}
                    {(ds?.hnTopJobTitles?.length ?? 0) > 0 && (
                      <span>HN titles: {ds!.hnTopJobTitles!.slice(0, 3).map(t => `"${t}"`).join(" · ")}</span>
                    )}
                  </div>
                </div>
              )}

              {/* News Signals */}
              {(ds?.newsSignals?.length ?? 0) > 0 && (
                <div className="p-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                    News Signals
                  </div>
                  <ul className="space-y-2">
                    {ds!.newsSignals!.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground/80 leading-snug">
                        <span className="text-primary mt-0.5 flex-shrink-0">·</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hiring & Compensation */}
              {(ds?.hiringSignals?.length ?? 0) > 0 && (
                <div className="p-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                    Hiring &amp; Compensation
                  </div>
                  <ul className="space-y-2">
                    {ds!.hiringSignals!.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground/80 leading-snug">
                        <span className="text-success mt-0.5 flex-shrink-0">·</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risk Factors */}
              {(ds?.riskSignals?.length ?? 0) > 0 && (
                <div className="p-6">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                    Risk Factors
                  </div>
                  <ul className="space-y-2">
                    {ds!.riskSignals!.map((s, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground/80 leading-snug">
                        <span className="text-destructive-strong mt-0.5 flex-shrink-0">·</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}
        </div>

        {/* SOURCES — always visible, below Deep Intelligence */}
        {data.sources.length > 0 && (
          <div
            className="rounded-2xl border border-card-border bg-card p-6 animate-fade-in"
            style={{ animationFillMode: "both", animationDelay: "1200ms" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Sources</h3>
              <span className="font-mono text-[10px] text-muted-foreground">{data.sources.length} signals</span>
            </div>
            <SourceList items={data.sources} />
          </div>
        )}

      </main>

      <footer className="mt-8 border-t border-border py-6 font-mono text-[11px] text-muted-foreground flex flex-wrap justify-between gap-2 container">
        <span>$JOB Career Markets™ · AI-assisted analysis. Not career advice.</span>
        <span>v0.3 · {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
};

export default Dashboard;
