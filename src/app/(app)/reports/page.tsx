import { FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { ReportGenerator } from "@/components/reports/report-generator";
import { ReportStatusBadge } from "@/components/reports/report-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { aiConfig } from "@/lib/ai/client";
import { requirePermission } from "@/lib/dal";
import { formatDateTime, formatUsd } from "@/lib/format";
import { getAiBudgetStatus, listReports, memberNames } from "@/lib/reports";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Commercial intelligence reports written by Claude from your pipeline, approved by an admin." />
      <Suspense fallback={<Fallback />}>
        <Reports />
      </Suspense>
    </>
  );
}

async function Reports() {
  const { workspace } = await requirePermission("reports.view");
  const canGenerate = workspace.permissions.includes("ai.use");
  const provider = aiConfig().provider;
  const [reports, names, budget] = await Promise.all([
    listReports(workspace.id),
    memberNames(workspace.id),
    canGenerate ? getAiBudgetStatus() : null,
  ]);

  return (
    <div className="grid grid-cols-1 gap-6">
      {canGenerate &&
        (provider === "off" ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            AI isn&apos;t set up for this deployment, so new reports can&apos;t be generated. Existing reports are below.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            <ReportGenerator sample={provider === "fake"} />
            {budget && (
              <p className="text-xs text-muted-foreground" data-testid="ai-budget">
                {formatUsd(budget.spent_usd)} of {formatUsd(budget.budget_usd)} AI budget used this month.
              </p>
            )}
          </div>
        ))}

      <section className="grid grid-cols-1 gap-3" aria-labelledby="past-reports">
        <h2 id="past-reports" className="text-lg font-semibold">
          Past reports
        </h2>
        {reports.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
            <FileText className="size-6 text-muted-foreground" aria-hidden />
            <h3 className="font-medium">No reports yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              {canGenerate ? "Generate the first one above." : "Analysts and admins can generate one."}
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border" data-testid="report-list">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/reports/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                    {r.title}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatDateTime(r.created_at)} · {r.created_by ? (names.get(r.created_by) ?? "Former member") : "Former member"}
                    {r.focus ? ` · Focus: ${r.focus}` : ""}
                  </p>
                </div>
                <ReportStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Fallback() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading reports">
      <Skeleton className="h-48" />
      <Skeleton className="h-64" />
    </div>
  );
}
