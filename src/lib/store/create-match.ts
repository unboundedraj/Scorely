"use client";

import { computeMatch } from "@/lib/sports/engines";
import { sportOrDefault } from "@/lib/sports/registry";
import type { MatchEvent, MatchRecord, MatchStatus, Participant, SportId } from "@/lib/sports/types";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { Json } from "@/types/database";
import { uid } from "@/lib/utils";
import { localMatchStore } from "./local";

export interface NewMatchInput {
  sport: SportId;
  title: string;
  venue: string;
  isPublic: boolean;
  participants: Participant[];
  config: Record<string, unknown>;
  scheduledAt: string | null;
}

/** Creates a match in the cloud (signed in) or on this device. Returns the URL to open. */
export async function createMatch(input: NewMatchInput, target: "cloud" | "local"): Promise<string> {
  const sport = sportOrDefault(input.sport);
  const { summary } = computeMatch(sport.engine, input.participants, input.config, []);
  const scheduled = input.scheduledAt && new Date(input.scheduledAt).getTime() > Date.now();
  const status: MatchStatus = scheduled ? "scheduled" : "live";

  if (target === "cloud") {
    const supabase = getBrowserSupabase();
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase
      .from("scorely_matches")
      .insert({
        sport: input.sport,
        title: input.title,
        venue: input.venue,
        is_public: input.isPublic,
        participants: input.participants as unknown as Json,
        config: input.config as Json,
        summary: summary as unknown as Json,
        status,
        scheduled_at: scheduled ? new Date(input.scheduledAt!).toISOString() : null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return `/match/${data.id}`;
  }

  const now = new Date().toISOString();
  const record: MatchRecord = {
    id: `local-${uid(12)}`,
    code: null,
    owner_id: "local",
    sport: input.sport,
    title: input.title,
    venue: input.venue,
    status,
    is_public: false,
    participants: input.participants,
    config: input.config,
    summary,
    last_seq: 0,
    last_event: null,
    scheduled_at: scheduled ? new Date(input.scheduledAt!).toISOString() : null,
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
  localMatchStore.create(record);
  return `/local/${record.id}`;
}

/** Same teams and rules, fresh scoreboard. */
export async function createRematch(match: MatchRecord, target: "cloud" | "local"): Promise<string> {
  return createMatch(
    {
      sport: match.sport,
      title: match.title,
      venue: match.venue,
      isPublic: match.is_public,
      participants: match.participants,
      config: match.config,
      scheduledAt: null,
    },
    target,
  );
}

/** Uploads an on-device match (with its full event log) to the signed-in account. */
export async function uploadLocalMatch(match: MatchRecord, events: MatchEvent[]): Promise<string> {
  const supabase = getBrowserSupabase();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("scorely_import_match", {
    p_match: {
      sport: match.sport,
      title: match.title,
      venue: match.venue,
      status: match.status,
      is_public: true,
      participants: match.participants,
      config: match.config,
      summary: match.summary,
      scheduled_at: match.scheduled_at,
      started_at: match.started_at,
      completed_at: match.completed_at,
    } as unknown as Json,
    p_events: events.map((e) => ({ seq: e.seq, type: e.type, payload: e.payload, created_at: e.created_at })) as unknown as Json,
  });
  if (error) throw new Error(error.message);
  return `/match/${data}`;
}
