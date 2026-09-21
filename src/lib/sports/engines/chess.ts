import { formatHalf } from "@/lib/utils";
import type { Engine, MatchEvent, MatchSummary } from "../types";

export interface ChessConfig {
  /** Games in the match (1 = a single game). */
  games: number;
  /** Minutes per player; null = no clock. */
  baseMinutes: number | null;
  incrementSeconds: number;
  alternateColors: boolean;
  /** Participant index playing white in game 1. */
  firstWhite: 0 | 1;
}

export const CHESS_DEFAULTS: ChessConfig = {
  games: 1,
  baseMinutes: 10,
  incrementSeconds: 0,
  alternateColors: true,
  firstWhite: 0,
};

export type ChessOutcome = "white" | "black" | "draw";

export const CHESS_METHODS = {
  checkmate: "Checkmate",
  resignation: "Resignation",
  timeout: "Time",
  stalemate: "Stalemate",
  agreement: "Agreement",
  repetition: "Repetition",
  insufficient: "Insufficient material",
  fifty_moves: "50-move rule",
  other: "Adjudication",
} as const;

export type ChessMethod = keyof typeof CHESS_METHODS;

export interface ChessGame {
  white: 0 | 1;
  outcome: ChessOutcome | null;
  method: ChessMethod | null;
  /** Clock presses (plies) made in this game. */
  plies: number;
}

export interface ChessClock {
  /** Remaining ms, indexed by participant. */
  remaining: [number, number];
  running: 0 | 1 | null;
  lastAt: number | null;
  paused: boolean;
  started: boolean;
}

export interface ChessState {
  games: ChessGame[];
  score: [number, number];
  clock: ChessClock;
  ended: boolean;
  winner: 0 | 1 | null;
}

const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);

function freshClock(cfg: ChessConfig): ChessClock {
  const base = (cfg.baseMinutes ?? 0) * 60_000;
  return { remaining: [base, base], running: null, lastAt: null, paused: false, started: false };
}

export function currentChessGame(s: ChessState): ChessGame {
  return s.games[s.games.length - 1];
}

export function remainingNow(s: ChessState, who: 0 | 1, now: number): number {
  const c = s.clock;
  if (c.running === who && !c.paused && c.lastAt !== null) return c.remaining[who] - Math.max(0, now - c.lastAt);
  return c.remaining[who];
}

function stopClock(s: ChessState, at: number) {
  const c = s.clock;
  if (c.running !== null && !c.paused && c.lastAt !== null) {
    c.remaining[c.running] = Math.max(0, c.remaining[c.running] - Math.max(0, at - c.lastAt));
  }
  c.running = null;
  c.lastAt = null;
}

function outcomeWinner(game: ChessGame): 0 | 1 | null {
  if (game.outcome === "white") return game.white;
  if (game.outcome === "black") return other(game.white);
  return null;
}

function finishMatch(s: ChessState) {
  s.ended = true;
  s.winner = s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 0 : 1;
  s.clock.running = null;
}

