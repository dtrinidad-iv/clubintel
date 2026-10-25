import "server-only";
import { createClient } from "@/lib/supabase/server";

// Dashboard numbers, aggregated in Postgres. The functions run as the user (RLS applies). They
// count the active workspace, or a named one (the AI report names the one it opened in).

export async function getKpis(workspaceId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_kpis", { ws: workspaceId }).single();
  if (error) throw error;
  // The average is null when nothing was won; the generated type can't say so.
  return { ...data, avg_won_value: data.avg_won_value as number | null };
}

export async function getPipelineByStage(workspaceId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_pipeline_by_stage", { ws: workspaceId });
  if (error) throw error;
  return data;
}

export async function getWonByMonth(workspaceId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_won_by_month", { ws: workspaceId });
  if (error) throw error;
  return data;
}

export async function getValueByTier(workspaceId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_value_by_tier", { ws: workspaceId });
  if (error) throw error;
  return data;
}

export async function getUpcoming(workspaceId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_upcoming", { ws: workspaceId });
  if (error) throw error;
  return data;
}

export type UpcomingDeal = Awaited<ReturnType<typeof getUpcoming>>[number];

export async function getNationalAttendance() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("national_attendance_by_tier");
  if (error) throw error;
  return data;
}
