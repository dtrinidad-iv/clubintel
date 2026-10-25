"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "./form-parts";

export function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(signIn, null);
  const linkError = params.get("error") === "link" ? { error: "That link is invalid or has expired." } : null;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <FormMessage state={state ?? linkError} />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <Field name="password" label="Password" type="password" autoComplete="current-password" required state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, null);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <Field name="fullName" label="Full name" autoComplete="name" required state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <Field name="password" label="Password" type="password" autoComplete="new-password" minLength={8} required state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <Field name="email" label="Email" type="email" autoComplete="email" required state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <Field name="password" label="New password" type="password" autoComplete="new-password" minLength={8} required state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
