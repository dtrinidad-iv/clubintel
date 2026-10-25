"use client";

import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatGbp, formatNumber } from "@/lib/format";

// Labels arrive formatted from the server, so server and client render the same text.
export type ValuePoint = { label: string; value: number; deals: number };
export type AttendancePoint = { label: string; attendance: number; capacity: number };

const valueConfig = {
  value: { label: "Value", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function ValueBarChart({ data, label }: { data: ValuePoint[]; label: string }) {
  return (
    <ChartContainer config={valueConfig} className="aspect-auto h-64 w-full" role="img" aria-label={label}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compactGbp} />
        <ChartTooltip cursor={{ fillOpacity: 0.5 }} content={<ChartTooltipContent formatter={valueTooltip} />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

export function ValueLineChart({ data, label }: { data: ValuePoint[]; label: string }) {
  return (
    <ChartContainer config={valueConfig} className="aspect-auto h-64 w-full" role="img" aria-label={label}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compactGbp} />
        <ChartTooltip content={<ChartTooltipContent formatter={valueTooltip} />} />
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--color-value)" }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}

// Attendance and capacity are both head counts, so they share one axis (as on the club page).
const attendanceConfig = {
  attendance: { label: "Avg attendance", color: "var(--chart-2)", icon: BarSwatch },
  capacity: { label: "Avg capacity", color: "var(--foreground)", icon: DashSwatch },
} satisfies ChartConfig;

export function AttendanceByTierChart({ data, label }: { data: AttendancePoint[]; label: string }) {
  return (
    <ChartContainer config={attendanceConfig} className="aspect-auto h-64 w-full" role="img" aria-label={label}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={compactNumber} domain={[0, "auto"]} />
        <ChartTooltip cursor={{ fillOpacity: 0.5 }} content={<ChartTooltipContent formatter={attendanceTooltip} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="attendance" fill="var(--color-attendance)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false} />
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

function compactGbp(value: number) {
  return formatGbp(value, { compact: true });
}

// By hand, like formatGbp: Intl's compact notation differs between Node and browsers.
function compactNumber(value: number) {
  return value < 1000 ? formatNumber(value) : `${Math.round(value / 100) / 10}k`;
}

function valueTooltip(value: unknown, _name: unknown, item: { payload?: ValuePoint }) {
  const deals = item.payload?.deals ?? 0;
  return (
    <div className="grid w-full gap-1">
      <TooltipRow label="Value" value={formatGbp(Number(value))} />
      <TooltipRow label="Deals" value={formatNumber(deals)} />
    </div>
  );
}

function attendanceTooltip(value: unknown, name: unknown) {
  const label = attendanceConfig[name as keyof typeof attendanceConfig]?.label ?? String(name);
  return <TooltipRow label={label} value={formatNumber(Number(value))} />;
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
