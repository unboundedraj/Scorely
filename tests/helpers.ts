import { replay } from "@/lib/sports/engines";
import type { Engine, MatchEvent, Participant } from "@/lib/sports/types";

export function participants(n = 2, players: string[][] = []): Participant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"][i] ?? `P${i}`,
    short: `P${i}`,
    color: "#000000",
    players: (players[i] ?? []).map((name, j) => ({ id: `${i}-${j}`, name })),
  }));
}

/** Build a sequential event log from [type, payload] tuples. */
export function log(...items: [string, Record<string, unknown>?][]): MatchEvent[] {
  return items.map(([type, payload], i) => ({ seq: i + 1, type, payload: payload ?? {} }));
}

export function run<C, S>(engine: Engine<C, S>, config: C, events: MatchEvent[], ps = participants()) {
  const ctx = { participants: ps, config };
  const state = replay(engine, ctx, events);
  return { state, summary: engine.summarize(state, ctx), ctx };
}
