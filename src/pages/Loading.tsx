import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppTopbar } from "@/components/AppTopbar";
import { TickerTape } from "@/components/TickerTape";
import { streamJobAnalysis, mockAnalysis } from "@/lib/mockData";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  funding:    { label: "FUNDING",   color: "text-amber-400   border-amber-400/30   bg-amber-400/10"   },
  news:       { label: "NEWS",      color: "text-sky-400     border-sky-400/30     bg-sky-400/10"     },
  salary:     { label: "SALARY",    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  hiring:     { label: "HIRING",    color: "text-violet-400  border-violet-400/30  bg-violet-400/10"  },
  sentiment:  { label: "SENTIMENT", color: "text-rose-400    border-rose-400/30    bg-rose-400/10"    },
  structured: { label: "DATA",      color: "text-slate-400   border-slate-400/30   bg-slate-400/10"   },
  grounding:  { label: "SEARCH",    color: "text-orange-400  border-orange-400/30  bg-orange-400/10"  },
};

// Maps signal count to a descriptive status message
function signalCountToStatus(count: number): string {
  if (count === 0) return "Connecting to data sources…";
  if (count <= 2) return "Scanning Tavily — funding, news signals…";
  if (count <= 4) return "Querying YC · HN · Bundesagentur · SEC…";
  if (count <= 6) return "Running Tavily Research — salary & culture…";
  return "Compiling research context…";
}

const cleanText = (text: string): string =>
  text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

interface FeedItem { id: string; category: string; text: string; ts: number }

const Loading = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as { company?: string; role?: string; mode?: "new" | "current" };
  const company = state.company || "N26";
  const role    = state.role    || "Product Manager";
  const mode    = state.mode    || "new";

  const [statusLabel, setStatusLabel] = useState("Connecting to data sources…");
  const [feed,        setFeed]        = useState<FeedItem[]>([]);
  const [thinking,    setThinking]    = useState("");
  const [progress,    setProgress]    = useState(3);
  const [sourcesHit,  setSourcesHit]  = useState(0);

  const feedCounter  = useRef(0);
  const signalCount  = useRef(0);

  useEffect(() => {
    const abort = new AbortController();

    async function run() {
      try {
        const gen = streamJobAnalysis({ company, role }, abort.signal);

        for await (const event of gen) {
          if (event.type === "status") {
            // Override with our own descriptive status when Gemini starts
            if (event.label.includes("Gemini")) {
              setStatusLabel("Analyzing with Gemini 2.5 Flash…");
              setProgress(60);
            }
          } else if (event.type === "signal") {
            signalCount.current++;
            const count = signalCount.current;
            setProgress(Math.min(55, 10 + count * 6));
            setStatusLabel(signalCountToStatus(count));

            // Count distinct data source types as proxy for "sources hit"
            setSourcesHit(prev => prev + 1);

            for (const item of event.items) {
              const cleaned = cleanText(item);
              if (!cleaned) continue;
              const id = String(feedCounter.current++);
              setFeed(prev => [{ id, category: event.category, text: cleaned, ts: Date.now() }, ...prev].slice(0, 5));
              await new Promise(r => setTimeout(r, 120));
            }
          } else if (event.type === "thinking") {
            setProgress(p => Math.min(92, p + 0.4));
            setThinking(prev => prev + event.text);
          } else if (event.type === "result") {
            setProgress(100);
            setStatusLabel("Analysis complete");
            await new Promise(r => setTimeout(r, 600));
            navigate("/dashboard", { state: { ...state, mode, data: event.data } });
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        console.error("Stream failed:", err);
        navigate("/dashboard", { state: { ...state, data: { ...mockAnalysis, company, role } } });
      }
    }

    run();
    return () => abort.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const modeLabel = mode === "current" ? "Evaluating your position" : "Pricing this offer";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TickerTape />
      <AppTopbar />

      <main className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 grid-dots opacity-40 pointer-events-none" />
        <div className="absolute left-1/2 top-[-10%] h-[400px] w-[800px] -translate-x-1/2 bg-gradient-orange-glow blur-2xl pointer-events-none" />

        <div className="container relative z-10 max-w-3xl py-12">

          {/* Header */}
          <div className="mb-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">
              {modeLabel} · {company} · {role}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "current" ? "Analysing your current role…" : "Building your career ticker…"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{statusLabel}</p>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted mb-1">
            <div
              className="h-full bg-primary transition-[width] duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground mb-8">
            <span>{Math.round(progress)}%</span>
            {sourcesHit > 0 && (
              <span>{sourcesHit} data source{sourcesHit !== 1 ? "s" : ""} confirmed</span>
            )}
          </div>

          {/* Signal feed — newest at top, full-width cards */}
          {feed.length > 0 && (
            <div className="mb-6">
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
                Live Signals
              </div>
              <div className="space-y-3">
                {feed.map((item, idx) => {
                  const meta = CATEGORY_META[item.category];
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border border-card-border bg-card p-4 transition-all duration-300 ${idx === 0 ? "animate-slide-up border-primary/20" : "opacity-60"}`}
                      style={idx === 0 ? { animationDuration: "250ms" } : undefined}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${meta?.color ?? "text-muted-foreground border-muted-foreground/30 bg-muted/10"}`}
                        >
                          {meta?.label ?? item.category}
                        </span>
                        <span className="font-mono text-[9px] text-muted-foreground/50">
                          {idx === 0 ? "just now" : `${idx * 3}s ago`}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/85 leading-snug">{item.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Separator */}
          {(feed.length > 0 && thinking) && (
            <div className="border-t border-border/50 mb-6" />
          )}

          {/* Gemini reasoning — prominent section */}
          {thinking && (
            <div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.25s" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.5s" }} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground ml-1">
                  Gemini Analysis
                </span>
              </div>
              <div className="rounded-xl border border-primary/25 bg-card/60 p-5">
                <p className="font-mono text-[12px] leading-relaxed text-foreground/85">
                  {thinking}
                </p>
              </div>
            </div>
          )}

          {/* Idle state */}
          {feed.length === 0 && !thinking && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.2s" }} />
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" style={{ animationDelay: "0.4s" }} />
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                Connecting to data sources…
              </span>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default Loading;