export const chessEngine: Engine<ChessConfig, ChessState> = {
  id: "chess",

  init(ctx) {
    return {
      games: [{ white: ctx.config.firstWhite ?? 0, outcome: null, method: null, plies: 0 }],
      score: [0, 0],
      clock: freshClock(ctx.config),
      ended: false,
      winner: null,
    };
  },

  apply(s, e: MatchEvent, ctx) {
    const cfg = ctx.config;
    const p = e.payload as Record<string, unknown>;
    if (s.ended) return;
    const at = Number(p.at);
    const game = currentChessGame(s);
    const c = s.clock;

    switch (e.type) {
      case "clock_start": {
        if (game.outcome || c.started || !Number.isFinite(at)) return;
        c.started = true;
        c.running = game.white;
        c.lastAt = at;
        c.paused = false;
        return;
      }
      case "press": {
        const by = p.by === 0 || p.by === 1 ? p.by : null;
        if (game.outcome || by === null || !Number.isFinite(at)) return;
        if (!c.started) return;
        if (c.running !== by || c.paused || c.lastAt === null) return;
        c.remaining[by] = Math.max(0, c.remaining[by] - Math.max(0, at - c.lastAt)) + cfg.incrementSeconds * 1000;
        c.running = other(by);
        c.lastAt = at;
        game.plies += 1;
        return;
      }
      case "pause": {
        if (c.running === null || c.paused || c.lastAt === null || !Number.isFinite(at)) return;
        c.remaining[c.running] = Math.max(0, c.remaining[c.running] - Math.max(0, at - c.lastAt));
        c.paused = true;
        c.lastAt = at;
        return;
      }
      case "resume": {
        if (!c.paused || !Number.isFinite(at)) return;
        c.paused = false;
        c.lastAt = at;
        return;
      }
      case "result": {
        const outcome = p.outcome as ChessOutcome;
        if (game.outcome || !["white", "black", "draw"].includes(outcome)) return;
        stopClock(s, Number.isFinite(at) ? at : (c.lastAt ?? 0));
        game.outcome = outcome;
        game.method = (typeof p.method === "string" && p.method in CHESS_METHODS ? p.method : "other") as ChessMethod;
        const w = outcomeWinner(game);
        if (w === null) {
          s.score[0] += 0.5;
          s.score[1] += 0.5;
        } else {
          s.score[w] += 1;
        }
        const played = s.games.filter((g) => g.outcome).length;
        const clinched = Math.max(s.score[0], s.score[1]) > cfg.games / 2;
        if (played >= cfg.games || clinched) finishMatch(s);
        return;
      }
      case "next_game": {
        if (!game.outcome) return;
        const white = cfg.alternateColors ? other(game.white) : game.white;
        s.games.push({ white, outcome: null, method: null, plies: 0 });
        s.clock = freshClock(cfg);
        return;
      }
      case "end_match": {
        stopClock(s, Number.isFinite(at) ? at : (c.lastAt ?? 0));
        finishMatch(s);
        return;
      }
    }
  },

  summarize(s, ctx): MatchSummary {
    const name = (i: 0 | 1) => ctx.participants[i]?.name ?? `Player ${i + 1}`;
    const game = currentChessGame(s);
    const single = ctx.config.games === 1;
    const lines = ctx.participants.slice(0, 2).map((p, i) => ({
      participantId: p.id,
      score: formatHalf(s.score[i]),
      detail: s.ended ? undefined : game.white === i ? "White" : "Black",
      active: !s.ended && s.clock.running === i,
      winner: s.winner === i,
    }));

    let result: string | null = null;
    let status: string;
    if (s.ended) {
      if (single) {
        const w = outcomeWinner(game);
        const method = game.method ? CHESS_METHODS[game.method] : "";
        result = w === null ? `Draw${method ? ` · ${method.toLowerCase()}` : ""}` : `${name(w)} won${method ? ` · ${method.toLowerCase()}` : ""}`;
      } else if (s.winner === null) {
        result = `Match drawn ${formatHalf(s.score[0])}–${formatHalf(s.score[1])}`;
      } else {
        result = `${name(s.winner)} won ${formatHalf(s.score[s.winner])}–${formatHalf(s.score[other(s.winner)])}`;
      }
      status = result;
    } else if (game.outcome) {
      status = `Game ${s.games.length} finished · next game soon`;
    } else if (!s.clock.started && game.plies === 0) {
      status = single ? "Not started" : `Game ${s.games.length} of ${ctx.config.games} · not started`;
    } else {
      const toMove = s.clock.running ?? game.white;
      status = `${single ? "" : `Game ${s.games.length} · `}${name(toMove)} to move${s.clock.paused ? " (paused)" : ""}`;
    }
    return {
      lines,
      status,
      result,
      winnerId: s.winner !== null ? ctx.participants[s.winner]?.id ?? null : null,
      completed: s.ended,
    };
  },
};
