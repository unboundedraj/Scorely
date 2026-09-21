// NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
// literally. Restart `next dev` (or rebuild) after editing .env.local.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Accepts either the new publishable key or the legacy anon key. */
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_KEY.length > 20;

/** PostgREST / Postgres errors that mean the Scorely migration has not been run. */
export function isMissingSchemaError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    /does not exist|schema cache/i.test(error.message ?? "")
  );
}
