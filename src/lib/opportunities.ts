import "server-only";
import { cache } from "react";
import { clubOptions } from "@/lib/clubs";
import { likePattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";
import { OPPORTUNITY_LIMIT, type OpportunityFilters } from "@/lib/validation";

// Queries for a workspace's opportunities. They run as the user, so RLS decides
// what's visible; the workspace filter keeps the query honest about intent, not secure.

const OPPORTUNITY_COLUMNS =
  "id, title, partner_name, category, stage, value_gbp, expected_close_date, notes, stage_changed_at, club_id, contact_id, owner_id, club:clubs(id, name), contact:contacts(id, name)";

export async function listOpportunities(workspaceId: string, filters: Omit<OpportunityFilters, "view">) {
  const supabase = await createClient();
  let query = supabase.from("opportunities").select(OPPORTUNITY_COLUMNS).eq("workspace_id", workspaceId);
  if (filters.id) query = query.eq("id", filters.id);
  if (filters.q) query = query.ilike("search_text", likePattern(filters.q));
  if (filters.stage) query = query.eq("stage", filters.stage);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.owner === "none") query = query.is("owner_id", null);
  else if (filters.owner) query = query.eq("owner_id", filters.owner);

  const { data, error } = await query.order("stage_changed_at", { ascending: false }).limit(OPPORTUNITY_LIMIT);
  if (error) throw error;
  return data;
}

export type OpportunityRow = Awaited<ReturnType<typeof listOpportunities>>[number];

// Choices for the opportunity form.
export const formOptions = cache(async (workspaceId: string) => {
  const supabase = await createClient();
  const [clubs, members, contacts] = await Promise.all([
    clubOptions(),
    supabase.rpc("workspace_members", { ws: workspaceId }),
    supabase.from("contacts").select("id, name").eq("workspace_id", workspaceId).order("name").limit(500),
  ]);
  if (members.error) throw members.error;
  if (contacts.error) throw contacts.error;
  return {
    clubs,
    members: members.data.map((m) => ({ id: m.user_id, name: m.full_name || m.email })),
    contacts: contacts.data,
  };
});

export type FormOptions = Awaited<ReturnType<typeof formOptions>>;
