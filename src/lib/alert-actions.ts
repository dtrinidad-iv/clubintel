"use server";

import { refresh } from "next/cache";
import { dbError, invalid, keep, type ActionState } from "@/lib/action-state";
import { checkPermission, NO_PERMISSION } from "@/lib/dal";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { alertRuleSchema, uuidSchema, type AlertRuleInput } from "@/lib/validation";

// Rules are tenant rows (RLS: alerts.manage, column grants); evaluation and read state go
// through functions that check the caller. The workspace always comes from the server.

const GONE = "That rule no longer exists.";

function toRow(input: AlertRuleInput): TablesInsert<"alert_rules"> {
  switch (input.type) {
    case "stale_opportunity":
    case "close_date_passed":
      return { type: input.type, days: input.days, club_id: null, drop_pct: null };
    case "attendance_drop":
      return { type: input.type, days: null, club_id: input.clubId, drop_pct: input.dropPct };
  }
}

export async function createRule(_: ActionState, formData: FormData): Promise<ActionState> {
  const values = keep(formData, "type", "days", "clubId", "dropPct");
  if (!(await checkPermission("alerts.manage"))) return { error: NO_PERMISSION, values };
  const parsed = alertRuleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("alert_rules").insert(toRow(parsed.data));
  if (error) {
    if (error.code === "23503") return { fieldErrors: { clubId: ["Choose a club from the list."] }, values };
    return { ...dbError(error), values };
  }
  refresh();
  return { message: "Rule added. It runs with the next check." };
}

export async function setRuleEnabled(id: string, enabled: boolean): Promise<ActionState> {
  const ctx = await checkPermission("alerts.manage");
  if (!ctx) return { error: NO_PERMISSION };
  const ruleId = uuidSchema.safeParse(id);
  if (!ruleId.success) return { error: GONE };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alert_rules")
    .update({ enabled: enabled === true })
    .eq("id", ruleId.data)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return dbError(error);
  refresh();
  if (data.length === 0) return { error: GONE };
  return { message: enabled ? "Rule turned on." : "Rule turned off." };
}

export async function deleteRule(id: string): Promise<ActionState> {
  const ctx = await checkPermission("alerts.manage");
  if (!ctx) return { error: NO_PERMISSION };
  const ruleId = uuidSchema.safeParse(id);
  if (!ruleId.success) return { error: GONE };

  const supabase = await createClient();
  const { data, error } = await supabase.from("alert_rules").delete().eq("id", ruleId.data).eq("workspace_id", ctx.workspace.id).select("id");
  if (error) return dbError(error);
  refresh();
  if (data.length === 0) return { error: GONE };
  return { message: "Rule deleted. Its past alerts stay in the inbox." };
}

export async function runChecks(): Promise<ActionState> {
  if (!(await checkPermission("alerts.manage"))) return { error: NO_PERMISSION };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_alert_checks");
  if (error) return dbError(error);
  refresh();
  return { message: data === 0 ? "No new alerts." : data === 1 ? "1 new alert." : `${data} new alerts.` };
}

export async function markAlertRead(id: string): Promise<ActionState> {
  if (!(await checkPermission("alerts.view"))) return { error: NO_PERMISSION };
  const alertId = uuidSchema.safeParse(id);
  if (!alertId.success) return { error: "That alert no longer exists." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_alert_read", { p_alert: alertId.data });
  if (error) return dbError(error);
  refresh();
  return null;
}

export async function markAllAlertsRead(): Promise<ActionState> {
  if (!(await checkPermission("alerts.view"))) return { error: NO_PERMISSION };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_alerts_read");
  if (error) return dbError(error);
  refresh();
  return { message: "All alerts marked read." };
}
