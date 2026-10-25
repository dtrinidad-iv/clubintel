"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { invalid, keep, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { emailOnlySchema, newPasswordSchema, safeNext, signInSchema, signUpSchema } from "@/lib/validation";

async function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, keep(formData, "email"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One message for every failure, so the form doesn't reveal which emails have accounts.
  if (error) return { error: "That email and password don't match an account.", values: keep(formData, "email") };

  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, keep(formData, "fullName", "email"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/onboarding`,
    },
  });
  if (error) return { error: error.message, values: keep(formData, "fullName", "email") };

  // With email confirmation on (production), there is no session until the link is opened.
  if (!data.session) return { message: "Check your email for a link to confirm your account." };
  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, keep(formData, "email"));

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/confirm?next=/reset-password`,
  });
  // Same answer whether or not the account exists.
  return { message: "If that email has an account, a reset link is on its way." };
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}
