import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppTopbar } from "@/components/AppTopbar";
import { streamJobAnalysis, mockAnalysis } from "@/lib/mockData";

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  funding:    { label: "FUNDING",   color: "text-amber-400   border-amber-400/30   bg-amber-400/10"   },
  news:       { label: "NEWS",      color: "text-sky-400     border-sky-400/30     bg-sky-400/10"     },
  salary:     { label: "SALARY",    color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  hiring:     { label: "HIRING",    color: "text-violet-400  border-violet-400/30  bg-violet-400/10"  },
  sentiment:  { label: "SENTIMENT", color: "text-rose-400    border-rose-400/30    bg-rose-400/10"    },
  structured: { label: "DATA",      color: "text-slate-400   border-slate-400/30   bg-slate-400/10"   },
};

interface FeedItem { id: string; category: string; text: string }

const Loading = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as { company?: string; role?: string; mode?: "new" | "current" };
  const company = state.company || "N26";
  const role    = state.role    || "Product Manager";
  const mode    = state.mode    || "new";

  const [statusLabel, setStatusLabel] = useState("Connecting to data sources…");
  const [feed,     setFeed]     = useState<FeedItem[]>([]);
  const [thinking, setThinking] = useState("");
  const [progress, setProgress] = useState(3);

  const feedRef     = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const feedCounter = useRef(0);

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed]);
  useEffect(() => {
    if (thinkingRef.current) thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
  }, [thinking]);

  useEffect(() => {
    const abort = new AbortController();

    async function run() {
      try {
        const gen = streamJobAnalysis(
          { company, role },
          abort.signal,
        );

        let signalCount = 0;

        for await (const event of gen) {
          if (event.type === "status") {
            setStatusLabel(event.label);
            if (event.label.includes("Gemini")) setProgress(60);
          } else if (event.type === "signal") {
            signalCount++;
            setProgress(Math.min(55, 10 + signalCount * 7));
            for (const item of event.items) {
              const id = String(feedCounter.current++);
              setFeed(prev => [...prev, { id, category: event.category, text: item }]);
              await new Promise(r => setTimeout(r, 80));
            }
          } else if (event.type === "thinking") {
            setProgress(p => Math.min(92, p + 0.4));
            setThinking(prev => prev + event.text);
          } else if (event.type === "result") {
            setProgress(100);
            await new Promise(r => setTimeout(r, 500));
            navigate("/dashboard", { state: { ...state, mode, data: event.data } });
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        console.error("Stream failed:", err);
        navigate("/dashboard", {
          state: { ...state, data: { ...mockAnalysis, company, role } },
        });
      }
    }

    run();
    return () => abort.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppTopbar />
      <main className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 grid-dots opacity-60 pointer-events-none" />
        <div className="absolute left-1/2 top-[-15%] h-[500px] w-[900px] -translate-x-1/2 bg-gradient-orange-glow blur-2xl pointer-events-none" />

        <section className="container relative z-10 mx-auto max-w-2xl py-16">
          {/* Header */}
          <div className="mb-6">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {mode === "current" ? "Evaluating your position" : "Pricing this offer"} · {company} · {role}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {mode === "current" ? "Analysing your current role…" : "Building your career ticker…"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{statusLabel}</p>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-700 ease-out shadow-orange-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
            {Math.round(progress)}%
          </div>

          {/* Live signal feed */}
          {feed.length > 0 && (
            <div className="mt-7">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Live signals
              </div>
              <div
                ref={feedRef}
                className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-card-border bg-card/40 p-3"
              >
                {feed.map((item) => {
                  const meta = CATEGORY_META[item.category];
                  return (
                    <div key={item.id} className="flex items-start gap-2 text-sm">
                      <span
                        className={`mt-0.5 shrink-0 rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${meta?.color ?? "text-muted-foreground border-muted-foreground/30 bg-muted/10"}`}
                      >
                        {meta?.label ?? item.category}
                      </span>
                      <span className="leading-snug text-foreground/80">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gemini reasoning */}
          {thinking && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Gemini reasoning
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
              </div>
              <div
                ref={thinkingRef}
                className="max-h-36 overflow-y-auto rounded-xl border border-primary/20 bg-card/40 p-3"
              >
                <p className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {thinking}
                </p>
              </div>
            </div>
          )}

          {/* Idle state before first event */}
          {feed.length === 0 && !thinking && (
            <div className="mt-14 flex flex-col items-center gap-3 text-center">
              <span className="h-3 w-3 rounded-full bg-primary animate-pulse-dot" />
              <span className="font-mono text-[11px] text-muted-foreground">
                Connecting to data sources…
              </span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Loading;
