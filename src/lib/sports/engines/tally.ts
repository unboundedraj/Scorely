import { clampInt } from "@/lib/utils";
import type { Engine, MatchEvent, MatchSummary } from "../types";

// A flexible scoreboard for anything else: board games, card games, quizzes, carrom…

export interface TallyConfig {
  winCondition: "highest" | "lowest";
  /** Game ends when anyone reaches this total. null = play until ended manually. */
  target: number | null;
  /** Quick buttons, e.g. [1, 5, 10]. */
  increments: number[];
}

export const TALLY_DEFAULTS: TallyConfig = {
  winCondition: "highest",
  target: null,
  increments: [1, 5, 10],
};

export interface TallyRound {
  seq: number;
  scores: number[];
}

export interface TallyState {
  totals: number[];
  rounds: TallyRound[];
  /** Sum of quick +/- adjustments per participant (outside rounds). */
  adjustments: number[];
  ended: boolean;
  winners: number[];
}

const LIMIT = 1_000_000;

/** Participant indexes sorted best-first. */
export function tallyRanking(s: TallyState, winCondition: TallyConfig["winCondition"]): number[] {
  return s.totals
    .map((_, i) => i)
    .sort((a, b) => (winCondition === "highest" ? s.totals[b] - s.totals[a] : s.totals[a] - s.totals[b]));
}

function leaders(s: TallyState, cfg: TallyConfig): number[] {
  if (s.totals.length === 0) return [];
  const best = cfg.winCondition === "highest" ? Math.max(...s.totals) : Math.min(...s.totals);
  return s.totals.map((t, i) => (t === best ? i : -1)).filter((i) => i >= 0);
}

function checkTarget(s: TallyState, cfg: TallyConfig) {
  if (cfg.target === null || cfg.target === undefined) return;
  if (s.totals.some((t) => t >= cfg.target!)) {
    s.ended = true;
    s.winners = leaders(s, cfg);
  }
}

export const tallyEngine: Engine<TallyConfig, TallyState> = {
  id: "tally",

  init(ctx) {
    const n = ctx.participants.length;
    return { totals: Array(n).fill(0), rounds: [], adjustments: Array(n).fill(0), ended: false, winners: [] };
  },

  apply(s, e: MatchEvent, ctx) {
    const p = e.payload as Record<string, unknown>;
    if (s.ended) return;
    switch (e.type) {
      case "adjust": {
        const i = clampInt(p.p, 0, s.totals.length - 1, -1);
        if (i < 0 || i >= s.totals.length) return;
        const delta = clampInt(p.delta, -LIMIT, LIMIT, 0);
        s.totals[i] += delta;
        s.adjustments[i] += delta;
        checkTarget(s, ctx.config);
        return;
      }
      case "round": {
        if (!Array.isArray(p.scores)) return;
        const scores = s.totals.map((_, i) => clampInt((p.scores as unknown[])[i], -LIMIT, LIMIT, 0));
        scores.forEach((v, i) => (s.totals[i] += v));
        s.rounds.push({ seq: e.seq, scores });
        checkTarget(s, ctx.config);
        return;
      }
      case "end_match": {
        s.ended = true;
        s.winners = leaders(s, ctx.config);
        return;
      }
    }
  },

  summarize(s, ctx): MatchSummary {
    const cfg = ctx.config;
    const ranking = tallyRanking(s, cfg.winCondition);
    // Best-first, so compact match cards show the leaders.
    const lines = ranking
      .filter((i) => ctx.participants[i])
      .map((i, pos) => ({
        participantId: ctx.participants[i].id,
        score: String(s.totals[i] ?? 0),
        detail: `#${pos + 1}`,
        winner: s.ended && s.winners.includes(i),
      }));

    const name = (i: number) => ctx.participants[i]?.name ?? `Player ${i + 1}`;
    let status: string;
    let result: string | null = null;
    const top = leaders(s, cfg);
    const anyScore = s.rounds.length > 0 || s.adjustments.some((a) => a !== 0);
    if (s.ended) {
      result =
        s.winners.length === 1
          ? `${name(s.winners[0])} wins with ${s.totals[s.winners[0]]}`
          : `Tie: ${s.winners.map(name).join(" & ")}`;
      status = result;
    } else if (!anyScore) {
      status = "Not started";
    } else if (top.length > 1) {
      status = `${top.map(name).join(" & ")} tied at ${s.totals[top[0]]}`;
    } else {
      const second = ranking[1];
      const gap = second === undefined ? 0 : Math.abs(s.totals[top[0]] - s.totals[second]);
      status = `${name(top[0])} leads by ${gap}${s.rounds.length ? ` · Round ${s.rounds.length}` : ""}`;
    }
    return {
      lines,
      status,
      result,
      winnerId: s.ended && s.winners.length === 1 ? ctx.participants[s.winners[0]]?.id ?? null : null,
      completed: s.ended,
    };
  },
};
