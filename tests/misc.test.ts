import { describe, expect, it } from "vitest";
import { CHESS_DEFAULTS, chessEngine, remainingNow } from "@/lib/sports/engines/chess";
import { TALLY_DEFAULTS, tallyEngine } from "@/lib/sports/engines/tally";
import {
  displayClock,
  eventClockLabel,
  FOOTBALL_DEFAULTS,
  nextSteps,
  shootoutState,
  timedEngine,
  type TimedConfig,
} from "@/lib/sports/engines/timed";
import { getSport } from "@/lib/sports/registry";
import { log, participants, run } from "./helpers";

const MIN = 60_000;

describe("timed engine", () => {
  const football: TimedConfig = FOOTBALL_DEFAULTS;

  it("labels goals with match minutes including stoppage time", () => {
    const events = log(
      ["period_start", { at: 0 }],
      ["score", { team: 0, action: "goal", at: 23 * MIN + 5000 }],
      ["pause", { at: 30 * MIN }],
      ["resume", { at: 32 * MIN }],
      ["score", { team: 1, action: "goal", at: 48 * MIN + 30_000 }],
      ["period_end", { at: 49 * MIN }],
      ["period_start", { at: 60 * MIN }],
      ["score", { team: 0, action: "goal", at: 70 * MIN, playerId: "x" }],
    );
    const { state } = run(timedEngine, football, events);
    const clocks = state.timeline.filter((t) => t.kind === "score").map((t) => (t.kind === "score" ? t.clock : ""));
    expect(clocks).toEqual(["24'", "45+2'", "56'"]);
    expect(state.score).toEqual([2, 1]);
    expect(state.periodScores).toEqual([
      [1, 1],
      [1, 0],
    ]);
    expect(state.playerPoints).toEqual({ x: 1 });
    expect(displayClock(football, state, 75 * MIN)).toBe("60:00");
  });

  it("counts down for basketball and supports repeated overtime", () => {
    const basketball = getSport("basketball")!.defaults() as unknown as TimedConfig;
    const events = log(["period_start", { at: 0 }], ["score", { team: 0, action: "three", at: 3 * MIN }]);
    const { state } = run(timedEngine, basketball, events);
    expect(state.score).toEqual([3, 0]);
    expect(eventClockLabel(basketball, state, 3 * MIN)).toBe("Q1 07:00");

    const tiedAfterFour = log(
      ...[1, 2, 3, 4].flatMap((q) => [
        ["period_start", { at: q * 100 * MIN }] as [string, Record<string, unknown>],
        ["period_end", { at: q * 100 * MIN + 10 * MIN }] as [string, Record<string, unknown>],
      ]),
    );
    const tied = run(timedEngine, basketball, tiedAfterFour).state;
    expect(nextSteps(basketball, tied)).toMatchObject({ nextPeriod: false, extraTime: true });
  });

  it("decides a penalty shootout early", () => {
    const events = log(
      ["period_start", { at: 0 }],
      ["period_end", { at: 90 * MIN }],
      ["shootout_start", {}],
      ["shootout_kick", { team: 0, scored: true }],
      ["shootout_kick", { team: 1, scored: false }],
      ["shootout_kick", { team: 0, scored: true }],
      ["shootout_kick", { team: 1, scored: false }],
      ["shootout_kick", { team: 0, scored: true }],
      ["shootout_kick", { team: 1, scored: false }],
      ["end_match", {}],
    );
    const { state, summary } = run(timedEngine, football, events);
    expect(shootoutState(state, 5).winner).toBe(0);
    expect(summary.result).toBe("Alpha won 3–0 on penalties");
  });

  it("ends in a draw", () => {
    const { summary } = run(timedEngine, football, log(["period_start", { at: 0 }], ["end_match", { at: 10 }]));
    expect(summary.result).toBe("Match drawn 0–0");
  });
});

describe("chess engine", () => {
  it("runs a clock with increment and pauses", () => {
    const cfg = { ...CHESS_DEFAULTS, baseMinutes: 1, incrementSeconds: 2 };
    const events = log(
      ["clock_start", { at: 0 }],
      ["press", { by: 0, at: 5000 }],
      ["press", { by: 1, at: 8000 }],
      ["press", { by: 1, at: 9000 }], // not their turn: ignored
      ["pause", { at: 10_000 }],
      ["resume", { at: 20_000 }],
    );
    const { state } = run(chessEngine, cfg, events);
    expect(state.clock.remaining).toEqual([55_000, 59_000]);
    expect(remainingNow(state, 0, 21_000)).toBe(54_000);
    expect(state.games[0].plies).toBe(2);

    const done = run(chessEngine, cfg, [...events, { seq: 99, type: "result", payload: { outcome: "white", method: "checkmate", at: 21_000 } }]);
    expect(done.state.clock.remaining[0]).toBe(54_000);
    expect(done.summary.result).toBe("Alpha won · checkmate");
  });

  it("alternates colours and ends when the match is clinched", () => {
    const cfg = { ...CHESS_DEFAULTS, games: 2, baseMinutes: null };
    const events = log(
      ["result", { outcome: "draw", method: "agreement" }],
      ["next_game", {}],
      ["result", { outcome: "black", method: "resignation" }],
    );
    const { state, summary } = run(chessEngine, cfg, events);
    expect(state.games[1].white).toBe(1);
    expect(state.score).toEqual([1.5, 0.5]);
    expect(summary.result).toBe("Alpha won 1½–½");
  });
});

describe("tally engine", () => {
  it("ends when a target is reached", () => {
    const cfg = { ...TALLY_DEFAULTS, target: 10 };
    const events = log(["adjust", { p: 0, delta: 5 }], ["round", { scores: [3, 4, 1] }], ["adjust", { p: 1, delta: 7 }]);
    const { state, summary } = run(tallyEngine, cfg, events, participants(3));
    expect(state.totals).toEqual([8, 11, 1]);
    expect(state.ended).toBe(true);
    expect(summary.winnerId).toBe("p1");
    expect(summary.lines.map((l) => l.participantId)).toEqual(["p1", "p0", "p2"]);
  });

  it("supports lowest-wins scoring", () => {
    const cfg = { ...TALLY_DEFAULTS, winCondition: "lowest" as const };
    const events = log(["round", { scores: [10, 3] }], ["end_match", {}]);
    const { summary } = run(tallyEngine, cfg, events);
    expect(summary.result).toBe("Bravo wins with 3");
  });
});
