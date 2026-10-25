import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddMemberForm, MembersTable, RenameWorkspaceForm, type MemberRow } from "@/components/workspace/settings-forms";
import { requireWorkspace, type Role } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

const RANK: Record<Role, number> = { owner: 4, admin: 3, analyst: 2, viewer: 1 };

export default async function SettingsPage() {
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
    <>
      <PageHeader title="Settings" description="Your workspace and who can access it." />
      <div className="grid max-w-4xl gap-6">
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
      </div>
    </>
  );
}
