import type { Json } from "@/types/database";
import type { MatchEvent, MatchRecord, MatchStatus, MatchSummary, Participant, Player, SportId } from "@/lib/sports/types";

export interface SavedTeam {
  id: string;
  name: string;
  short_name: string;
  color: string;
  sport: string | null;
  players: Player[];
  updated_at: string;
}

function asArray<T>(value: Json | null | undefined): T[] {
  return Array.isArray(value) ? (value as unknown as T[]) : [];
}

function asObject<T>(value: Json | null | undefined): T | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as unknown as T) : null;
}

type MatchRowLike = {
  id: string;
  sport: string;
  title?: string | null;
  venue?: string | null;
  status: string;
  is_public?: boolean | null;
  participants?: Json;
  config?: Json;
  summary?: Json | null;
  code?: string | null;
  owner_id?: string | null;
  last_seq?: number | null;
  last_event?: Json | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export function rowToMatch(row: MatchRowLike): MatchRecord {
  return {
    id: row.id,
    code: row.code ?? null,
    owner_id: row.owner_id ?? null,
    sport: row.sport as SportId,
    title: row.title ?? "",
    venue: row.venue ?? "",
    status: row.status as MatchStatus,
    is_public: row.is_public ?? true,
    participants: asArray<Participant>(row.participants).map((p) => ({ ...p, players: Array.isArray(p.players) ? p.players : [] })),
    config: asObject<Record<string, unknown>>(row.config) ?? {},
    summary: asObject<MatchSummary>(row.summary ?? null),
    last_seq: row.last_seq ?? 0,
    last_event: asObject<MatchEvent>(row.last_event ?? null),
    scheduled_at: row.scheduled_at ?? null,
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function rowToEvent(row: { id?: number; seq: number; type: string; payload: Json; created_at?: string }): MatchEvent {
  return {
    id: row.id,
    seq: row.seq,
    type: row.type,
    payload: asObject<Record<string, unknown>>(row.payload) ?? {},
    created_at: row.created_at,
  };
}

export function rowToTeam(row: {
  id: string;
  name: string;
  short_name: string;
  color: string;
  sport: string | null;
  players: Json;
  updated_at: string;
}): SavedTeam {
  return {
    id: row.id,
    name: row.name,
    short_name: row.short_name,
    color: row.color,
    sport: row.sport,
    players: asArray<Player>(row.players).filter((p) => p && typeof p.name === "string"),
    updated_at: row.updated_at,
  };
}

export const MATCH_LIST_COLUMNS =
  "id, code, sport, title, venue, status, is_public, participants, summary, scheduled_at, created_at, updated_at";
