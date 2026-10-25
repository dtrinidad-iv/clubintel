import { AlertTriangle, Clock, Handshake, Percent, PoundSterling, Trophy } from "lucide-react";
import Link from "next/link";
import { AttendanceByTierChart, ValueBarChart, ValueLineChart, type ValuePoint } from "@/components/dashboard/dashboard-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireWorkspace } from "@/lib/dal";
import { getKpis, getNationalAttendance, getPipelineByStage, getUpcoming, getValueByTier, getWonByMonth } from "@/lib/dashboard";
import { formatDate, formatGbp, formatMonth, formatNumber, formatPercent, seasonLabel, stageLabel } from "@/lib/format";
import { SEARCH_MAX } from "@/lib/validation";

// Each section loads on its own, inside its own <Suspense> on the page. The pipeline sections
// need opportunities.view; every role has it today, but they check rather than assume.

async function pipelineAccess() {
  const { workspace } = await requireWorkspace();
  return {
    canView: workspace.permissions.includes("opportunities.view"),
    canWrite: workspace.permissions.includes("opportunities.write"),
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export async function KpiTiles() {
  const { canView } = await pipelineAccess();
  if (!canView) return null;
  const k = await getKpis();
  const closed = k.won_12m_count + k.lost_12m_count;

  const tiles = [
    { label: "Open pipeline", value: formatGbp(k.open_value), note: plural(k.open_count, "open deal"), icon: Handshake },
    { label: "Won this quarter", value: formatGbp(k.won_quarter_value), note: plural(k.won_quarter_count, "deal"), icon: Trophy },
    {
      label: "Win rate",
      value: closed ? formatPercent(k.won_12m_count / closed) : "–",
      note: closed ? `${formatNumber(k.won_12m_count)} won, ${formatNumber(k.lost_12m_count)} lost in 12 months` : "Nothing closed in 12 months",
      icon: Percent,
    },
    {
      label: "Average deal size",
      value: k.avg_won_value === null ? "–" : formatGbp(k.avg_won_value),
      note: "Deals won in 12 months",
      icon: PoundSterling,
    },
    { label: "Stale deals", value: formatNumber(k.stale_count), note: "Open, no stage change in 30 days", icon: Clock },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key numbers">
      {tiles.map((tile) => (
        <li key={tile.label} className="sm:last:col-span-2 xl:last:col-span-1">
          <Card className="h-full gap-2 py-4" data-testid={`kpi-${tile.label.toLowerCase().replaceAll(" ", "-")}`}>
            <CardHeader className="px-4">
              <CardDescription className="flex items-center gap-2">
                <tile.icon className="size-4 shrink-0" aria-hidden />
                {tile.label}
              </CardDescription>
              <CardTitle className="truncate text-2xl tabular-nums">{tile.value}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 text-xs text-muted-foreground">{tile.note}</CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export async function StageSection() {
  const { canView, canWrite } = await pipelineAccess();
  if (!canView) return null;
  const rows = await getPipelineByStage();
  const points = rows.map((r) => ({ label: stageLabel(r.stage), value: r.value, deals: r.deals }));
  return (
    <ChartCard title="Open pipeline by stage" description="The value of open deals at each stage.">
      {isEmpty(points) ? (
        <Empty text="No open deals yet." canWrite={canWrite} />
      ) : (
        <>
          <ValueBarChart data={points} label="Open pipeline value by stage" />
          <ChartTable caption="Open pipeline by stage" head="Stage" points={points} />
        </>
      )}
    </ChartCard>
  );
}

export async function WonSection() {
  const { canView, canWrite } = await pipelineAccess();
  if (!canView) return null;
  const rows = await getWonByMonth();
  const points = rows.map((r) => ({ label: formatMonth(r.month), value: r.value, deals: r.deals }));
  return (
    <ChartCard title="Won by month" description="The value of deals won each month, over the last year.">
      {isEmpty(points) ? (
        <Empty text="No deals won in the last year." canWrite={canWrite} />
      ) : (
        <>
          <ValueLineChart data={points} label="Value won by month, last 12 months" />
          <ChartTable caption="Won by month" head="Month" points={points} />
        </>
      )}
    </ChartCard>
  );
}

export async function TierSection() {
  const { canView, canWrite } = await pipelineAccess();
  if (!canView) return null;
  const rows = await getValueByTier();
  const points = rows.map((r) => ({ label: `Tier ${r.tier}`, value: r.value, deals: r.deals }));
  return (
    <ChartCard title="Open pipeline by league tier" description="Where your open deals sit in the national pyramid, by each club's current league.">
      {isEmpty(points) ? (
        <Empty text="No open deals yet." canWrite={canWrite} />
      ) : (
        <>
          <ValueBarChart data={points} label="Open pipeline value by league tier" />
          <ChartTable caption="Open pipeline by league tier" head="Tier" points={points} />
        </>
      )}
    </ChartCard>
  );
}

export async function UpcomingSection() {
  const { canView, canWrite } = await pipelineAccess();
  if (!canView) return null;
  const deals = await getUpcoming();
  return (
    <ChartCard title="Upcoming close dates" description="Open deals by expected close date. Overdue ones come first.">
      {deals.length === 0 ? (
        <Empty text="No open deals with a close date." canWrite={canWrite} />
      ) : (
        <ul className="divide-y" data-testid="upcoming">
          {deals.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <Link
                  href={`/opportunities?q=${encodeURIComponent(d.title.slice(0, SEARCH_MAX))}`}
                  className="block truncate font-medium underline-offset-4 hover:underline"
                >
                  {d.title}
                </Link>
                <div className="truncate text-sm text-muted-foreground">
                  {d.club_name} · {stageLabel(d.stage)}
                </div>
              </div>
              <div className="grid shrink-0 justify-items-end text-right text-sm">
                <span className="font-medium tabular-nums">{formatGbp(d.value_gbp, { compact: true })}</span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {d.overdue && (
                    <Badge variant="destructive">
                      <AlertTriangle aria-hidden /> Overdue
                    </Badge>
                  )}
                  <time dateTime={d.expected_close_date}>{formatDate(d.expected_close_date)}</time>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

export async function NationalSection() {
  // Shared data: any signed-in member can see it.
  await requireWorkspace();
  const rows = await getNationalAttendance();
  const season = rows[0]?.season;
  const points = rows.map((r) => ({ label: `Tier ${r.tier}`, attendance: r.avg_attendance, capacity: r.avg_capacity, clubs: r.clubs }));
  return (
    <ChartCard
      title="National attendance by tier"
      description={season ? `Average home crowd against stadium capacity per club, ${seasonLabel(season)} season.` : "Average home crowd against stadium capacity per club."}
    >
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground">No season data yet.</p>
      ) : (
        <>
          <AttendanceByTierChart data={points} label="Average attendance and capacity per club, by league tier" />
          <table className="sr-only">
            <caption>National attendance by tier</caption>
            <thead>
              <tr>
                <th scope="col">Tier</th>
                <th scope="col">Clubs</th>
                <th scope="col">Avg attendance</th>
                <th scope="col">Avg capacity</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label}>
                  <th scope="row">{p.label}</th>
                  <td>{formatNumber(p.clubs)}</td>
                  <td>{formatNumber(p.attendance)}</td>
                  <td>{formatNumber(p.capacity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartCard>
  );
}

function isEmpty(points: ValuePoint[]) {
  return points.every((p) => p.deals === 0);
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ text, canWrite }: { text: string; canWrite: boolean }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      {canWrite && (
        <Button variant="outline" asChild>
          <Link href="/opportunities">Add an opportunity</Link>
        </Button>
      )}
    </div>
  );
}

// The chart's numbers for screen readers, which skip the chart itself (role="img").
function ChartTable({ caption, head, points }: { caption: string; head: string; points: ValuePoint[] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{head}</th>
          <th scope="col">Value</th>
          <th scope="col">Deals</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.label}>
            <th scope="row">{p.label}</th>
            <td>{formatGbp(p.value)}</td>
            <td>{formatNumber(p.deals)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function KpiFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-busy="true" aria-label="Loading key numbers">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-28 sm:last:col-span-2 xl:last:col-span-1" />
      ))}
    </div>
  );
}

export function SectionFallback({ label }: { label: string }) {
  return <Skeleton className="h-96" aria-busy="true" aria-label={`Loading ${label}`} />;
}
