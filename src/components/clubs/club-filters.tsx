"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { regionLabel } from "@/lib/format";
import { CLUB_REGIONS, clubSearchQuery, type ClubSearch } from "@/lib/validation";

const ALL = "all";

// Filters live in the URL, so results are shareable and the server does the searching.
// Any change goes back to page 1. Changes build on the pending search, not the last rendered
// one, so two quick changes don't overwrite each other.
export function ClubFilters({ search: current, leagues }: { search: ClubSearch; leagues: { id: string; name: string; tier: number }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useOptimistic(current);
  const queryInput = useRef<HTMLInputElement>(null);
  const tiers = [...new Set(leagues.map((l) => l.tier))].sort((a, b) => a - b);
  const filtered = Boolean(search.q || search.league || search.region || search.tier);

  function apply(change: Partial<ClubSearch>) {
    // Typed but unsubmitted text goes along with a select change.
    const q = queryInput.current?.value.trim() || undefined;
    const next = { ...search, q, ...change, page: 1 };
    startTransition(() => {
      setSearch(next);
      router.push(`/clubs${clubSearchQuery(next)}`);
    });
  }

  function select(key: "league" | "region" | "tier", value: string) {
    if (value === ALL) return apply({ [key]: undefined });
    apply({ [key]: key === "tier" ? Number(value) : value });
  }

  return (
    <form
      role="search"
      aria-label="Filter clubs"
      aria-busy={pending}
      className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        apply({});
      }}
    >
      <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="club-q">Club name</Label>
        <div className="flex gap-2">
          <Input ref={queryInput} id="club-q" name="q" type="search" defaultValue={search.q ?? ""} key={search.q ?? ""} placeholder="Search clubs" maxLength={80} />
          <Button type="submit" variant="secondary" disabled={pending}>
            <Search aria-hidden />
            <span className="sr-only sm:not-sr-only">Search</span>
          </Button>
        </div>
      </div>

      <FilterSelect id="club-league" label="League" value={search.league} onChange={(v) => select("league", v)} allLabel="All leagues">
        {leagues.map((league) => (
          <SelectItem key={league.id} value={league.id}>
            {league.name}
          </SelectItem>
        ))}
      </FilterSelect>

      <FilterSelect id="club-region" label="Region" value={search.region} onChange={(v) => select("region", v)} allLabel="All regions">
        {CLUB_REGIONS.map((region) => (
          <SelectItem key={region} value={region}>
            {regionLabel(region)}
          </SelectItem>
        ))}
      </FilterSelect>

      <FilterSelect id="club-tier" label="Tier" value={search.tier?.toString()} onChange={(v) => select("tier", v)} allLabel="All tiers">
        {tiers.map((tier) => (
          <SelectItem key={tier} value={String(tier)}>
            Tier {tier}
          </SelectItem>
        ))}
      </FilterSelect>

      {filtered ? (
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/clubs">Clear filters</Link>
        </Button>
      ) : (
        <span className="hidden lg:block" />
      )}
    </form>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  allLabel,
  children,
}: {
  id: string;
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  allLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ALL} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {children}
        </SelectContent>
      </Select>
    </div>
  );
}
