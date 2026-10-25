// Public Supabase settings. Both values are safe in the browser: RLS protects the data.
export const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabasePublishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it from \`supabase status\`.`);
  return value;
}
