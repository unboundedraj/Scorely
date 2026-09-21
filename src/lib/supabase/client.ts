"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "./config";

export type BrowserSupabase = SupabaseClient<Database>;

let client: BrowserSupabase | null = null;

/** Browser Supabase client (singleton), or null until the env vars are set. */
export function getBrowserSupabase(): BrowserSupabase | null {
  if (!isSupabaseConfigured) return null;
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
