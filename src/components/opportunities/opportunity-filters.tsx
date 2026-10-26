"use client";

import { KanbanSquare, Search, Table2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoryLabel, stageLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { OPPORTUNITY_CATEGORIES, OPPORTUNITY_STAGES, type OpportunityFilters as Filters } from "@/lib/validation";

const ALL = "all";

export function opportunitiesHref(filters: Partial<Filters>) {
  const params = new URLSearchParams();
  if (filters.id) params.set("id", filters.id);
  if (filters.q) params.set("q", filters.q);
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.category) params.set("category", filters.category);
  if (filters.owner) params.set("owner", filters.owner);
  if (filters.view === "board") params.set("view", "board");
  const query = params.toString();
  return `/opportunities${query ? `?${query}` : ""}`;
}

// Filters live in the URL. Changes build on the pending filters, so quick changes don't
// overwrite each other, and typed but unsubmitted text goes along with a select change.
export function OpportunityFilters({ filters: current, members }: { filters: Filters; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useOptimistic(current);
  const queryInput = useRef<HTMLInputElement>(null);
  const filtered = Boolean(filters.id || filters.q || filters.stage || filters.category || filters.owner);

  function apply(change: Partial<Filters>) {
    const q = queryInput.current?.value.trim() || undefined;
    // Any change leaves the single-deal view a link opened.
    const next = { ...filters, id: undefined, q, ...change };
    startTransition(() => {
      setFilters(next);
      router.push(opportunitiesHref(next));
    });
  }

  return (
    <div className="mb-6 grid gap-3">
      <form
        role="search"
        aria-label="Filter opportunities"
        aria-busy={pending}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          apply({});
        }}
      >
        <div className="grid gap-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="opp-q">Search</Label>
          <div className="flex gap-2">
            <Input ref={queryInput} id="opp-q" name="q" type="search" defaultValue={filters.q ?? ""} key={filters.q ?? ""} placeholder="Title or partner" maxLength={80} />
            <Button type="submit" variant="secondary" disabled={pending}>
              <Search aria-hidden />
              <span className="sr-only sm:not-sr-only">Search</span>
            </Button>
          </div>
        </div>
        <FilterSelect id="opp-stage" label="Stage" value={filters.stage} allLabel="All stages" onChange={(v) => apply({ stage: v as Filters["stage"] })}>
          {OPPORTUNITY_STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {stageLabel(s)}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect id="opp-category" label="Category" value={filters.category} allLabel="All categories" onChange={(v) => apply({ category: v as Filters["category"] })}>
          {OPPORTUNITY_CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {categoryLabel(c)}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect id="opp-owner" label="Owner" value={filters.owner} allLabel="Anyone" onChange={(v) => apply({ owner: v })}>
          <SelectItem value="none">Unassigned</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </FilterSelect>
        {filtered ? (
          <Button variant="ghost" asChild className="w-fit">
            <Link href={opportunitiesHref({ view: filters.view })}>Clear filters</Link>
          </Button>
        ) : (
          <span className="hidden lg:block" />
        )}
      </form>

      <nav aria-label="Layout" className="inline-flex w-fit rounded-lg border p-0.5">
        <ViewLink href={opportunitiesHref({ ...filters, view: "table" })} active={filters.view === "table"} icon={Table2} label="Table" />
        <ViewLink href={opportunitiesHref({ ...filters, view: "board" })} active={filters.view === "board"} icon={KanbanSquare} label="Board" />
      </nav>
    </div>
  );
}

function ViewLink({ href, active, icon: Icon, label }: { href: string; active: boolean; icon: typeof Table2; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "bg-secondary font-medium text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden /> {label}
    </Link>
  );
}

function FilterSelect({
  id,
  label,
  value,
  allLabel,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string | undefined;
  allLabel: string;
  onChange: (value: string | undefined) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
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
