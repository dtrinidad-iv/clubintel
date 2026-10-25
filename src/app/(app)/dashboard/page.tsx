import { Building2, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/dal";
import { roleLabel } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, workspace } = await requireWorkspace();
  const supabase = await createClient();
  const { count } = await supabase
    .from("memberships")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspace.id);

  const cards = [
    { label: "Workspace", value: workspace.name, icon: Building2 },
    { label: "Your role", value: roleLabel(workspace.role), icon: ShieldCheck },
    { label: "Members", value: String(count ?? 0), icon: Users },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome${user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        description="Commercial intelligence for your club, in one place."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <card.icon className="size-4" aria-hidden />
                {card.label}
              </CardDescription>
              <CardTitle className="truncate text-xl">{card.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </>
  );
}
