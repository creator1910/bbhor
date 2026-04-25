// =====================================================================
// $JOB Career Markets — Data layer
// ---------------------------------------------------------------------
// getJobAnalysis calls the real backend; falls back to mockAnalysis if
// the request fails so the demo never blocks.
// =====================================================================

export type Rating = "BUY" | "HOLD" | "SELL" | "SPECULATIVE";
export type Sentiment = "bullish" | "bearish" | "neutral";
export type SourceTag = "NEWS" | "FILING" | "DATA";

export interface PricePoint { month: string; price: number; }
export interface SignalScore { label: string; score: number; tone: "success" | "primary" | "warning" | "destructive"; }
export interface SourceItem { tag: SourceTag; title: string; outlet: string; sentiment: Sentiment; date: string; }
export interface Alternative { title: string; subtitle: string; rating: Rating; delta: string; note: string; }

export interface JobAnalysis {
  ticker: string;
  company: string;
  role: string;
  salary: number;
  salaryChangePct: number;
  marketCap: string;
  consensus: Rating;
  rating: Rating;
  ratingNote: string;
  priceSeries: PricePoint[];
  bullCase: string[];
  bearCase: string[];
  recommendation: string;
  signals: SignalScore[];
  sources: SourceItem[];
  alternatives: Alternative[];
}

// Backend response shape (POST /api/analyze-job-stock)
interface BackendResponse {
  ticker: string;
  rating: "BUY" | "HOLD" | "SELL" | "SHORT";
  oneLineVerdict: string;
  scores: { momentum: number; salaryYield: number; volatility: number; upside: number };
  chartData: { month: string; price: number }[];
  bullCase: string[];
  bearCase: string[];
  recommendation: string;
  alternatives: { label: string; description: string; risk: "Low" | "Medium" | "High" }[];
  sources: { title: string; url: string; snippet: string }[];
  debugSignals: { companySummary: string; newsSignals: string[]; hiringSignals: string[]; riskSignals: string[] };
}

const RISK_TO_RATING: Record<string, Rating> = { Low: "HOLD", Medium: "BUY", High: "SPECULATIVE" };
const RISK_TO_DELTA: Record<string, string> = { Low: "+1–5% expected", Medium: "+10–20% upside", High: "±40% variance" };
const SIGNAL_TONES: SignalScore["tone"][] = ["success", "primary", "warning", "success"];

function safeHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function adaptResponse(raw: BackendResponse, company: string, role: string): JobAnalysis {
  const series = raw.chartData ?? [];
  const first = series[0]?.price ?? 100000;
  const last = series[series.length - 1]?.price ?? first;
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0;
  const rating = raw.rating === "SHORT" ? "SELL" : (raw.rating as Rating);
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return {
    ticker: raw.ticker,
    company,
    role,
    salary: last,
    salaryChangePct: parseFloat(changePct.toFixed(1)),
    marketCap: "AI-estimated",
    consensus: rating,
    rating,
    ratingNote: raw.oneLineVerdict,
    priceSeries: series,
    bullCase: raw.bullCase,
    bearCase: raw.bearCase,
    recommendation: raw.recommendation,
    signals: [
      { label: "Momentum",      score: raw.scores.momentum,    tone: SIGNAL_TONES[0] },
      { label: "Salary Yield",  score: raw.scores.salaryYield, tone: SIGNAL_TONES[1] },
      { label: "Volatility",    score: raw.scores.volatility,  tone: SIGNAL_TONES[2] },
      { label: "Career Upside", score: raw.scores.upside,      tone: SIGNAL_TONES[3] },
    ],
    sources: raw.sources.map((s, i) => ({
      tag: (["NEWS", "DATA", "FILING"] as SourceTag[])[i % 3],
      title: s.title,
      outlet: safeHostname(s.url),
      sentiment: "neutral" as Sentiment,
      date: today,
    })),
    alternatives: raw.alternatives.map((a) => ({
      title: a.label,
      subtitle: `${a.risk} risk`,
      rating: RISK_TO_RATING[a.risk] ?? "HOLD",
      delta: RISK_TO_DELTA[a.risk] ?? "",
      note: a.description,
    })),
  };
}

