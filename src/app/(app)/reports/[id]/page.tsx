import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { ReportBody } from "@/components/reports/report-body";
import { ReportStatusBadge } from "@/components/reports/report-status-badge";
import { ReviewButtons } from "@/components/reports/review-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requirePermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";
import { getReport, memberNames } from "@/lib/reports";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Report" };

export default function ReportPage({ params }: PageProps<"/reports/[id]">) {
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground">
        <Link href="/reports">
          <ArrowLeft aria-hidden /> All reports
        </Link>
      </Button>
      <Suspense fallback={<Fallback />}>
        <Report params={params} />
      </Suspense>
    </>
  );
}

async function Report({ params }: { params: PageProps<"/reports/[id]">["params"] }) {
  const { workspace } = await requirePermission("reports.view");
  const id = uuidSchema.safeParse((await params).id);
  const report = id.success ? await getReport(workspace.id, id.data) : null;
  if (!report) notFound();
  const names = await memberNames(workspace.id);
  const name = (userId: string | null) => (userId ? (names.get(userId) ?? "Former member") : "Former member");
  const canReview = workspace.permissions.includes("reports.approve") && report.status === "draft";

  return (
    <>
      <PageHeader title={report.title} description={`${formatDateTime(report.created_at)} · by ${name(report.created_by)}`}>
        {canReview && <ReviewButtons reportId={report.id} />}
      </PageHeader>
      <div className="grid max-w-3xl gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" data-testid="report-meta">
          <ReportStatusBadge status={report.status} />
          {report.model === "fake" && <Badge variant="outline">Sample output</Badge>}
          {report.reviewed_at && (
            <span>
              {report.status === "approved" ? "Approved" : "Discarded"} by {name(report.reviewed_by)}, {formatDateTime(report.reviewed_at)}
            </span>
          )}
          {report.focus && <span>Focus: {report.focus}</span>}
        </div>

        {report.status === "draft" && (
          <p className="text-sm text-muted-foreground">
            Written by Claude ({report.model}). Check it against your own knowledge before acting on it; an admin approves or discards it.
          </p>
        )}

        <Card>
          <CardContent>
            {report.content ? (
              <ReportBody report={report.content} />
            ) : report.status === "generating" ? (
              <p className="text-sm text-muted-foreground">This report is still being written. Refresh in a moment.</p>
            ) : (
              <p className="text-sm text-muted-foreground" role="status">
                No report was saved{report.error ? `: ${report.error}` : "."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Fallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading report">
      <Skeleton className="h-10 w-80" />
      <Skeleton className="h-96 max-w-3xl" />
    </div>
  );
}
