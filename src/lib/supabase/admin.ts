import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

// The server acting as itself (service_role), not as a user. It bypasses RLS, so it is used for
// one thing only: the AI report writes (start, finish, fail, settle), which are functions that
// only service_role may run. Callers check the user with the DAL first and pass the ids they
// checked; the functions check them again.
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Missing SUPABASE_SECRET_KEY. Copy it from `supabase status` (Secret key) into .env.local.");
  return createSupabaseClient<Database>(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type ServiceClient = ReturnType<typeof createServiceClient>;
