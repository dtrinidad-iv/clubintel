import "server-only";
import { createClient } from "@/lib/supabase/server";

// Dashboard numbers, aggregated in Postgres. The functions run as the user (RLS applies) and
// count only the active workspace, so they take no workspace id.

export async function getKpis() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_kpis").single();
  if (error) throw error;
  // The average is null when nothing was won; the generated type can't say so.
  return { ...data, avg_won_value: data.avg_won_value as number | null };
}

export async function getPipelineByStage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_pipeline_by_stage");
  if (error) throw error;
  return data;
}

export async function getWonByMonth() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_won_by_month");
  if (error) throw error;
  return data;
}

export async function getValueByTier() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_value_by_tier");
  if (error) throw error;
  return data;
}

export async function getUpcoming() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_upcoming");
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
