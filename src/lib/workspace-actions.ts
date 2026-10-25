"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, invalid, keep, type ActionState } from "@/lib/action-state";
import { requirePermission, requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { addMemberSchema, memberChangeSchema, uuidSchema, workspaceNameSchema } from "@/lib/validation";

// Every action that acts on "this workspace" takes it from requireWorkspace(), never from the form.

export async function createWorkspace(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = workspaceNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, keep(formData, "name"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_workspace", { p_name: parsed.data.name });
  if (error) return dbError(error);
  redirect("/dashboard");
}

// The id picks which membership to switch to; the RPC refuses any workspace you aren't a member of.
export async function switchWorkspace(workspaceId: string) {
  await requireUser();
  const id = uuidSchema.parse(workspaceId);
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_workspace", { ws: id });
  if (error) throw new Error(dbError(error)?.error);
  // Everything on screen belonged to the old workspace: re-render the layout too
  // (a redirect to the URL you're already on doesn't), and leave pages scoped to it.
  refresh();
  redirect("/dashboard");
}

export async function renameWorkspace(_: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await requirePermission("workspace.manage");
  const parsed = workspaceNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, keep(formData, "name"));

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").update({ name: parsed.data.name }).eq("id", workspace.id);
  if (error) return dbError(error);
  refresh();
  return { message: "Workspace renamed.", values: { name: parsed.data.name } };
}

export async function addMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const { workspace } = await requirePermission("members.manage");
  const parsed = addMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, keep(formData, "email"));

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_member_by_email", {
    ws: workspace.id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) return { ...dbError(error), values: keep(formData, "email") };
  refresh();
  return { message: `Added ${parsed.data.email}.` };
}

export async function changeMemberRole(userId: string, role: string): Promise<ActionState> {
  const { workspace } = await requirePermission("members.manage");
  const parsed = memberChangeSchema.safeParse({ userId, role });
  if (!parsed.success) return { error: "Choose a valid role." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    ws: workspace.id,
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
  });
  if (error) return dbError(error);
  refresh();
  return { message: "Role updated." };
}

export async function removeMember(userId: string): Promise<ActionState> {
  const { workspace } = await requirePermission("members.manage");
  const id = uuidSchema.safeParse(userId);
  if (!id.success) return { error: "Unknown member." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { ws: workspace.id, p_user: id.data });
  if (error) return dbError(error);
  refresh();
  return { message: "Member removed." };
}

