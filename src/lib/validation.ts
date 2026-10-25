import { z } from "zod";

// Shared by forms and Server Actions. The server always parses again; client checks are only for feedback.

// Trim before checking the format (zod checks a format before any later transforms).
const email = z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address" }));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Enter your password" }),
});

export const signUpSchema = z.object({
  fullName: z.string().trim().min(1, { error: "Enter your name" }).max(120),
  email,
  password: z.string().min(8, { error: "Use at least 8 characters" }).max(72),
});

export const emailOnlySchema = z.object({ email });

export const newPasswordSchema = z.object({
  password: z.string().min(8, { error: "Use at least 8 characters" }).max(72),
});

export const workspaceNameSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name" }).max(80, { error: "Keep it under 80 characters" }),
});

// Roles that can be granted. The owner is built in and never granted.
export const assignableRoleSchema = z.enum(["admin", "analyst", "viewer"]);

export const addMemberSchema = z.object({ email, role: assignableRoleSchema });

export const memberChangeSchema = z.object({ userId: z.uuid(), role: assignableRoleSchema });

export const uuidSchema = z.uuid();

// Only same-site paths, so a crafted ?next= can't send someone off-site.
export function safeNext(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
