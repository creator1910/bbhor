import { useMemo, useState } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import type { PricePoint, ChartAnnotation } from "@/lib/mockData";

interface WeeklyPoint {
  week: number;
  label: string;
  price: number;
  sma: number | null;
}

function interpolateWeekly(monthly: PricePoint[]): WeeklyPoint[] {
  const weekly: WeeklyPoint[] = [];
  for (let w = 0; w < 52; w++) {
    const t = w / 51;
    const idx = t * (monthly.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, monthly.length - 1);
    const frac = idx - lo;
    const price = monthly[lo].price * (1 - frac) + monthly[hi].price * frac;
    const label =
      w === 0 ? "W1" : w === 13 ? "W14" : w === 26 ? "W27" : w === 39 ? "W40" : w === 51 ? "W52" : "";
    weekly.push({ week: w + 1, label, price: Math.round(price * 10) / 10, sma: null });
  }
  return weekly;
}

function withSMA(data: WeeklyPoint[], window: number): WeeklyPoint[] {
  return data.map((pt, i) => ({
    ...pt,
    sma: i < window - 1
      ? null
      : Math.round(data.slice(i - window + 1, i + 1).reduce((s, p) => s + p.price, 0) / window * 10) / 10,
  }));
}

const PERIOD_WEEKS: Record<string, number> = { "1M": 4, "3M": 13, "6M": 26, "1Y": 52, "ALL": 52 };
const PERIODS = ["1M", "3M", "6M", "1Y", "ALL"] as const;
const SUCCESS_COLOR = "hsl(142, 71%, 45%)";
const SUCCESS_MUTED = "hsl(142, 60%, 30%)";
const DESTRUCTIVE_COLOR = "hsl(0, 84%, 60%)";

interface TooltipPayload { value: number; name: string }
const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  const price = payload.find((p) => p.name === "price");
  const sma = payload.find((p) => p.name === "sma");
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-[11px] shadow-lg">
      {label && <div className="text-muted-foreground mb-1">Week {label.replace("W", "")}</div>}
      {price && <div>Price: <span className="text-success">{price.value.toFixed(1)}</span></div>}
      {sma?.value && <div className="text-muted-foreground">8W SMA: {sma.value.toFixed(1)}</div>}
    </div>
  );
};

interface Props {
  data: PricePoint[];
  annotations?: ChartAnnotation[];
}

export const CareerChart = ({ data, annotations }: Props) => {
  const [period, setPeriod] = useState<string>("1Y");
  const allWeekly = useMemo(() => withSMA(interpolateWeekly(data), 8), [data]);
  const weekly = useMemo(() => allWeekly.slice(-PERIOD_WEEKS[period]), [allWeekly, period]);

  const first = weekly[0]?.price ?? 0;
  const last = weekly.at(-1)?.price ?? 0;
  const changePct = first > 0 ? ((last - first) / first * 100).toFixed(1) : "0.0";
  const isUp = last >= first;

  // Convert monthIndex (0-11) to week number (1-52)
  const weeklyOffset = allWeekly.length - weekly.length;
  const visibleAnnotations = useMemo(() => {
    if (!annotations?.length) return [];
    return annotations
      .map((ann) => {
        const weekNum = Math.max(1, Math.min(52, Math.round(ann.monthIndex * (51 / 11) + 1)));
        // Only show if in the current period window
        if (weekNum <= weeklyOffset) return null;
        return { ...ann, weekNum };
      })
      .filter(Boolean) as (ChartAnnotation & { weekNum: number })[];
  }, [annotations, weeklyOffset]);

  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Career Price Index
          </div>
          <div className="font-mono text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{data[0]?.price.toFixed(1)} → {data.at(-1)?.price.toFixed(1)}</span>
            <span className={isUp ? "text-success" : "text-destructive-strong"}>
              {isUp ? "+" : ""}{changePct}%
            </span>
          </div>
        </div>
        {/* Period buttons */}
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-1 font-mono text-[10px] transition ${
                period === p
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={weekly} margin={{ top: 18, right: 4, left: -32, bottom: 0 }}>
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SUCCESS_COLOR} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SUCCESS_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="week"
              type="number"
              domain={[weekly[0]?.week ?? 1, weekly.at(-1)?.week ?? 52]}
              ticks={weekly.filter(w => w.label).map(w => w.week)}
              tickFormatter={(v) => {
                const pt = weekly.find(w => w.week === v);
                return pt?.label || "";
              }}
              tick={{ fill: "hsl(240 5% 55%)", fontFamily: "IBM Plex Mono, monospace", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis domain={["auto", "auto"]} hide />
            <Tooltip content={<CustomTooltip />} />

            {/* Chart annotations — key events */}
            {visibleAnnotations.map((ann, i) => (
              <ReferenceLine
                key={i}
                x={ann.weekNum}
                stroke={ann.direction === "positive" ? SUCCESS_COLOR : DESTRUCTIVE_COLOR}
                strokeDasharray="3 3"
                strokeOpacity={0.6}
                label={{
                  value: ann.label,
                  position: "top",
                  fill: ann.direction === "positive" ? SUCCESS_COLOR : DESTRUCTIVE_COLOR,
                  fontSize: 8,
                  fontFamily: "IBM Plex Mono, monospace",
                  offset: 4,
                }}
              />
            ))}

            <Area
              type="monotone"
              dataKey="price"
              stroke={SUCCESS_COLOR}
              strokeWidth={2}
              fill="url(#chartFill)"
              dot={false}
              isAnimationActive
              animationDuration={1200}
              animationBegin={0}
            />
            <Line
              type="monotone"
              dataKey="sma"
              stroke={SUCCESS_MUTED}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive
              animationDuration={1200}
              animationBegin={200}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 font-mono text-[9px] text-muted-foreground/70">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: SUCCESS_COLOR }} />
          Price
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: SUCCESS_MUTED }} />
          8W SMA
        </span>
        {visibleAnnotations.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "hsl(240 5% 55%)" }} />
            Events
          </span>
        )}
      </div>
    </div>
  );
};
