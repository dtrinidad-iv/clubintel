"use server";

import { refresh } from "next/cache";
import { dbError, invalid, keep, type ActionState } from "@/lib/action-state";
import { checkPermission, NO_PERMISSION } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { contactSchema, uuidSchema, type ContactInput } from "@/lib/validation";

// Same rules as opportunity-actions.ts: the workspace comes from the server, RLS and column
// grants re-check every write, and every error keeps what was typed.

const FIELDS = ["name", "email", "roleTitle", "phone", "clubId", "notes"];
const GONE = "That contact no longer exists.";

function toRow(input: ContactInput) {
  return {
    name: input.name,
    email: input.email,
    role_title: input.roleTitle,
    phone: input.phone,
    club_id: input.clubId,
    notes: input.notes,
  };
}

export async function saveContact(id: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const values = keep(formData, ...FIELDS);
  const ctx = await checkPermission("contacts.write");
  if (!ctx) return { error: NO_PERMISSION, values };
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  if (id === null) {
    const { error } = await supabase.from("contacts").insert(toRow(parsed.data));
    if (error) return { ...dbError(error), values };
  } else {
    const contactId = uuidSchema.safeParse(id);
    if (!contactId.success) return { error: GONE, values };
    const { data, error } = await supabase
      .from("contacts")
      .update(toRow(parsed.data))
      .eq("id", contactId.data)
      .eq("workspace_id", ctx.workspace.id)
      .select("id");
    if (error) return { ...dbError(error), values };
    if (data.length === 0) {
      refresh();
      return { error: GONE, values };
    }
  }
  refresh();
  return { message: id === null ? "Contact added." : "Contact saved." };
}

export async function deleteContact(id: string): Promise<ActionState> {
  const ctx = await checkPermission("contacts.delete");
  if (!ctx) return { error: NO_PERMISSION };
  const contactId = uuidSchema.safeParse(id);
  if (!contactId.success) return { error: GONE };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId.data)
    .eq("workspace_id", ctx.workspace.id)
    .select("id");
  if (error) return dbError(error);
  refresh();
  return data.length === 0 ? { error: GONE } : { message: "Contact deleted." };
}
