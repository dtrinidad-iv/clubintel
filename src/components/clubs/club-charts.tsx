"use client";

import { Bar, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatNumber, ordinal } from "@/lib/format";

export type SeasonPoint = { season: string; attendance: number; capacity: number; position: number };

// Attendance and capacity are both head counts, so they share one axis. Capacity is a dashed
// line and attendance a bar, so the two read apart without relying on colour.
const attendanceConfig = {
  attendance: { label: "Avg attendance", color: "var(--chart-2)", icon: BarSwatch },
  capacity: { label: "Capacity", color: "var(--foreground)", icon: DashSwatch },
} satisfies ChartConfig;

export function AttendanceChart({ data }: { data: SeasonPoint[] }) {
  return (
    <ChartContainer config={attendanceConfig} className="aspect-auto h-64 w-full" role="img" aria-label="Average attendance and capacity by season">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="season" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compact} domain={[0, "auto"]} />
        <ChartTooltip cursor={{ fillOpacity: 0.5 }} content={<ChartTooltipContent formatter={tooltipNumber} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="attendance" fill="var(--color-attendance)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
        <Line
          dataKey="capacity"
          type="linear"
          stroke="var(--color-capacity)"
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
}

const positionConfig = {
  position: { label: "League position", color: "var(--chart-2)" },
} satisfies ChartConfig;

// Position 1 is the top of the table, so the axis runs downwards.
export function PositionChart({ data, leagueSize }: { data: SeasonPoint[]; leagueSize: number }) {
  const ticks = [1, Math.ceil(leagueSize / 2), leagueSize].filter((t, i, all) => all.indexOf(t) === i);
  return (
    <ChartContainer config={positionConfig} className="aspect-auto h-64 w-full" role="img" aria-label="League position by season">
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="season" tickLine={false} axisLine={false} tickMargin={8} padding={{ left: 16, right: 16 }} />
        <YAxis
          reversed
          domain={[1, Math.max(leagueSize, ...data.map((d) => d.position))]}
          ticks={ticks}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v: number) => ordinal(v)}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={tooltipPosition} />} />
        <Line dataKey="position" stroke="var(--color-position)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-position)" }} activeDot={{ r: 5 }} isAnimationActive={false} />
      </LineChart>
    </ChartContainer>
  );
}

const compactFormat = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
function compact(value: number) {
  return compactFormat.format(value);
}

function tooltipNumber(value: unknown, name: unknown) {
  const label = attendanceConfig[name as keyof typeof attendanceConfig]?.label ?? String(name);
  return <TooltipRow label={label} value={formatNumber(Number(value))} />;
}

function tooltipPosition(value: unknown) {
  return <TooltipRow label="Position" value={ordinal(Number(value))} />;
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function BarSwatch() {
  return <span className="size-2.5 rounded-[2px] bg-(--color-attendance)" aria-hidden />;
}

function DashSwatch() {
  return <span className="h-0 w-3.5 border-t-2 border-dashed border-(--color-capacity)" aria-hidden />;
}
