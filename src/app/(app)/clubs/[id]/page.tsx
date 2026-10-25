import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { AttendanceChart, PositionChart, type SeasonPoint } from "@/components/clubs/club-charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClub, leagueSize, type ClubDetail } from "@/lib/clubs";
import { getUser, requireWorkspace } from "@/lib/dal";
import { formatNumber, ordinal, regionLabel, seasonLabel } from "@/lib/format";
import { uuidSchema } from "@/lib/validation";

async function findClub(id: string) {
  const parsed = uuidSchema.safeParse(id);
  return parsed.success ? getClub(parsed.data) : null;
}

export async function generateMetadata({ params }: PageProps<"/clubs/[id]">): Promise<Metadata> {
  if (!(await getUser())) return { title: "Club" };
  const club = await findClub((await params).id);
  return { title: club?.name ?? "Club not found" };
}

export default function ClubPage({ params }: PageProps<"/clubs/[id]">) {
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground">
        <Link href="/clubs">
          <ArrowLeft aria-hidden /> All clubs
        </Link>
      </Button>
      <Suspense fallback={<ProfileFallback />}>
        <ClubProfile params={params} />
      </Suspense>
    </>
  );
}

async function ClubProfile({ params }: { params: PageProps<"/clubs/[id]">["params"] }) {
  await requireWorkspace();
  const club = await findClub((await params).id);
  // Inside the Suspense boundary the response has already started, so this is a 200 with
  // noindex rather than a 404. That's the price of an instant navigation; the API returns a real 404.
  if (!club) notFound();

  const latest = club.seasons.at(-1);
  // The league the club played in that season, which can differ from its current one.
  const size = latest ? await leagueSize(latest.league_id, latest.season) : 0;
  const points: SeasonPoint[] = club.seasons.map((s) => ({
    season: seasonLabel(s.season),
    attendance: s.avg_attendance,
    capacity: s.capacity,
    position: s.league_position,
  }));

  return (
    <>
      <PageHeader title={club.name} description={`${club.stadium}, ${club.city}`}>
        <div className="flex flex-wrap gap-2">
          {club.league && <Badge variant="secondary">{club.league.name}</Badge>}
          <Badge variant="outline">{regionLabel(club.region)}</Badge>
        </div>
      </PageHeader>

      <KeyFigures club={club} latest={latest} leagueSize={size} />

      {points.length === 0 ? (
        <p className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          No season history for this club yet.
        </p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Attendance</CardTitle>
                <CardDescription>Average home crowd against stadium capacity, per season.</CardDescription>
              </CardHeader>
              <CardContent>
                <AttendanceChart data={points} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>League position</CardTitle>
                <CardDescription>Final position each season, in that season&apos;s league. Higher on the chart is better.</CardDescription>
              </CardHeader>
              <CardContent>
                <PositionChart data={points} leagueSize={size} />
              </CardContent>
            </Card>
          </div>
          <SeasonTable club={club} />
        </>
      )}
    </>
  );
}

function ProfileFallback() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading club">
      <Skeleton className="h-12 w-72 max-w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

function KeyFigures({ club, latest, leagueSize }: { club: ClubDetail; latest: ClubDetail["seasons"][number] | undefined; leagueSize: number }) {
  const figures = [
    { label: "Capacity", value: formatNumber(club.capacity) },
    { label: latest ? `Avg attendance ${seasonLabel(latest.season)}` : "Avg attendance", value: latest ? formatNumber(latest.avg_attendance) : "–" },
    { label: "Stadium filled", value: latest ? `${Math.round((latest.avg_attendance / latest.capacity) * 100)}%` : "–" },
    {
      label: "League position",
      value: latest ? `${ordinal(latest.league_position)}${leagueSize ? ` of ${leagueSize}` : ""}` : "–",
    },
  ];
  return (
    <div className="mb-6 grid gap-2">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {figures.map((f) => (
          <Card key={f.label} className="gap-1 py-4">
            <dt className="px-4 text-sm text-muted-foreground">{f.label}</dt>
            <dd className="px-4 text-2xl font-semibold tabular-nums">{f.value}</dd>
          </Card>
        ))}
      </dl>
      {club.founded && <p className="text-sm text-muted-foreground">Founded {club.founded}.</p>}
    </div>
  );
}

function SeasonTable({ club }: { club: ClubDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Season by season</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Season</TableHead>
              <TableHead className="text-right">Position</TableHead>
              <TableHead className="text-right">Avg attendance</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Capacity</TableHead>
              <TableHead className="text-right">Filled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...club.seasons].reverse().map((s) => (
              <TableRow key={s.season}>
                <TableCell>{seasonLabel(s.season)}</TableCell>
                <TableCell className="text-right tabular-nums">{ordinal(s.league_position)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(s.avg_attendance)}</TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatNumber(s.capacity)}</TableCell>
                <TableCell className="text-right tabular-nums">{Math.round((s.avg_attendance / s.capacity) * 100)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
