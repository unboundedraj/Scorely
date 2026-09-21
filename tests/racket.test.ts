import { describe, expect, it } from "vitest";
import { BADMINTON_DEFAULTS, rallyEngine, rallyPointPressure, type RallyConfig } from "@/lib/sports/engines/rally";
import { pointLabels, TENNIS_DEFAULTS, tennisEngine, tennisPointPressure, type TennisConfig } from "@/lib/sports/engines/tennis";
import type { MatchEvent } from "@/lib/sports/types";
import { run } from "./helpers";

function points(seq: (0 | 1)[]): MatchEvent[] {
  return seq.map((team, i) => ({ seq: i + 1, type: "point", payload: { team } }));
}
const times = (team: 0 | 1, n: number): (0 | 1)[] => Array(n).fill(team);
const game = (team: 0 | 1) => times(team, 4);

describe("tennis engine", () => {
  const cfg: TennisConfig = { ...TENNIS_DEFAULTS };

  it("wins a love game and rotates serve", () => {
    const { state } = run(tennisEngine, cfg, points(game(0)));
    expect(state.sets[0].games).toEqual([1, 0]);
    expect(state.server).toBe(1);
  });

  it("handles deuce and advantage", () => {
    const { state, ctx } = run(tennisEngine, cfg, points([0, 0, 0, 1, 1, 1, 0]));
    expect(pointLabels(state, false)).toEqual(["AD", "40"]);
    expect(tennisPointPressure(state, ctx, 0)).toBe("game");
    const back = run(tennisEngine, cfg, points([0, 0, 0, 1, 1, 1, 0, 1]));
    expect(pointLabels(back.state, false)).toEqual(["40", "40"]);
    const done = run(tennisEngine, cfg, points([0, 0, 0, 1, 1, 1, 0, 1, 1, 1]));
    expect(done.state.sets[0].games).toEqual([0, 1]);
  });

  it("plays no-ad deciding points", () => {
    const { state } = run(tennisEngine, { ...cfg, noAd: true }, points([0, 0, 0, 1, 1, 1, 1]));
    expect(state.sets[0].games).toEqual([0, 1]);
  });

  it("goes to a tiebreak at 6-6 and records it", () => {
    const seq: (0 | 1)[] = [];
    for (let i = 0; i < 6; i++) seq.push(...game(0), ...game(1));
    seq.push(...times(1, 5), ...times(0, 7));
    const { state, summary } = run(tennisEngine, cfg, points(seq));
    expect(state.sets[0]).toMatchObject({ games: [7, 6], tiebreak: [7, 5], winner: 0 });
    expect(state.setsWon).toEqual([1, 0]);
    // Player 0 served first in the tiebreak, so player 1 opens set two.
    expect(state.server).toBe(1);
    expect(summary.lines[1].detail).toBe("6(5)");
  });

  it("detects break, set and match points and finishes the match", () => {
    const set = [...Array(6)].flatMap(() => game(0));
    const nearlyDone = [...set, ...Array(5).fill(0).flatMap(() => game(0)), 0, 0, 0] as (0 | 1)[];
    const { state, ctx } = run(tennisEngine, cfg, points(nearlyDone));
    expect(tennisPointPressure(state, ctx, 0)).toBe("match");
    const finished = run(tennisEngine, cfg, points([...nearlyDone, 0]));
    expect(finished.state.winner).toBe(0);
    expect(finished.summary.result).toBe("Alpha won 2–0");
  });

  it("uses a match tiebreak for the final set when configured", () => {
    const seq: (0 | 1)[] = [...Array(6)].flatMap(() => game(0));
    seq.push(...[...Array(6)].flatMap(() => game(1)));
    const { state } = run(tennisEngine, { ...cfg, finalSet: "super_tiebreak" }, points(seq));
    expect(state.sets[2]).toMatchObject({ superTiebreak: true, tiebreak: [0, 0] });
    const done = run(tennisEngine, { ...cfg, finalSet: "super_tiebreak" }, points([...seq, ...times(1, 10)]));
    expect(done.state.winner).toBe(1);
  });
});

describe("rally engine", () => {
  const badminton: RallyConfig = { ...BADMINTON_DEFAULTS };

  it("wins a badminton game at 21 with a 2-point lead", () => {
    const { state } = run(rallyEngine, badminton, points([...times(0, 20), ...times(1, 19), 0]));
    expect(state.games[0]).toMatchObject({ points: [21, 19], winner: 0 });
    expect(state.won).toEqual([1, 0]);
    expect(state.server).toBe(0);
  });

  it("caps at 30", () => {
    const seq: (0 | 1)[] = [];
    for (let i = 0; i < 29; i++) seq.push(0, 1);
    seq.push(1);
    const { state } = run(rallyEngine, badminton, points(seq));
    expect(state.games[0]).toMatchObject({ points: [29, 30], winner: 1 });
  });

  it("flags game and match points", () => {
    const { state, ctx } = run(rallyEngine, badminton, points([...times(0, 21), ...times(0, 20)]));
    expect(rallyPointPressure(state, ctx, 0)).toBe("match");
    expect(rallyPointPressure(state, ctx, 1)).toBeNull();
  });

  it("rotates table-tennis serve every two points and every point at deuce", () => {
    const tt: RallyConfig = { ...badminton, pointsToWin: 11, cap: null, bestOf: 5, serveRule: "alternate", alternateEvery: 2, nextGameServer: "alternate" };
    const servers: number[] = [];
    const seq: (0 | 1)[] = [];
    for (let i = 0; i < 24; i++) {
      servers.push(run(rallyEngine, tt, points(seq)).state.server);
      seq.push((i % 2) as 0 | 1);
    }
    expect(servers.slice(0, 8)).toEqual([0, 0, 1, 1, 0, 0, 1, 1]);
    // From 10-10 (20 points played) serve alternates every point.
    expect(servers.slice(20, 24)).toEqual([0, 1, 0, 1]);
  });

  it("uses the deciding-set target in volleyball", () => {
    const vb: RallyConfig = { ...badminton, pointsToWin: 25, cap: null, bestOf: 5, decidingPoints: 15, nextGameServer: "alternate" };
    const seq: (0 | 1)[] = [...times(0, 25), ...times(0, 25), ...times(1, 25), ...times(1, 25), ...times(0, 15)];
    const { state, summary } = run(rallyEngine, vb, points(seq));
    expect(state.won).toEqual([3, 2]);
    expect(state.games[4].points).toEqual([15, 0]);
    expect(summary.completed).toBe(true);
  });
});
