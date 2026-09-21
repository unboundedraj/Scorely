import type { EventPayload, MatchEvent, MatchRecord, MatchStatus, MatchSummary } from "@/lib/sports/types";

export type SyncErrorKind = "network" | "conflict" | "forbidden" | "unknown";

export class SyncError extends Error {
  constructor(
    public kind: SyncErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "SyncError";
  }
}

export type MatchPatch = Partial<
  Pick<
    MatchRecord,
    "title" | "venue" | "status" | "is_public" | "participants" | "config" | "summary" | "scheduled_at" | "completed_at"
  >
>;

export interface NewEvent {
  seq: number;
  type: string;
  payload: EventPayload;
}

/** Where a match lives: the Supabase cloud or this device's localStorage. */
export interface MatchBackend {
  kind: "cloud" | "local";
  append(matchId: string, event: NewEvent, summary: MatchSummary, status: MatchStatus): Promise<MatchEvent>;
  undo(matchId: string, seq: number, summary: MatchSummary, status: MatchStatus): Promise<void>;
  fetchEvents(matchId: string): Promise<MatchEvent[]>;
  fetchMatch(matchId: string): Promise<MatchRecord | null>;
  updateMatch(matchId: string, patch: MatchPatch): Promise<void>;
  deleteMatch(matchId: string): Promise<void>;
  /** Subscribe to changes of the match row. Returns an unsubscribe function. */
  subscribe(matchId: string, onRow: (row: MatchRecord) => void, onStatus: (connected: boolean) => void): () => void;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const bb = b as unknown[];
    return a.length === bb.length && a.every((v, i) => deepEqual(v, bb[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
  return ak.length === bk.length && ak.every((k) => deepEqual(ao[k], bo[k]));
}
