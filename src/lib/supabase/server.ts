import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "./config";

export type ServerSupabase = SupabaseClient<Database>;

/**
 * Cookie-bound Supabase client for Server Components, Server Actions and Route
 * Handlers. Returns null until the Supabase env vars are configured.
 */
export async function getServerSupabase(): Promise<ServerSupabase | null> {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
