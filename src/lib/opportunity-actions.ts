"use server";

import { refresh } from "next/cache";
import { dbError, invalid, keep, type ActionState } from "@/lib/action-state";
import { checkPermission, NO_PERMISSION } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { opportunitySchema, opportunityStageSchema, uuidSchema, type OpportunityInput } from "@/lib/validation";

// The workspace always comes from the server (a trigger sets workspace_id from the active
// workspace); the form never sends it. RLS and column grants re-check everything below.

const FIELDS = ["title", "partnerName", "clubId", "category", "stage", "valueGbp", "ownerId", "contactId", "expectedCloseDate", "notes"];
const GONE = "That opportunity no longer exists.";

function toRow(input: OpportunityInput) {
  return {
    title: input.title,
    partner_name: input.partnerName,
    club_id: input.clubId,
    category: input.category,
    stage: input.stage,
    value_gbp: input.valueGbp,
    owner_id: input.ownerId,
    contact_id: input.contactId,
    expected_close_date: input.expectedCloseDate,
    notes: input.notes,
  };
}

// A link that isn't in this workspace (or a club that doesn't exist) fails a foreign key (23503).
function linkError(error: { code?: string; message: string }): ActionState {
  if (error.code !== "23503") return dbError(error);
  if (error.message.includes("club_id")) return { error: "Choose a club from the list." };
  return { error: "That owner or contact isn't in this workspace." };
}

// id is bound for edits and null for new opportunities. Every error keeps what was typed.
export async function saveOpportunity(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const values = keep(formData, ...FIELDS);
  const ctx = await checkPermission("opportunities.write");
  if (!ctx) return { error: NO_PERMISSION, values };
  const parsed = opportunitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  if (id === null) {
    const { error } = await supabase.from("opportunities").insert(toRow(parsed.data));
    if (error) return { ...linkError(error), values };
  } else {
    const opportunityId = uuidSchema.safeParse(id);
    if (!opportunityId.success) return { error: GONE, values };
    const { data, error } = await supabase
      .from("opportunities")
      .update(toRow(parsed.data))
      .eq("id", opportunityId.data)
      .eq("workspace_id", ctx.workspace.id)
      .select("id");
    if (error) return { ...linkError(error), values };
    if (data.length === 0) {
      refresh();
      return { error: GONE, values };
    }
  }
  refresh();
  return { message: id === null ? "Opportunity added." : "Opportunity saved." };
}

export async function moveOpportunity(id: string, stage: string): Promise<ActionState> {
  const ctx = await checkPermission("opportunities.write");
  if (!ctx) return { error: NO_PERMISSION };
  const opportunityId = uuidSchema.safeParse(id);
  const nextStage = opportunityStageSchema.safeParse(stage);
  if (!opportunityId.success || !nextStage.success) return { error: "Choose a valid stage." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .update({ stage: nextStage.data })
    .eq("id", opportunityId.data)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return dbError(error);
  // Refresh either way: if it's gone, the stale card disappears too.
  refresh();
  return data.length === 0 ? { error: GONE } : null;
}

export async function deleteOpportunity(id: string): Promise<ActionState> {
  const ctx = await checkPermission("opportunities.delete");
  if (!ctx) return { error: NO_PERMISSION };
  const opportunityId = uuidSchema.safeParse(id);
  if (!opportunityId.success) return { error: GONE };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .delete()
    .eq("id", opportunityId.data)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return dbError(error);
  refresh();
  return data.length === 0 ? { error: GONE } : { message: "Opportunity deleted." };
}