export const mockAnalysis: JobAnalysis = {
  ticker: "N26-PM",
  company: "N26",
  role: "Product Manager",
  salary: 142800,
  salaryChangePct: 2.4,
  marketCap: "$1.2B implied",
  consensus: "HOLD",
  rating: "HOLD",
  ratingNote: "Stable cash-flow role. Limited near-term upside; downside protected by hiring freeze easing in Q2.",
  priceSeries: [
    { month: "May", price: 128400 }, { month: "Jun", price: 129800 },
    { month: "Jul", price: 131200 }, { month: "Aug", price: 130500 },
    { month: "Sep", price: 133900 }, { month: "Oct", price: 135700 },
    { month: "Nov", price: 134200 }, { month: "Dec", price: 137100 },
    { month: "Jan", price: 139400 }, { month: "Feb", price: 138800 },
    { month: "Mar", price: 141200 }, { month: "Apr", price: 142800 },
  ],
  bullCase: [
    "N26 reported 40% YoY revenue growth and reached operational profitability in DACH.",
    "Product org expanding into SMB banking — PMs will own greenfield surface area.",
    "BaFin cap on new customers lifted in Q1, unlocking growth roadmap.",
  ],
  bearCase: [
    "Two waves of layoffs in last 18 months disproportionately affected mid-level PMs.",
    "Compensation bands trail Revolut and Klarna by ~12% at the L5 level.",
    "Founder-CEO transition still pending — strategic direction uncertain through 2026.",
  ],
  recommendation:
    "HOLD for 6–9 months while compensation re-bands. Begin discreet conversations with Revolut and Monzo to establish a price floor. Avoid internal lateral moves until Q3 reorg dust settles.",
  signals: [
    { label: "Momentum",      score: 72, tone: "success" },
    { label: "Salary Yield",  score: 65, tone: "primary" },
    { label: "Volatility",    score: 58, tone: "warning" },
    { label: "Career Upside", score: 80, tone: "success" },
  ],
  sources: [
    { tag: "NEWS",   title: "N26 returns to profit, eyes SMB expansion in 2025",          outlet: "Financial Times", sentiment: "bullish", date: "Apr 18" },
    { tag: "FILING", title: "Annual report: net revenue €440M, churn down 180bps",        outlet: "Bundesanzeiger",  sentiment: "bullish", date: "Apr 02" },
    { tag: "DATA",   title: "PM headcount up 7% QoQ on LinkedIn signal",                  outlet: "Revelio Labs",    sentiment: "bullish", date: "Mar 28" },
    { tag: "NEWS",   title: "BaFin lifts customer growth cap on N26",                     outlet: "Reuters",         sentiment: "neutral", date: "Mar 11" },
    { tag: "DATA",   title: "Glassdoor PM comp at N26 trails Revolut by 12% at L5",       outlet: "Glassdoor",       sentiment: "bearish", date: "Feb 24" },
  ],
  alternatives: [
    { title: "Stay 6 months",           subtitle: "Hold N26-PM",      rating: "HOLD",        delta: "+1.8% expected", note: "Vesting cliff + reorg clarity Q3." },
    { title: "Join competitor Revolut", subtitle: "Switch to RVLT-PM", rating: "BUY",         delta: "+18.4% upside",  note: "Higher band, larger surface area." },
    { title: "Start your own thing",    subtitle: "Long YOU-FOUNDER",  rating: "SPECULATIVE", delta: "±60% variance",  note: "High β. Unlimited upside, capital-intensive." },
  ],
};

// ── SSE streaming ─────────────────────────────────────────────────────────────

export type StreamEvent =
  | { type: "status"; label: string }
  | { type: "signal"; category: string; items: string[] }
  | { type: "thinking"; text: string }
  | { type: "result"; data: JobAnalysis };

export async function* streamJobAnalysis(
  input: { company: string; role: string; riskAppetite?: string },
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch("/api/analyze-job-stock/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company: input.company, role: input.role }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const event = JSON.parse(jsonStr);
          if (event.type === "result") {
            yield { type: "result", data: adaptResponse(event.data, input.company, input.role) };
          } else {
            yield event as StreamEvent;
          }
        } catch {
          // malformed SSE chunk — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function getJobAnalysis(input: { company: string; role: string; riskAppetite?: string }): Promise<JobAnalysis> {
  try {
    const res = await fetch("/api/analyze-job-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: input.company,
        role: input.role,
        riskAppetite: input.riskAppetite ?? "balanced",
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw: BackendResponse = await res.json();
    return adaptResponse(raw, input.company, input.role);
  } catch (err) {
    console.warn("Backend unavailable, using mock data:", err);
    return { ...mockAnalysis, company: input.company, role: input.role };
  }
}

export const tickerSymbols = [
  { sym: "GOOG-SWE",   pct: +3.2 }, { sym: "META-PM",    pct: -1.8 },
  { sym: "AAPL-DSGN",  pct: +0.9 }, { sym: "NFLX-DS",    pct: -2.4 },
  { sym: "STRIPE-ENG", pct: +4.1 }, { sym: "AMZN-PMM",   pct: -0.6 },
  { sym: "MSFT-AI",    pct: +5.7 }, { sym: "TSLA-MFG",   pct: -3.3 },
  { sym: "NVDA-RES",   pct: +6.8 }, { sym: "UBER-OPS",   pct: -1.1 },
  { sym: "SHOP-PM",    pct: +2.2 }, { sym: "AIRBNB-DSGN", pct: +0.4 },
  { sym: "SNAP-ENG",   pct: -4.7 }, { sym: "DBX-SWE",    pct: -0.2 },
  { sym: "FIGMA-DSGN", pct: +3.9 }, { sym: "COIN-FIN",   pct: -2.0 },
  { sym: "REVOLUT-PM", pct: +4.6 }, { sym: "N26-PM",     pct: +2.4 },
  { sym: "KLARNA-ENG", pct: -1.4 }, { sym: "MONZO-DS",   pct: +1.7 },
];

export const loadingSteps: { label: string; detail: string }[] = [
  { label: "Searching company website",    detail: "Crawling careers, about, and product pages…" },
  { label: "Reading recent news",          detail: "Parsing articles from Reuters, FT, TechCrunch…" },
  { label: "Checking hiring momentum",     detail: "Diffing LinkedIn headcount for matched role family…" },
  { label: "Detecting volatility signals", detail: "Scanning layoffs, exec departures, runway disclosures…" },
  { label: "Estimating salary dividend",   detail: "Triangulating Levels.fyi, Glassdoor, H1B disclosures…" },
  { label: "Comparing career upside",      detail: "Benchmarking against 240 peer-role trajectories…" },
  { label: "Generating synthetic ticker",  detail: "Composing 12-month price series from weighted signals…" },
  { label: "Writing analyst memo",         detail: "Synthesizing bull case, bear case, and recommendation…" },
];
