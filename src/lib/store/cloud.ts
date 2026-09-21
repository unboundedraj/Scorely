"use client";

import type { BrowserSupabase } from "@/lib/supabase/client";
import { rowToEvent, rowToMatch } from "@/lib/data/mappers";
import type { Json } from "@/types/database";
import { SyncError, type MatchBackend } from "./backend";

function toSyncError(error: { code?: string; message?: string }): SyncError {
  const message = error.message ?? "Request failed";
  if (error.code === "PT409" || error.code === "23505") return new SyncError("conflict", message);
  if (error.code === "PT401" || error.code === "PT404" || error.code === "42501") return new SyncError("forbidden", message);
  if (!error.code || /fetch|network|timeout|offline/i.test(message)) return new SyncError("network", message);
  return new SyncError("unknown", message);
}

export function createCloudBackend(supabase: BrowserSupabase): MatchBackend {
  return {
    kind: "cloud",

    async append(matchId, event, summary, status) {
      const { data, error } = await supabase.rpc("scorely_append_event", {
        p_match_id: matchId,
        p_seq: event.seq,
        p_type: event.type,
        p_payload: event.payload as Json,
        p_summary: summary as unknown as Json,
        p_status: status,
      });
      if (error) throw toSyncError(error);
      return rowToEvent(data);
    },

    async undo(matchId, seq, summary, status) {
      const { error } = await supabase.rpc("scorely_undo_event", {
        p_match_id: matchId,
        p_seq: seq,
        p_summary: summary as unknown as Json,
        p_status: status,
      });
      if (error) throw toSyncError(error);
    },

    async fetchEvents(matchId) {
      const { data, error } = await supabase
        .from("scorely_match_events")
        .select("id, seq, type, payload, created_at")
        .eq("match_id", matchId)
        .order("seq")
        .limit(10000);
      if (error) throw toSyncError(error);
      return (data ?? []).map(rowToEvent);
    },

    async fetchMatch(matchId) {
      const { data, error } = await supabase.from("scorely_matches").select("*").eq("id", matchId).maybeSingle();
      if (error) throw toSyncError(error);
      return data ? rowToMatch(data) : null;
    },

    async updateMatch(matchId, patch) {
      const { error } = await supabase
        .from("scorely_matches")
        .update({
          ...patch,
          participants: patch.participants as unknown as Json | undefined,
          config: patch.config as Json | undefined,
          summary: patch.summary as unknown as Json | undefined,
        })
        .eq("id", matchId);
      if (error) throw toSyncError(error);
    },

    async deleteMatch(matchId) {
      const { error } = await supabase.from("scorely_matches").delete().eq("id", matchId);
      if (error) throw toSyncError(error);
    },

    subscribe(matchId, onRow, onStatus) {
      const channel = supabase
        .channel(`scorely:match:${matchId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "scorely_matches", filter: `id=eq.${matchId}` },
          (payload) => onRow(rowToMatch(payload.new as Parameters<typeof rowToMatch>[0])),
        )
        .subscribe((status) => onStatus(status === "SUBSCRIBED"));
      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
}
