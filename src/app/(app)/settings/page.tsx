import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddMemberForm, AiBudgetForm, MembersTable, RenameWorkspaceForm, type MemberRow } from "@/components/workspace/settings-forms";
import { requireWorkspace, type Role, type Workspace } from "@/lib/dal";
import { formatDateTime, formatNumber, formatUsd } from "@/lib/format";
import { getAiBudgetStatus, listAiUsage, memberNames } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

const RANK: Record<Role, number> = { owner: 4, admin: 3, analyst: 2, viewer: 1 };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your workspace and who can access it." />
      <Suspense fallback={<SettingsFallback />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const { user, workspace } = await requireWorkspace();
  const can = (p: string) => workspace.permissions.includes(p);
  const myRank = RANK[workspace.role];

  // The UI mirrors the database's rank rule only to hide controls; the RPCs enforce it.
  const assignable = (["admin", "analyst", "viewer"] as const).filter((r) => RANK[r] < myRank);

  let members: MemberRow[] = [];
  if (can("members.view")) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("workspace_members", { ws: workspace.id });
    if (error) throw error;
    members = data.map((m) => ({
      userId: m.user_id,
      name: m.full_name || m.email,
      email: m.email,
      role: m.role,
      isYou: m.user_id === user.id,
      manageable: can("members.manage") && m.user_id !== user.id && RANK[m.role] < myRank,
    }));
  }

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>The name everyone in this workspace sees.</CardDescription>
        </CardHeader>
        <CardContent>
          <RenameWorkspaceForm name={workspace.name} canEdit={can("workspace.manage")} />
        </CardContent>
      </Card>

      {can("members.view") && (
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              Owners and admins manage members. You can only change people ranked below you.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {can("members.manage") && <AddMemberForm roles={assignable} />}
            <MembersTable members={members} assignable={assignable} />
          </CardContent>
        </Card>
      )}

      {can("workspace.manage") && (
        <Suspense fallback={<Skeleton className="h-64" aria-busy="true" aria-label="Loading AI usage" />}>
          <AiUsageCard workspace={workspace} />
        </Suspense>
      )}
    </div>
  );
}

function SettingsFallback() {
  return (
    <div className="grid max-w-4xl gap-6" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-40" />
      <Skeleton className="h-72" />
    </div>
  );
}

// This month's AI spend against the budget, and the latest calls. Owners and admins only.
async function AiUsageCard({ workspace }: { workspace: Workspace }) {
  const [status, usage, names] = await Promise.all([getAiBudgetStatus(), listAiUsage(workspace.id), memberNames(workspace.id)]);
  const spent = status?.spent_usd ?? 0;
  const budget = status?.budget_usd ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI usage</CardTitle>
        <CardDescription>
          What Claude has cost this workspace this month, in US dollars as Anthropic bills. Each report holds its worst-case cost until
          the real cost is known. New reports stop when the budget is used up.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p className="text-sm" data-testid="ai-usage-summary">
          <span className="text-2xl font-semibold tabular-nums">{formatUsd(spent)}</span>{" "}
          <span className="text-muted-foreground">of {formatUsd(budget)} this month</span>
        </p>
        <div className="grid gap-2">
          <AiBudgetForm budget={status?.workspace_budget_usd ?? budget} />
          {status && status.workspace_budget_usd > status.platform_cap_usd && (
            <p className="text-sm text-muted-foreground">This deployment caps every workspace at {formatUsd(status.platform_cap_usd)} a month.</p>
          )}
        </div>
        {usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">No AI calls yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Tokens in / out</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(u.created_at)}</TableCell>
                    <TableCell>{u.user_id ? (names.get(u.user_id) ?? "Former member") : "Former member"}</TableCell>
                    <TableCell>{u.model}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(u.input_tokens)} / {formatNumber(u.output_tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(u.cost_usd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
