export type SportId =
  | "cricket"
  | "football"
  | "basketball"
  | "hockey"
  | "kabaddi"
  | "rugby"
  | "tennis"
  | "badminton"
  | "table_tennis"
  | "volleyball"
  | "chess"
  | "custom";

/** Scoring engines. Several sports share one engine with different presets. */
export type EngineId = "cricket" | "timed" | "rally" | "tennis" | "chess" | "tally";

export type MatchStatus = "scheduled" | "live" | "completed" | "abandoned";

export interface Player {
  id: string;
  name: string;
}

/** A team or an individual taking part in a match. */
export interface Participant {
  id: string;
  name: string;
  short: string;
  color: string;
  players: Player[];
}

export type EventPayload = Record<string, unknown>;

/** One entry of a match's append-only scoring log. */
export interface MatchEvent {
  /** Database id — absent for events that have not been saved yet. */
  id?: number;
  seq: number;
  type: string;
  payload: EventPayload;
  created_at?: string;
}

export interface ScoreLine {
  participantId: string;
  score: string;
  detail?: string;
  active?: boolean;
  winner?: boolean;
}

/** Snapshot of the scoreboard, cached on the match row for list views. */
export interface MatchSummary {
  lines: ScoreLine[];
  status: string;
  result: string | null;
  winnerId: string | null;
  completed: boolean;
}

export interface MatchContext<C> {
  participants: Participant[];
  config: C;
}

/**
 * A scoring engine is a pure reducer over the event log.
 * `apply` mutates the state in place; `replay` gives every call a fresh state.
 */
export interface Engine<C, S> {
  id: EngineId;
  init(ctx: MatchContext<C>): S;
  apply(state: S, event: MatchEvent, ctx: MatchContext<C>): void;
  summarize(state: S, ctx: MatchContext<C>): MatchSummary;
}

export interface MatchRecord {
  id: string;
  code: string | null;
  owner_id: string | null;
  sport: SportId;
  title: string;
  venue: string;
  status: MatchStatus;
  is_public: boolean;
  participants: Participant[];
  config: Record<string, unknown>;
  summary: MatchSummary | null;
  last_seq: number;
  last_event: MatchEvent | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** The lighter shape used by match lists. */
export type MatchListItem = Pick<
  MatchRecord,
  | "id"
  | "code"
  | "sport"
  | "title"
  | "venue"
  | "status"
  | "is_public"
  | "participants"
  | "summary"
  | "scheduled_at"
  | "created_at"
  | "updated_at"
> & { local?: boolean };
