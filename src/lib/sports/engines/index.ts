import type { Engine, EngineId, MatchContext, MatchEvent, MatchSummary, Participant } from "../types";
import { chessEngine } from "./chess";
import { cricketEngine } from "./cricket";
import { rallyEngine } from "./rally";
import { tallyEngine } from "./tally";
import { tennisEngine } from "./tennis";
import { timedEngine } from "./timed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyEngine = Engine<any, any>;

const ENGINES: Record<EngineId, AnyEngine> = {
  cricket: cricketEngine,
  timed: timedEngine,
  rally: rallyEngine,
  tennis: tennisEngine,
  chess: chessEngine,
  tally: tallyEngine,
};

/** Looks up the scoring engine for an engine id. */
export function getEngine(id: EngineId): AnyEngine {
  return ENGINES[id];
}

/** Rebuilds match state by applying every event, in order, to a fresh `init` state. */
export function replay<C, S>(engine: Engine<C, S>, ctx: MatchContext<C>, events: readonly MatchEvent[]): S {
  const state = engine.init(ctx);
  for (const e of events) engine.apply(state, e, ctx);
  return state;
}

/** Replays an event log for the given engine and returns the final state with its scoreboard summary. */
export function computeMatch(
  engineId: EngineId,
  participants: Participant[],
  config: Record<string, unknown>,
  events: readonly MatchEvent[],
): { state: unknown; summary: MatchSummary } {
  const engine = getEngine(engineId);
  const ctx = { participants, config };
  const state = replay(engine, ctx, events);
  return { state, summary: engine.summarize(state, ctx) };
}
