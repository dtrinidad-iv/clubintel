import { z } from "zod";

export type ActionState = {
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  // Non-secret values to put back in the form (React resets a form after its action runs).
  values?: Record<string, string>;
} | null;

export function invalid(error: z.ZodError, values?: Record<string, string>): ActionState {
  return { fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>, values };
}

// Picks the named, non-secret fields from a submitted form.
export function keep(formData: FormData, ...names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, String(formData.get(n) ?? "")]));
}

// Turns a Postgres error from an RPC into a message that is safe to show.
export function dbError(error: { code?: string; message: string }): ActionState {
  switch (error.code) {
    case "42501":
    case "P0001":
    case "P0002":
    case "23505":
      return { error: error.message };
    default:
      console.error(error);
      return { error: "Something went wrong. Please try again." };
  }
}
