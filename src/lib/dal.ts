import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

// Data Access Layer: every page, Server Action and Route Handler gets the user and
// workspace from here. The workspace always comes from the server, never the request.

export type Role = Database["public"]["Enums"]["workspace_role"];
export type User = { id: string; email: string; fullName: string };
export type Workspace = { id: string; name: string; role: Role; permissions: string[] };

export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) return null;

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.claims.sub).maybeSingle();
  return { id: data.claims.sub, email: data.claims.email ?? "", fullName: profile?.full_name ?? "" };
});

export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getCurrentWorkspace = cache(async (): Promise<Workspace | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_workspace").maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: permissions, error: permError } = await supabase.rpc("my_permissions", { ws: data.id });
  if (permError) throw permError;
  return { ...data, permissions: permissions ?? [] };
});

// Signed in with an active workspace. Without one (new account, or removed from it), fall back
// to the user's first membership through the membership-checked RPC, else go to onboarding.
export const requireWorkspace = cache(async (): Promise<{ user: User; workspace: Workspace }> => {
  const user = await requireUser();
  const workspace = await getCurrentWorkspace();
  if (workspace) return { user, workspace };

  const [first] = await listMyWorkspaces();
  if (!first) redirect("/onboarding");

  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_workspace", { ws: first.id });
  if (error) throw error;
  const { data, error: wsError } = await supabase.rpc("my_permissions", { ws: first.id });
  if (wsError) throw wsError;
  return { user, workspace: { id: first.id, name: first.name, role: first.role, permissions: data ?? [] } };
});

export async function requirePermission(permission: string) {
  const ctx = await requireWorkspace();
  if (!ctx.workspace.permissions.includes(permission)) {
    throw new PermissionError(permission);
  }
  return ctx;
}

export const listMyWorkspaces = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, workspace:workspaces(id, name)")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw error;
  return data.flatMap((m) => (m.workspace ? [{ id: m.workspace.id, name: m.workspace.name, role: m.role }] : []));
});

export class PermissionError extends Error {
  constructor(permission: string) {
    super(`Missing permission: ${permission}`);
  }
}
