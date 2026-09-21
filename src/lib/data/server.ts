import "server-only";

import { cache } from "react";
import { isMissingSchemaError } from "@/lib/supabase/config";
import { getServerSupabase } from "@/lib/supabase/server";
import type { MatchEvent, MatchListItem, MatchRecord } from "@/lib/sports/types";
import { MATCH_LIST_COLUMNS, rowToEvent, rowToMatch, rowToTeam, type SavedTeam } from "./mappers";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
}

export type BackendState = "unconfigured" | "schema_missing" | "ready";

export interface Listing<T> {
  items: T[];
  backend: BackendState;
}

/** Is Supabase configured and has the Scorely migration been applied? */
export const probeBackend = cache(async (): Promise<BackendState> => {
  const supabase = await getServerSupabase();
  if (!supabase) return "unconfigured";
  const { error } = await supabase.from("scorely_matches").select("id").limit(1);
  return error && isMissingSchemaError(error) ? "schema_missing" : "ready";
});

/** The signed-in user (validated via JWT claims), creating their profile on first sight. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const email = typeof claims.email === "string" ? claims.email : "";
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const fallbackName =
    (typeof meta.scorely_name === "string" && meta.scorely_name) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    email.split("@")[0] ||
    "Player";

  let displayName = fallbackName;
  const { data: profile, error } = await supabase
    .from("scorely_profiles")
    .select("display_name")
    .eq("id", claims.sub)
    .maybeSingle();

  if (profile?.display_name) {
    displayName = profile.display_name;
  } else if (!profile && !error) {
    // First visit: create the Scorely profile (no auth.users trigger in a shared project).
    await supabase.from("scorely_profiles").insert({ id: claims.sub, display_name: fallbackName.slice(0, 60) });
  }

  return { id: claims.sub, email, displayName };
});

export async function listMyMatches(userId: string): Promise<Listing<MatchListItem>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { items: [], backend: "unconfigured" };
  const { data, error } = await supabase
    .from("scorely_matches")
    .select(MATCH_LIST_COLUMNS)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) return { items: [], backend: isMissingSchemaError(error) ? "schema_missing" : "ready" };
  return { items: (data ?? []).map(rowToMatch), backend: "ready" };
}

export async function listPublicMatches(options: { sport?: string; limit?: number } = {}): Promise<Listing<MatchListItem>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { items: [], backend: "unconfigured" };
  let query = supabase
    .from("scorely_matches")
    .select(MATCH_LIST_COLUMNS)
    .eq("is_public", true)
    .neq("status", "abandoned")
    .order("updated_at", { ascending: false })
    .limit(options.limit ?? 60);
  if (options.sport) query = query.eq("sport", options.sport);
  const { data, error } = await query;
  if (error) return { items: [], backend: isMissingSchemaError(error) ? "schema_missing" : "ready" };
  return { items: (data ?? []).map(rowToMatch), backend: "ready" };
}

export async function getMatchWithEvents(
  id: string,
): Promise<{ match: MatchRecord; events: MatchEvent[]; ownerName: string | null } | null> {
  const supabase = await getServerSupabase();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: row } = await supabase.from("scorely_matches").select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const [{ data: events }, { data: owner }] = await Promise.all([
    supabase.from("scorely_match_events").select("id, seq, type, payload, created_at").eq("match_id", id).order("seq").limit(10000),
    supabase.from("scorely_profiles").select("display_name").eq("id", row.owner_id).maybeSingle(),
  ]);
  return {
    match: rowToMatch(row),
    events: (events ?? []).map(rowToEvent),
    ownerName: owner?.display_name || null,
  };
}

export async function getMatchIdByCode(code: string): Promise<string | null> {
  const supabase = await getServerSupabase();
  if (!supabase || !/^[A-Za-z0-9]{4,12}$/.test(code)) return null;
  const { data } = await supabase.from("scorely_matches").select("id").eq("code", code.toUpperCase()).maybeSingle();
  return data?.id ?? null;
}

export async function listTeams(): Promise<Listing<SavedTeam>> {
  const supabase = await getServerSupabase();
  if (!supabase) return { items: [], backend: "unconfigured" };
  const { data, error } = await supabase
    .from("scorely_teams")
    .select("id, name, short_name, color, sport, players, updated_at")
    .order("updated_at", { ascending: false });
  if (error) return { items: [], backend: isMissingSchemaError(error) ? "schema_missing" : "ready" };
  return { items: (data ?? []).map(rowToTeam), backend: "ready" };
}
