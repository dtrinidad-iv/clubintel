import "server-only";
import type { ReportPromptData } from "@/lib/ai/prompts/report";
import { getKpis, getPipelineByStage, getUpcoming, getValueByTier, getWonByMonth } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";

// What the report prompt sees, read as the user (RLS applies) for one workspace. Deliberately
// left out: contacts' emails and phones, owners' names, and anything from other workspaces.

const TOP_DEALS = 25;
const NOTE_LIMIT = 300;

export async function gatherReportData(workspace: { id: string; name: string }): Promise<ReportPromptData> {
  const supabase = await createClient();
  const [kpis, pipelineByStage, wonByMonth, openValueByTier, upcoming, deals] = await Promise.all([
    getKpis(workspace.id),
    getPipelineByStage(workspace.id),
    getWonByMonth(workspace.id),
    getValueByTier(workspace.id),
    getUpcoming(workspace.id),
    supabase
      .from("opportunities")
      .select("title, partner_name, category, stage, value_gbp, expected_close_date, stage_changed_at, notes, club_id")
      .eq("workspace_id", workspace.id)
      .in("stage", ["lead", "qualified", "proposal", "negotiation"])
      .order("value_gbp", { ascending: false })
      .limit(TOP_DEALS),
  ]);
  if (deals.error) throw deals.error;

  const clubIds = [...new Set(deals.data.map((d) => d.club_id))];
  const clubs = clubIds.length
    ? await supabase
        .from("club_directory")
        .select("id, name, league_name, tier, city, capacity, latest_season, league_position, avg_attendance")
        .in("id", clubIds)
    : { data: [], error: null };
  if (clubs.error) throw clubs.error;
  const clubName = new Map(clubs.data.map((c) => [c.id, c.name]));

  const now = Date.now();
  return {
    workspace: workspace.name,
    today: new Date(now).toISOString().slice(0, 10),
    kpis,
    pipelineByStage,
    wonByMonth,
    openValueByTier,
    upcomingCloseDates: upcoming.map((u) => ({
      title: u.title,
      club: u.club_name,
      stage: u.stage,
      value_gbp: u.value_gbp,
      expected_close_date: u.expected_close_date,
      overdue: u.overdue,
    })),
    topOpenDeals: deals.data.map((d) => ({
      title: d.title,
      partner: d.partner_name,
      club: clubName.get(d.club_id) ?? null,
      category: d.category,
      stage: d.stage,
      value_gbp: d.value_gbp,
      expected_close_date: d.expected_close_date,
      days_since_stage_change: Math.floor((now - new Date(d.stage_changed_at).getTime()) / 86_400_000),
      notes: d.notes ? d.notes.slice(0, NOTE_LIMIT) : null,
    })),
    clubs: clubs.data.map((c) => ({
      name: c.name,
      league: c.league_name,
      tier: c.tier,
      city: c.city,
      capacity: c.capacity,
      latest_season: c.latest_season,
      league_position: c.league_position,
      avg_attendance: c.avg_attendance,
    })),
  };
}
