import { describe, expect, it } from "vitest";
import {
  CRICKET_DEFAULTS,
  cricketEngine,
  cricketPhase,
  dismissalText,
  type CricketConfig,
} from "@/lib/sports/engines/cricket";
import { log, participants, run } from "./helpers";

const cfg: CricketConfig = { ...CRICKET_DEFAULTS, overs: 2, playersPerSide: 3, bowlerMaxOvers: null };
const teams = participants(2, [
  ["A0", "A1", "A2"],
  ["B0", "B1", "B2"],
]);

const firstInnings = log(
  ["start_innings", { strikerId: "0-0", nonStrikerId: "0-1", bowlerId: "1-0" }],
  ["ball", { runs: 1 }],
  ["ball", { runs: 4 }],
  ["ball", { runs: 0, extra: "wd" }],
  ["ball", { runs: 0 }],
  ["ball", { runs: 2, extra: "nb" }],
  ["ball", { runs: 6 }],
  ["ball", { runs: 1 }],
  ["ball", { runs: 2, extra: "lb" }],
);

describe("cricket engine", () => {
  it("scores an over with extras, strike rotation and maidens", () => {
    const { state } = run(cricketEngine, cfg, firstInnings, teams);
    const inn = state.innings[0];
    expect(inn.runs).toBe(18);
    expect(inn.balls).toBe(6);
    expect(inn.extras).toEqual({ wd: 1, nb: 1, b: 0, lb: 2 });
    expect(inn.batters["0-1"]).toMatchObject({ runs: 13, balls: 5, fours: 1, sixes: 1 });
    expect(inn.batters["0-0"]).toMatchObject({ runs: 1, balls: 2 });
    expect(inn.bowlers["1-0"]).toMatchObject({ balls: 6, runs: 16, wides: 1, noBalls: 1, maidens: 0 });
    // Over complete: ends swap and the bowler is cleared.
    expect(inn.strikerId).toBe("0-1");
    expect(inn.bowlerId).toBeNull();
    expect(inn.lastOverBowlerId).toBe("1-0");
    expect(cricketPhase(state)).toBe("bowler");
  });

  it("handles wickets, all out and a successful chase", () => {
    const events = [
      ...firstInnings,
      ...log(
        ["new_bowler", { bowlerId: "1-1" }],
        ["ball", { runs: 0, wicket: { kind: "bowled" } }],
        ["new_batter", { batterId: "0-2" }],
        ["ball", { runs: 2 }],
        ["ball", { runs: 0, wicket: { kind: "caught", fielderId: "1-2" } }],
        ["start_innings", { strikerId: "1-0", nonStrikerId: "1-1", bowlerId: "0-0" }],
        ["ball", { runs: 6 }],
        ["ball", { runs: 6 }],
        ["ball", { runs: 4 }],
        ["ball", { runs: 4 }],
        ["ball", { runs: 1 }],
      ),
    ].map((e, i) => ({ ...e, seq: i + 1 }));

    const { state, summary } = run(cricketEngine, cfg, events, teams);
    const [first, second] = state.innings;
    expect(first.closed).toBe(true);
    expect(first.closeReason).toBe("all_out");
    expect(first.runs).toBe(20);
    expect(first.wickets).toBe(2);
    expect(first.bowlers["1-1"]).toMatchObject({ wickets: 2, runs: 2, balls: 3 });
    expect(dismissalText(state, first.batters["0-2"].dismissal)).toBe("c B2 b B1");
    expect(dismissalText(state, first.batters["0-1"].dismissal)).toBe("b B1");
    expect(second.target).toBe(21);
    expect(second.closeReason).toBe("target");
    expect(state.result).toEqual({ winner: 1, text: "Bravo won by 2 wickets (7 balls left)" });
    expect(summary.completed).toBe(true);
    expect(summary.winnerId).toBe("p1");
    expect(summary.lines.map((l) => l.score)).toEqual(["20/2", "21/0"]);
  });

  it("declares a win by runs and a tie", () => {
    const base = log(
      ["start_innings", { strikerId: "0-0", nonStrikerId: "0-1", bowlerId: "1-0" }],
      ["ball", { runs: 6 }],
      ["end_innings", {}],
      ["start_innings", { strikerId: "1-0", nonStrikerId: "1-1", bowlerId: "0-0" }],
      ["ball", { runs: 4 }],
    );
    const byRuns = run(cricketEngine, cfg, [...base, { seq: 99, type: "end_innings", payload: {} }], teams);
    expect(byRuns.state.result?.text).toBe("Alpha won by 2 runs");

    const tie = run(
      cricketEngine,
      cfg,
      [...base, { seq: 98, type: "ball", payload: { runs: 2 } }, { seq: 99, type: "end_innings", payload: {} }],
      teams,
    );
    expect(tie.state.result).toEqual({ winner: null, text: "Match tied" });
  });

  it("credits maidens and ignores balls without a bowler", () => {
    const events = log(
      ["start_innings", { strikerId: "0-0", nonStrikerId: "0-1", bowlerId: "1-0" }],
      ["ball", { runs: 0 }],
      ["ball", { runs: 0 }],
      ["ball", { runs: 1, extra: "b" }],
      ["ball", { runs: 0 }],
      ["ball", { runs: 0 }],
      ["ball", { runs: 0 }],
      ["ball", { runs: 4 }], // no bowler selected yet → ignored
    );
    const { state } = run(cricketEngine, cfg, events, teams);
    const inn = state.innings[0];
    expect(inn.bowlers["1-0"].maidens).toBe(1);
    expect(inn.runs).toBe(1);
    expect(inn.balls).toBe(6);
  });

  it("registers players added on the fly", () => {
    const events = log([
      "start_innings",
      {
        strikerId: "x1",
        nonStrikerId: "x2",
        bowlerId: "y1",
        add: [
          { team: 0, id: "x1", name: "New One" },
          { team: 0, id: "x2", name: "New Two" },
          { team: 1, id: "y1", name: "Bowler" },
        ],
      },
    ]);
    const { state } = run(cricketEngine, cfg, events, participants(2));
    expect(state.rosters[0].map((p) => p.name)).toEqual(["New One", "New Two"]);
    expect(state.innings[0].bowlerId).toBe("y1");
    expect(cricketPhase(state)).toBe("play");
  });

  it("supports run outs of the non-striker and retirements", () => {
    const events = log(
      ["start_innings", { strikerId: "0-0", nonStrikerId: "0-1", bowlerId: "1-0" }],
      ["ball", { runs: 1, wicket: { kind: "run_out", outId: "0-0", fielderId: "1-1" } }],
    );
    const { state } = run(cricketEngine, { ...cfg, playersPerSide: 5 }, events, teams);
    const inn = state.innings[0];
    expect(inn.runs).toBe(1);
    expect(inn.wickets).toBe(1);
    expect(inn.batters["0-1"].runs).toBe(0);
    expect(inn.batters["0-0"].runs).toBe(1);
    // 0-0 ran one and was run out; 0-1 is at the striker's end? They crossed, so the empty slot is striker's end.
    expect([inn.strikerId, inn.nonStrikerId]).toContain("0-1");
    expect(inn.bowlers["1-0"].wickets).toBe(0);

    const retired = run(
      cricketEngine,
      { ...cfg, playersPerSide: 5 },
      [...events, { seq: 3, type: "new_batter", payload: { batterId: "0-2" } }, { seq: 4, type: "retire", payload: { batterId: "0-2", kind: "retired_hurt" } }],
      teams,
    );
    expect(retired.state.innings[0].batters["0-2"].retiredHurt).toBe(true);
    expect(retired.state.innings[0].wickets).toBe(1);
    expect(cricketPhase(retired.state)).toBe("batter");
  });
});
