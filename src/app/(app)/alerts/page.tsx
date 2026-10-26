import { AlertTriangle, Bell, CalendarX, Clock, TrendingDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MarkAllReadButton, MarkReadButton, RunChecksButton } from "@/components/alerts/alert-controls";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listAlerts, type AlertItem } from "@/lib/alerts";
import { requirePermission } from "@/lib/dal";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return (
    <>
      <PageHeader title="Alerts" description="Deals that need attention and changes at clubs you watch, checked every morning." />
      <Suspense fallback={<Fallback />}>
        <Alerts />
      </Suspense>
    </>
  );
}

const ICONS = { stale_opportunity: Clock, close_date_passed: CalendarX, attendance_drop: TrendingDown } as const;

async function Alerts() {
  const { workspace } = await requirePermission("alerts.view");
  const canManage = workspace.permissions.includes("alerts.manage");
  const alerts = await listAlerts(workspace.id);
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground outline-none" role="status" tabIndex={-1} data-alerts-status>
          {unread === 0 ? "You're all caught up." : `${unread} unread`}
        </p>
        <div className="flex flex-wrap gap-2">
          {unread > 0 && <MarkAllReadButton />}
          {canManage && (
            <>
              <Button variant="outline" asChild>
                <Link href="/alerts/rules">Manage rules</Link>
              </Button>
              <RunChecksButton />
            </>
          )}
          {!canManage && (
            <Button variant="ghost" asChild>
              <Link href="/alerts/rules">See rules</Link>
            </Button>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
          <Bell className="size-6 text-muted-foreground" aria-hidden />
          <h2 className="font-medium">No alerts yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canManage ? "Add a rule, then run checks: matching deals and clubs show up here." : "Owners and admins set the rules that raise alerts."}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="alert-list">
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: AlertItem }) {
  const Icon = ICONS[alert.type] ?? AlertTriangle;
  const href = alert.opportunity_id ? `/opportunities?id=${alert.opportunity_id}` : alert.club_id ? `/clubs/${alert.club_id}` : null;
  return (
    <li className={`flex items-start gap-3 px-4 py-3 ${alert.read ? "" : "bg-muted/40"}`} data-testid="alert" data-read={alert.read}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className="font-medium underline-offset-4 hover:underline">
              {alert.title}
            </Link>
          ) : (
            <span className="font-medium">{alert.title}</span>
          )}
          {!alert.read && <Badge>New</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{alert.body}</p>
        <time className="text-xs text-muted-foreground" dateTime={alert.created_at}>
          {formatDateTime(alert.created_at)}
        </time>
      </div>
      {!alert.read && <MarkReadButton alertId={alert.id} title={alert.title} />}
    </li>
  );
}

function Fallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading alerts">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-80" />
    </div>
  );
}
