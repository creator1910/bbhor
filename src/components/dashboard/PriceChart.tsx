import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PricePoint } from "@/lib/mockData";

const fmt = (v: number) => `$${(v / 1000).toFixed(1)}K`;

export const PriceChart = ({ data }: { data: PricePoint[] }) => {
  const min = Math.min(...data.map((d) => d.price));
  const max = Math.max(...data.map((d) => d.price));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={fmt}
            domain={[min - 2000, max + 2000]}
            width={56}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--primary) / 0.4)", strokeWidth: 1 }}
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--card-border))",
              borderRadius: 8,
              fontFamily: "IBM Plex Mono",
              fontSize: 12,
              color: "hsl(var(--foreground))",
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            formatter={(v: number) => [fmt(v), "Price"]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#priceFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
