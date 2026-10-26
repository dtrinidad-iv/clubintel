import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { OpportunitiesView } from "@/components/opportunities/opportunities-view";
import { OpportunityFilters } from "@/components/opportunities/opportunity-filters";
import { OwnerNamesProvider } from "@/components/opportunities/owner-names";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/lib/dal";
import { formOptions, listOpportunities } from "@/lib/opportunities";
import { OPPORTUNITY_LIMIT, opportunityFiltersSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Opportunities" };

export default function OpportunitiesPage({ searchParams }: PageProps<"/opportunities">) {
  return (
    <>
      <PageHeader title="Opportunities" description="Every commercial deal your workspace is working on, from lead to signed." />
      <Suspense fallback={<Fallback />}>
        <Opportunities searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Opportunities({ searchParams }: { searchParams: PageProps<"/opportunities">["searchParams"] }) {
  const { workspace } = await requirePermission("opportunities.view");
  const filters = opportunityFiltersSchema.parse(await searchParams);
  const { view, ...query } = filters;
  const [rows, options] = await Promise.all([listOpportunities(workspace.id, query), formOptions(workspace.id)]);
  const can = (p: string) => workspace.permissions.includes(p);

  return (
    <OwnerNamesProvider members={options.members}>
      <OpportunityFilters filters={filters} members={options.members} />
      <OpportunitiesView
        rows={rows}
        options={options}
        view={view}
        canWrite={can("opportunities.write")}
        canDelete={can("opportunities.delete")}
        filtered={Boolean(query.id || query.q || query.stage || query.category || query.owner)}
        truncated={rows.length === OPPORTUNITY_LIMIT}
      />
    </OwnerNamesProvider>
  );
}

function Fallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading opportunities">
      <Skeleton className="h-16" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}
