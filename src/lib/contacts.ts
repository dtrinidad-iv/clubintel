import "server-only";
import { likePattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

// Queries for a workspace's contacts. They run as the user, so RLS decides what's visible.

export async function listContacts(workspaceId: string, q?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("id, name, email, role_title, phone, notes, club_id, club:clubs(id, name), opportunities(count)")
    .eq("workspace_id", workspaceId);
  if (q) query = query.ilike("name", likePattern(q));
  const { data, error } = await query.order("name").limit(500);
  if (error) throw error;
  // The embedded count runs under RLS on opportunities, so it only counts this workspace's.
  return data.map(({ opportunities, ...contact }) => ({ ...contact, opportunityCount: opportunities[0]?.count ?? 0 }));
}

export type ContactRow = Awaited<ReturnType<typeof listContacts>>[number];
