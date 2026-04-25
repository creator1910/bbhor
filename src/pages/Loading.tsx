import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { AppTopbar } from "@/components/AppTopbar";
import { getJobAnalysis, loadingSteps, type JobAnalysis } from "@/lib/mockData";

const STEP_MS = 850;

const Loading = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as { company?: string; role?: string; riskAppetite?: string };

  const [active, setActive] = useState(0);
  const [apiData, setApiData] = useState<JobAnalysis | null>(null);

  const stepsComplete = active >= loadingSteps.length;
  const lastStep = active === loadingSteps.length - 1;

  // Fire the real API call immediately on mount
  useEffect(() => {
    let cancelled = false;
    getJobAnalysis({
      company: state.company || "N26",
      role: state.role || "Product Manager",
      riskAppetite: state.riskAppetite,
    }).then((data) => {
      if (!cancelled) setApiData(data);
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Advance steps — hold on the last one until the API resolves
  useEffect(() => {
    if (stepsComplete) return;
    if (lastStep && !apiData) return; // wait for API before completing last step
    const t = setTimeout(() => setActive((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [active, apiData, stepsComplete, lastStep]);

  // Navigate once all steps are done and data is ready
  useEffect(() => {
    if (!stepsComplete || !apiData) return;
    const t = setTimeout(() => {
      navigate("/dashboard", { state: { ...state, data: apiData } });
    }, 400);
    return () => clearTimeout(t);
  }, [stepsComplete, apiData]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = Math.min(100, (active / loadingSteps.length) * 100);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppTopbar />
      <main className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 grid-dots opacity-60 pointer-events-none" />
        <div className="absolute left-1/2 top-[-15%] h-[500px] w-[900px] -translate-x-1/2 bg-gradient-orange-glow blur-2xl pointer-events-none" />

        <section className="container relative z-10 mx-auto max-w-2xl py-20">
          <div className="mb-8">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Pricing job · {state.company || "—"} · {state.role || "—"}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Building your career ticker…
            </h1>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-500 ease-out shadow-orange-glow"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>{Math.round(progress)}%</span>
            <span>{Math.min(active, loadingSteps.length)} / {loadingSteps.length} steps</span>
          </div>

          {/* Steps */}
          <ol className="mt-10 space-y-4">
            {loadingSteps.map((step, i) => {
              const done = i < active;
              const current = i === active;
              return (
                <li
                  key={step.label}
                  className={`flex gap-4 rounded-xl border px-4 py-3.5 transition-all
                    ${current ? "border-primary/60 bg-card shadow-orange-glow" : done ? "border-card-border bg-card/60" : "border-card-border/60 bg-card/30 opacity-60"}`}
                >
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    {done ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success/20 text-success">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </div>
                    ) : current ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse-dot" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm ${current ? "text-foreground" : done ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-muted-foreground"}`}>
                      {step.label}
                    </div>
                    {current && (
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {step.detail}
                      </div>
                    )}
                  </div>
                  <div className="self-center font-mono text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    </div>
  );
};

export default Loading;
