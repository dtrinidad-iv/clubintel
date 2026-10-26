import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Alerts and rules for a workspace, read as the user (RLS: alerts.view). Read state is the
// caller's own: RLS on alert_reads returns only their rows.

const ALERT_COLUMNS = "id, type, title, body, opportunity_id, club_id, created_at, alert_reads(read_at)";

// Every unread alert (so the list agrees with the badge), then the latest read ones.
export async function listAlerts(workspaceId: string) {
  const supabase = await createClient();
  const [unread, recent] = await Promise.all([
    supabase
      .from("alerts")
      .select(ALERT_COLUMNS)
      .eq("workspace_id", workspaceId)
      .is("alert_reads", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("alerts").select(ALERT_COLUMNS).eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (unread.error) throw unread.error;
  if (recent.error) throw recent.error;
  const toItem = ({ alert_reads, ...a }: (typeof recent.data)[number]) => ({ ...a, read: alert_reads.length > 0 });
  const unreadIds = new Set(unread.data.map((a) => a.id));
  return [...unread.data.map(toItem), ...recent.data.filter((a) => !unreadIds.has(a.id)).map(toItem).filter((a) => a.read)];
}

export type AlertItem = Awaited<ReturnType<typeof listAlerts>>[number];

// For the sidebar badge. Rendered on every page, so a failure shows no badge rather than an
// error page.
export const unreadAlertCount = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unread_alert_count");
  if (error) {
    console.error(error);
    return 0;
  }
  return data ?? 0;
});

export async function listRules(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alert_rules")
    .select("id, type, days, drop_pct, enabled, last_run_at, created_at, club:clubs(id, name)")
    .eq("workspace_id", workspaceId)
    .order("created_at");
  if (error) throw error;
  return data;
}

export type AlertRuleRow = Awaited<ReturnType<typeof listRules>>[number];
