import "server-only";
import { createServerClient } from "@supabase/ssr";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

// A client acting as the signed-in user, so every query runs under RLS.
export async function createClient() {
  // Session handling reads the clock (token expiry), so this always runs at request time.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes the session instead.
        }
      },
    },
  });
}
