import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { ClubFilters } from "@/components/clubs/club-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listLeagues, searchClubs, type ClubListItem } from "@/lib/clubs";
import { requireWorkspace } from "@/lib/dal";
import { formatNumber, ordinal, regionLabel, seasonLabel } from "@/lib/format";
import { clubSearchQuery, parseClubSearch, type ClubSearch } from "@/lib/validation";

export const metadata: Metadata = { title: "Clubs" };

// The header is static; everything that reads the session or the URL streams in below it,
// so a client navigation here shows the header at once.
export default function ClubsPage({ searchParams }: PageProps<"/clubs">) {
  return (
    <>
      <PageHeader title="Clubs" description="The national club database: every club, league and season, shared across workspaces." />
      <Suspense fallback={<ResultsFallback />}>
        <ClubResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ClubResults({ searchParams }: { searchParams: PageProps<"/clubs">["searchParams"] }) {
  await requireWorkspace();
  const parsed = parseClubSearch(await searchParams);
  const leagues = await listLeagues();
  // An unknown league id (stale or hand-edited link) means all leagues, so the filter shown matches the results.
  const search = leagues.some((l) => l.id === parsed.league) ? parsed : { ...parsed, league: undefined };
  const { clubs, meta } = await searchClubs(search);
  const season = clubs.find((c) => c.latest_season)?.latest_season;

  return (
    <>
      <ClubFilters search={search} leagues={leagues} />
      {clubs.length === 0 ? (
        <EmptyResults search={search} total={meta.total} />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" role="status">
            {formatNumber(meta.total)} {meta.total === 1 ? "club" : "clubs"}
            {season ? ` · attendance and position from ${seasonLabel(season)}` : ""}
          </p>
          <ClubTable clubs={clubs} />
          <ClubCards clubs={clubs} />
          <Pager search={search} totalPages={meta.totalPages} />
        </>
      )}
    </>
  );
}

function ResultsFallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading clubs">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function ClubTable({ clubs }: { clubs: ClubListItem[] }) {
  return (
    <div className="hidden rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Club</TableHead>
            <TableHead>League</TableHead>
            <TableHead className="hidden lg:table-cell">Region</TableHead>
            <TableHead className="text-right">Position</TableHead>
            <TableHead className="text-right">Avg attendance</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Capacity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clubs.map((club) => (
            <TableRow key={club.id}>
              <TableCell>
                <Link href={`/clubs/${club.id}`} className="font-medium underline-offset-4 hover:underline">
                  {club.name}
                </Link>
                <div className="text-xs text-muted-foreground">{club.city}</div>
              </TableCell>
              <TableCell>
                {club.league_name}
                <div className="text-xs text-muted-foreground">Tier {club.tier}</div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">{regionLabel(club.region)}</TableCell>
              <TableCell className="text-right tabular-nums">{club.league_position ? ordinal(club.league_position) : "–"}</TableCell>
              <TableCell className="text-right tabular-nums">{club.avg_attendance !== null ? formatNumber(club.avg_attendance) : "–"}</TableCell>
              <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatNumber(club.capacity)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClubCards({ clubs }: { clubs: ClubListItem[] }) {
  return (
    <ul className="grid gap-3 md:hidden">
      {clubs.map((club) => (
        <li key={club.id}>
          <Link href={`/clubs/${club.id}`} className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
            <Card className="py-4 transition-colors hover:bg-muted/50">
              <CardContent className="grid gap-2 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{club.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {club.city} · {regionLabel(club.region)}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    Tier {club.tier}
                  </Badge>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <Stat label="League" value={club.league_name.replace(/^Demo /, "")} />
                  <Stat label="Position" value={club.league_position ? ordinal(club.league_position) : "–"} />
                  <Stat label="Avg crowd" value={club.avg_attendance !== null ? formatNumber(club.avg_attendance) : "–"} />
                </dl>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate tabular-nums">{value}</dd>
    </div>
  );
}

function Pager({ search, totalPages }: { search: ClubSearch; totalPages: number }) {
  if (totalPages <= 1) return null;
  const href = (page: number) => `/clubs${clubSearchQuery({ ...search, page })}`;
  const hasPrev = search.page > 1;
  const hasNext = search.page < totalPages;

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2">
      {hasPrev ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={href(search.page - 1)} rel="prev">
            <ChevronLeft aria-hidden /> Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft aria-hidden /> Previous
        </Button>
      )}
      <span className="text-sm text-muted-foreground">
        Page {search.page} of {totalPages}
      </span>
      {hasNext ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={href(search.page + 1)} rel="next">
            Next <ChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next <ChevronRight aria-hidden />
        </Button>
      )}
    </nav>
  );
}

function EmptyResults({ search, total }: { search: ClubSearch; total: number }) {
  const pastEnd = total > 0;
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      <SearchX className="size-8 text-muted-foreground" aria-hidden />
      <div className="grid gap-1">
        <h2 className="font-medium">{pastEnd ? "No more clubs" : "No clubs match these filters"}</h2>
        <p className="text-sm text-muted-foreground">
          {pastEnd ? "This page is past the end of the results." : "Try a shorter name or fewer filters."}
        </p>
      </div>
      <Button variant="outline" asChild>
        <Link href={pastEnd ? `/clubs${clubSearchQuery({ ...search, page: 1 })}` : "/clubs"}>
          {pastEnd ? "Back to page 1" : "Clear filters"}
        </Link>
      </Button>
    </div>
  );
}
