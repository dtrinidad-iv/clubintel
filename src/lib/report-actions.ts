"use server";

import { refresh } from "next/cache";
import { dbError, invalid, keep, type ActionState } from "@/lib/action-state";
import { checkPermission, NO_PERMISSION } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { aiBudgetSchema, reviewDecisionSchema, uuidSchema } from "@/lib/validation";

// Reviewing goes through review_report(), which checks reports.approve and that the report is a
// draft in the caller's workspace. The budget is a column the workspace.manage policy covers.

export async function reviewReport(id: string, decision: string): Promise<ActionState> {
  const ctx = await checkPermission("reports.approve");
  if (!ctx) return { error: NO_PERMISSION };
  const reportId = uuidSchema.safeParse(id);
  const choice = reviewDecisionSchema.safeParse(decision);
  if (!reportId.success || !choice.success) return { error: "That report no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_report", { p_id: reportId.data, p_decision: choice.data });
  if (error) {
    refresh();
    return dbError(error);
  }
  refresh();
  return { message: choice.data === "approved" ? "Report approved." : "Report discarded." };
}

export async function setAiBudget(_: ActionState, formData: FormData): Promise<ActionState> {
  const values = keep(formData, "budget");
  const ctx = await checkPermission("workspace.manage");
  if (!ctx) return { error: NO_PERMISSION, values };
  const parsed = aiBudgetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ ai_monthly_budget_usd: parsed.data.budget })
    .eq("id", ctx.workspace.id)
    .select("id");
  if (error) return { ...dbError(error), values };
  if (data.length === 0) return { error: NO_PERMISSION, values };
  refresh();
  return { message: "Budget saved." };
}
