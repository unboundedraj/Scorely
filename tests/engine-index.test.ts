import { describe, expect, it } from "vitest";
import { computeMatch, getEngine, replay } from "@/lib/sports/engines";
import { TALLY_DEFAULTS, tallyEngine } from "@/lib/sports/engines/tally";
import type { EngineId } from "@/lib/sports/types";
import { log, participants } from "./helpers";

const ENGINE_IDS: EngineId[] = ["cricket", "timed", "rally", "tennis", "chess", "tally"];

describe("getEngine", () => {
  it.each(ENGINE_IDS)("returns the %s engine", (id) => {
    expect(getEngine(id).id).toBe(id);
  });
});

describe("replay", () => {
  const ctx = { participants: participants(2), config: { ...TALLY_DEFAULTS } };
  const events = log(["adjust", { p: 0, delta: 5 }], ["adjust", { p: 1, delta: 2 }]);

  it("folds the event log into state", () => {
    expect(replay(tallyEngine, ctx, events).totals).toEqual([5, 2]);
  });

  it("returns the initial state for an empty log", () => {
    expect(replay(tallyEngine, ctx, []).totals).toEqual([0, 0]);
  });

  it("starts from a fresh state on every call", () => {
    const first = replay(tallyEngine, ctx, events);
    const second = replay(tallyEngine, ctx, events);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });
});

describe("computeMatch", () => {
  const events = log(["adjust", { p: 0, delta: 3 }], ["adjust", { p: 1, delta: 4 }]);

  it("returns the replayed state together with its summary", () => {
    const { state, summary } = computeMatch("tally", participants(2), { ...TALLY_DEFAULTS }, events);
    expect((state as { totals: number[] }).totals).toEqual([3, 4]);
    expect(summary.lines).toHaveLength(2);
    expect(summary.completed).toBe(false);
  });

  it("matches calling the engine directly", () => {
    const ps = participants(2);
    const config = { ...TALLY_DEFAULTS };
    const direct = tallyEngine.summarize(replay(tallyEngine, { participants: ps, config }, events), {
      participants: ps,
      config,
    });
    expect(computeMatch("tally", ps, config, events).summary).toEqual(direct);
  });
});
