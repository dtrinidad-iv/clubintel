import "server-only";
import { cache } from "react";
import { reportSchema } from "@/lib/ai/report-schema";
import { createClient } from "@/lib/supabase/server";

// Reports for a workspace, read as the user (RLS: reports.view). Names come from the members
// list, so a removed member shows as "Former member".

const REPORT_COLUMNS = "id, title, focus, status, content, model, error, created_by, created_at, reviewed_by, reviewed_at";

export async function listReports(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, title, focus, status, model, created_by, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export type ReportListItem = Awaited<ReturnType<typeof listReports>>[number];

export const getReport = cache(async (workspaceId: string, id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("reports").select(REPORT_COLUMNS).eq("workspace_id", workspaceId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Saved content was validated before saving; parse again so the page never renders junk.
  const content = data.content ? reportSchema.safeParse(data.content) : null;
  return { ...data, content: content?.success ? content.data : null };
});

export type ReportDetail = NonNullable<Awaited<ReturnType<typeof getReport>>>;

export const memberNames = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("workspace_members", { ws: workspaceId });
  if (error) throw error;
  return new Map(data.map((m) => [m.user_id, m.full_name || m.email]));
});

export async function getAiBudgetStatus() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ai_budget_status").maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAiUsage(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_usage")
    .select("id, model, input_tokens, output_tokens, cost_usd, created_at, user_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return data;
}
