import { ArrowLeft, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewRuleButton, RuleControls } from "@/components/alerts/alert-controls";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listRules, type AlertRuleRow } from "@/lib/alerts";
import { clubOptions } from "@/lib/clubs";
import { requirePermission } from "@/lib/dal";
import { alertRuleTypeLabel, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Alert rules" };

export default function AlertRulesPage() {
  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground">
        <Link href="/alerts">
          <ArrowLeft aria-hidden /> Alerts
        </Link>
      </Button>
      <PageHeader title="Alert rules" description="What this workspace watches for. Owners and admins change the rules." />
      <Suspense fallback={<Skeleton className="h-64" aria-busy="true" aria-label="Loading rules" />}>
        <Rules />
      </Suspense>
    </>
  );
}

function describe(rule: AlertRuleRow): string {
  switch (rule.type) {
    case "stale_opportunity":
      return `An open deal has had no stage change for ${rule.days} days.`;
    case "close_date_passed":
      return rule.days === 0
        ? "An open deal is past its expected close date."
        : `An open deal is more than ${rule.days} days past its expected close date.`;
    case "attendance_drop":
      return `${rule.club?.name ?? "A club"}'s average attendance falls by ${rule.drop_pct}% or more on the season before.`;
  }
}

// Short enough for a button's accessible name, and tells rules of one type apart.
function shortName(rule: AlertRuleRow): string {
  const type = alertRuleTypeLabel(rule.type);
  switch (rule.type) {
    case "stale_opportunity":
      return `${type}, ${rule.days} days`;
    case "close_date_passed":
      return `${type}, ${rule.days} days' grace`;
    case "attendance_drop":
      return `${type}, ${rule.club?.name ?? "club"} ${rule.drop_pct}%`;
  }
}

async function Rules() {
  const { workspace } = await requirePermission("alerts.view");
  const canManage = workspace.permissions.includes("alerts.manage");
  const [rules, clubs] = await Promise.all([listRules(workspace.id), canManage ? clubOptions() : []]);

  return (
    <div className="grid grid-cols-1 gap-4">
      {canManage && (
        <div className="flex justify-end">
          <NewRuleButton clubs={clubs} />
        </div>
      )}
      {rules.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
          <ListChecks className="size-6 text-muted-foreground" aria-hidden />
          <h2 className="font-medium">No rules yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            {canManage ? "Add one to start getting alerts." : "Owners and admins add the rules."}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="rule-list">
          {rules.map((rule) => {
            const label = alertRuleTypeLabel(rule.type);
            return (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid="rule">
                <div className="grid min-w-0 gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{label}</span>
                    {!rule.enabled && <Badge variant="outline">Off</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{describe(rule)}</p>
                  <p className="text-xs text-muted-foreground">{rule.last_run_at ? `Last checked ${formatDateTime(rule.last_run_at)}` : "Not checked yet"}</p>
                </div>
                {canManage && <RuleControls ruleId={rule.id} name={shortName(rule)} description={describe(rule)} enabled={rule.enabled} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
