import type { Engine, MatchContext, MatchEvent, MatchSummary } from "../types";

// Rally-point scoring: badminton, table tennis, volleyball, squash…

export interface RallyConfig {
  pointsToWin: number;
  winBy: number;
  /** Hard cap (badminton: 30). null = none. */
  cap: number | null;
  bestOf: number;
  /** Target in the deciding game (volleyball: 15). null = same as pointsToWin. */
  decidingPoints: number | null;
  /** "winner": rally winner serves (badminton, volleyball). "alternate": fixed rotation (table tennis). */
  serveRule: "winner" | "alternate";
  /** Serves per turn under the "alternate" rule. */
  alternateEvery: number;
  /** Who serves first in the next game. */
  nextGameServer: "winner" | "alternate";
  firstServer: 0 | 1;
  /** Word used in the UI: "Game" or "Set". */
  gameName: string;
}

export const BADMINTON_DEFAULTS: RallyConfig = {
  pointsToWin: 21,
  winBy: 2,
  cap: 30,
  bestOf: 3,
  decidingPoints: null,
  serveRule: "winner",
  alternateEvery: 2,
  nextGameServer: "winner",
  firstServer: 0,
  gameName: "Game",
};

export interface RallyGame {
  points: [number, number];
  firstServer: 0 | 1;
  winner: 0 | 1 | null;
  /** Point winners in order — used for momentum charts. */
  log: (0 | 1)[];
}

export interface RallyState {
  games: RallyGame[];
  won: [number, number];
  server: 0 | 1;
  winner: 0 | 1 | null;
  retired: 0 | 1 | null;
}

export function gamesToWin(cfg: RallyConfig): number {
  return Math.floor(cfg.bestOf / 2) + 1;
}

export function gameTarget(cfg: RallyConfig, gameIndex: number): number {
  const deciding = gameIndex === cfg.bestOf - 1;
  return deciding && cfg.decidingPoints ? cfg.decidingPoints : cfg.pointsToWin;
}

function alternateServer(cfg: RallyConfig, game: RallyGame, target: number): 0 | 1 {
  const n = game.points[0] + game.points[1];
  const every = Math.max(1, cfg.alternateEvery);
  const deuceAt = 2 * (target - 1);
  const flip = (x: 0 | 1): 0 | 1 => (x === 0 ? 1 : 0);
  if (n < deuceAt) return Math.floor(n / every) % 2 === 0 ? game.firstServer : flip(game.firstServer);
  const atDeuce = Math.floor(deuceAt / every) % 2 === 0 ? game.firstServer : flip(game.firstServer);
  return (n - deuceAt) % 2 === 0 ? atDeuce : flip(atDeuce);
}

export function currentGame(s: RallyState): RallyGame {
  return s.games[s.games.length - 1];
}

export const rallyEngine: Engine<RallyConfig, RallyState> = {
  id: "rally",

  init(ctx) {
    const first = ctx.config.firstServer ?? 0;
    return {
      games: [{ points: [0, 0], firstServer: first, winner: null, log: [] }],
      won: [0, 0],
      server: first,
      winner: null,
      retired: null,
    };
  },

  apply(s, e: MatchEvent, ctx) {
    const cfg = ctx.config;
    const p = e.payload as Record<string, unknown>;
    if (s.winner !== null) return;
    const t = p.team === 0 || p.team === 1 ? p.team : null;

    switch (e.type) {
      case "point": {
        if (t === null) return;
        const gi = s.games.length - 1;
        const g = s.games[gi];
        const target = gameTarget(cfg, gi);
        g.points[t] += 1;
        g.log.push(t);
        const a = g.points[t];
        const b = g.points[t === 0 ? 1 : 0];
        const gameWon = (a >= target && a - b >= cfg.winBy) || (cfg.cap !== null && a >= cfg.cap);
        if (gameWon) {
          g.winner = t;
          s.won[t] += 1;
          if (s.won[t] >= gamesToWin(cfg)) {
            s.winner = t;
            return;
          }
          const nextFirst: 0 | 1 = cfg.nextGameServer === "winner" ? t : g.firstServer === 0 ? 1 : 0;
          s.games.push({ points: [0, 0], firstServer: nextFirst, winner: null, log: [] });
          s.server = nextFirst;
          return;
        }
        s.server = cfg.serveRule === "winner" ? t : alternateServer(cfg, g, target);
        return;
      }
      case "set_server": {
        if (t === null) return;
        const gi = s.games.length - 1;
        const g = s.games[gi];
        if (cfg.serveRule === "alternate" && alternateServer(cfg, g, gameTarget(cfg, gi)) !== t) {
          g.firstServer = g.firstServer === 0 ? 1 : 0;
        }
        s.server = t;
        return;
      }
      case "retire": {
        if (t === null) return;
        s.retired = t;
        s.winner = t === 0 ? 1 : 0;
        return;
      }
    }
  },

  summarize(s, ctx): MatchSummary {
    const cfg = ctx.config;
    const name = (i: 0 | 1) => ctx.participants[i]?.name ?? `Player ${i + 1}`;
    const finished = s.games.filter((g) => g.winner !== null);
    const lines = ctx.participants.slice(0, 2).map((p, i) => ({
      participantId: p.id,
      score: String(s.won[i]),
      detail: finished.map((g) => g.points[i]).join(" "),
      active: s.winner === null && s.server === i,
      winner: s.winner === i,
    }));
    let status: string;
    let result: string | null = null;
    if (s.winner !== null) {
      const loser = s.winner === 0 ? 1 : 0;
      result =
        s.retired !== null
          ? `${name(s.winner)} won (${name(s.retired)} retired)`
          : `${name(s.winner)} won ${s.won[s.winner]}–${s.won[loser]}`;
      status = result;
    } else {
      const g = currentGame(s);
      status =
        g.points[0] + g.points[1] === 0 && s.games.length === 1
          ? "Not started"
          : `${cfg.gameName} ${s.games.length} · ${g.points[0]}–${g.points[1]}`;
    }
    return {
      lines,
      status,
      result,
      winnerId: s.winner !== null ? ctx.participants[s.winner]?.id ?? null : null,
      completed: s.winner !== null,
    };
  },
};

/** Would the next point for `team` win a game or the match? */
export function rallyPointPressure(s: RallyState, ctx: MatchContext<RallyConfig>, team: 0 | 1): "match" | "game" | null {
  if (s.winner !== null) return null;
  const clone: RallyState = structuredClone(s);
  const before = clone.won[team];
  rallyEngine.apply(clone, { seq: 0, type: "point", payload: { team } }, ctx);
  if (clone.winner === team) return "match";
  if (clone.won[team] > before) return "game";
  return null;
}
