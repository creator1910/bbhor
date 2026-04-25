import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { TickerTape } from "@/components/TickerTape";
import { AppTopbar } from "@/components/AppTopbar";

type Mode = "new" | "current";

const MODES: { id: Mode; label: string; sub: string }[] = [
  { id: "new",     label: "Evaluating an offer",    sub: "Should I take this job?" },
  { id: "current", label: "Reviewing my current job", sub: "Should I stay or move on?" },
];

const Landing = () => {
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [mode, setMode] = useState<Mode>("new");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ready = company.trim().length > 0 && role.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    navigate("/loading", { state: { company, role, mode } });
  };

  const placeholderRole = useMemo(() => "e.g. Product Manager", []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TickerTape />
      <AppTopbar />

      {/* Hero */}
      <main className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 grid-dots opacity-80 pointer-events-none" />
        <div className="absolute left-1/2 top-[-10%] h-[640px] w-[1100px] -translate-x-1/2 bg-gradient-orange-glow blur-2xl pointer-events-none" />

        <section className="container relative z-10 flex flex-col items-center pt-24 pb-32 text-center">
          <div className={`inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 font-mono text-[11px] text-muted-foreground backdrop-blur transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />
            CAREER MARKETS · LIVE
          </div>

          <h1 className={`mt-7 max-w-4xl text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02] transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
            Trade your job<br />
            <span className="text-primary">like an asset.</span>
          </h1>

          <p className={`mt-6 max-w-2xl text-base md:text-lg text-muted-foreground transition-all duration-700 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
            $JOB prices your career using public company signals, role economics,
            and AI analysis.
          </p>

          {/* Mode toggle */}
          <div className={`mt-10 w-full max-w-2xl grid grid-cols-2 gap-3 transition-all duration-700 delay-250 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3.5 text-left transition-all duration-150
                    ${active
                      ? "border-primary bg-primary/10 shadow-orange-glow"
                      : "border-card-border bg-card/60 hover:border-primary/40"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full border transition-colors ${active ? "bg-primary border-primary" : "border-muted-foreground/50"}`} />
                    <span className={`font-mono text-[11px] uppercase tracking-widest ${active ? "text-primary" : "text-muted-foreground"}`}>
                      {m.label}
                    </span>
                  </div>
                  <span className="pl-4 text-sm text-muted-foreground">{m.sub}</span>
                </button>
              );
            })}
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className={`mt-3 w-full max-w-2xl rounded-2xl border border-card-border bg-card/80 p-3 shadow-card-elevated backdrop-blur-md transition-all duration-700 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <div className="grid gap-2 md:grid-cols-2">
              <label className="block text-left">
                <span className="block px-3 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Company</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="N26 or n26.com"
                  className="w-full bg-transparent px-3 pb-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </label>
              <label className="block text-left border-t md:border-t-0 md:border-l border-border">
                <span className="block px-3 pt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your role</span>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={placeholderRole}
                  className="w-full bg-transparent px-3 pb-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={!ready}
              className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 font-mono text-sm font-medium tracking-wide transition-all
                ${ready
                  ? "bg-primary text-primary-foreground hover:bg-primary-glow shadow-orange-glow"
                  : "bg-muted text-muted-foreground cursor-not-allowed"}`}
            >
              {mode === "new" ? "Price this offer" : "Evaluate my position"}
              <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </form>

          <p className="mt-6 font-mono text-[11px] text-muted-foreground">
            Used by 12,438 professionals · No login required for first quote
          </p>
        </section>
      </main>
    </div>
  );
};

export default Landing;
