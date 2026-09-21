import type { Engine, MatchContext, MatchEvent, MatchSummary } from "../types";

export interface TennisConfig {
  bestOf: 3 | 5;
  gamesPerSet: number;
  tiebreakAt: number;
  tiebreakPoints: number;
  /** Final set format: normal tiebreak, 10-point match tiebreak instead of a set, or advantage (no tiebreak). */
  finalSet: "tiebreak" | "super_tiebreak" | "advantage";
  noAd: boolean;
  firstServer: 0 | 1;
}

export const TENNIS_DEFAULTS: TennisConfig = {
  bestOf: 3,
  gamesPerSet: 6,
  tiebreakAt: 6,
  tiebreakPoints: 7,
  finalSet: "tiebreak",
  noAd: false,
  firstServer: 0,
};

export interface TennisSet {
  games: [number, number];
  tiebreak: [number, number] | null;
  superTiebreak: boolean;
  winner: 0 | 1 | null;
}

export interface TennisState {
  sets: TennisSet[];
  setsWon: [number, number];
  points: [number, number];
  server: 0 | 1;
  tiebreakFirstServer: 0 | 1 | null;
  winner: 0 | 1 | null;
  retired: 0 | 1 | null;
  pointsWon: [number, number];
}

const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);

export function setsToWin(cfg: TennisConfig): number {
  return Math.floor(cfg.bestOf / 2) + 1;
}

export function currentSet(s: TennisState): TennisSet {
  return s.sets[s.sets.length - 1];
}

/** Game score labels: ["30", "40"], ["40", "AD"], deuce → ["40", "40"]. */
export function pointLabels(s: TennisState, noAd: boolean): [string, string] {
  const set = currentSet(s);
  if (set.tiebreak) return [String(set.tiebreak[0]), String(set.tiebreak[1])];
  const [a, b] = s.points;
  const names = ["0", "15", "30", "40"];
  if (a >= 3 && b >= 3) {
    if (a === b || noAd) return ["40", "40"];
    return a > b ? ["AD", "40"] : ["40", "AD"];
  }
  return [names[Math.min(a, 3)], names[Math.min(b, 3)]];
}

function tiebreakServer(first: 0 | 1, played: number): 0 | 1 {
  if (played === 0) return first;
  return Math.floor((played - 1) / 2) % 2 === 0 ? other(first) : first;
}

function startSet(s: TennisState, cfg: TennisConfig) {
  const idx = s.sets.length;
  const isFinal = idx === cfg.bestOf - 1;
  const superTb = isFinal && cfg.finalSet === "super_tiebreak";
  s.sets.push({ games: [0, 0], tiebreak: superTb ? [0, 0] : null, superTiebreak: superTb, winner: null });
  s.points = [0, 0];
  if (superTb) s.tiebreakFirstServer = s.server;
}

function winSet(s: TennisState, cfg: TennisConfig, t: 0 | 1) {
  const set = currentSet(s);
  set.winner = t;
  s.setsWon[t] += 1;
  if (s.setsWon[t] >= setsToWin(cfg)) {
    s.winner = t;
    return;
  }
  startSet(s, cfg);
}

export const tennisEngine: Engine<TennisConfig, TennisState> = {
  id: "tennis",

  init(ctx) {
    const s: TennisState = {
      sets: [],
      setsWon: [0, 0],
      points: [0, 0],
      server: ctx.config.firstServer ?? 0,
      tiebreakFirstServer: null,
      winner: null,
      retired: null,
      pointsWon: [0, 0],
    };
    startSet(s, ctx.config);
    return s;
  },

  apply(s, e: MatchEvent, ctx) {
    const cfg = ctx.config;
    const p = e.payload as Record<string, unknown>;
    if (s.winner !== null) return;
    const t = p.team === 0 || p.team === 1 ? p.team : null;
    if (t === null) return;

    if (e.type === "retire") {
      s.retired = t;
      s.winner = other(t);
      return;
    }
    if (e.type === "set_server") {
      s.server = t;
      if (currentSet(s).tiebreak) {
        const set = currentSet(s);
        const played = set.tiebreak![0] + set.tiebreak![1];
        // Re-anchor the tiebreak rotation so that `t` is serving now.
        s.tiebreakFirstServer = tiebreakServer(0, played) === t ? 0 : 1;
      }
      return;
    }
    if (e.type !== "point") return;

    s.pointsWon[t] += 1;
    const set = currentSet(s);

    if (set.tiebreak) {
      set.tiebreak[t] += 1;
      const target = set.superTiebreak ? 10 : cfg.tiebreakPoints;
      const a = set.tiebreak[t];
      const b = set.tiebreak[other(t)];
      const first = s.tiebreakFirstServer ?? s.server;
      if (a >= target && a - b >= 2) {
        set.games[t] += 1;
        s.server = other(first);
        s.tiebreakFirstServer = null;
        winSet(s, cfg, t);
      } else {
        s.server = tiebreakServer(first, a + b);
      }
      return;
    }

    s.points[t] += 1;
    const a = s.points[t];
    const b = s.points[other(t)];
    const gameWon = cfg.noAd ? a >= 4 && (a - b >= 2 || b >= 3) : a >= 4 && a - b >= 2;
    if (!gameWon) return;

    set.games[t] += 1;
    s.points = [0, 0];
    s.server = other(s.server);

    const ga = set.games[t];
    const gb = set.games[other(t)];
    const isFinal = s.sets.length === cfg.bestOf;
    const useTiebreak = !isFinal || cfg.finalSet !== "advantage";
    if (ga >= cfg.gamesPerSet && ga - gb >= 2) {
      winSet(s, cfg, t);
    } else if (useTiebreak && set.games[0] === cfg.tiebreakAt && set.games[1] === cfg.tiebreakAt) {
      set.tiebreak = [0, 0];
      s.tiebreakFirstServer = s.server;
    } else if (useTiebreak && ga === cfg.tiebreakAt + 1 && gb === cfg.tiebreakAt) {
      // Unreachable with standard settings (6-6 goes to a tiebreak); kept for safety.
      winSet(s, cfg, t);
    }
  },

  summarize(s, ctx): MatchSummary {
    const cfg = ctx.config;
    const name = (i: 0 | 1) => ctx.participants[i]?.name ?? `Player ${i + 1}`;
    const setText = (i: 0 | 1) =>
      s.sets
        .filter((set) => set.winner !== null || set === currentSet(s))
        .filter((set) => set.games[0] + set.games[1] > 0 || set.tiebreak)
        .map((set) => {
          if (set.superTiebreak && set.tiebreak) return `[${set.tiebreak[i]}]`;
          const tb = set.tiebreak && set.winner !== null && set.winner !== i ? `(${set.tiebreak[i]})` : "";
          return `${set.games[i]}${tb}`;
        })
        .join(" ");
    const lines = ctx.participants.slice(0, 2).map((p, i) => ({
      participantId: p.id,
      score: String(s.setsWon[i]),
      detail: setText(i as 0 | 1),
      active: s.winner === null && s.server === i,
      winner: s.winner === i,
    }));
    let status: string;
    let result: string | null = null;
    if (s.winner !== null) {
      const w = s.winner;
      result = s.retired !== null ? `${name(w)} won (${name(s.retired)} retired)` : `${name(w)} won ${s.setsWon[w]}–${s.setsWon[other(w)]}`;
      status = result;
    } else {
      const set = currentSet(s);
      const [pa, pb] = pointLabels(s, cfg.noAd);
      const started = s.pointsWon[0] + s.pointsWon[1] > 0;
      status = !started
        ? "Not started"
        : set.tiebreak
          ? `${set.superTiebreak ? "Match tiebreak" : "Tiebreak"} · ${pa}–${pb}`
          : `Set ${s.sets.length} · ${set.games[0]}–${set.games[1]} · ${pa}–${pb}`;
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

export type TennisPressure = "match" | "set" | "break" | "game" | null;

/** What the next point would mean for `team`. */
export function tennisPointPressure(s: TennisState, ctx: MatchContext<TennisConfig>, team: 0 | 1): TennisPressure {
  if (s.winner !== null) return null;
  const clone: TennisState = structuredClone(s);
  const sets = clone.setsWon[team];
  const games = currentSet(clone).games[team];
  const server = clone.server;
  const setIdx = clone.sets.length;
  tennisEngine.apply(clone, { seq: 0, type: "point", payload: { team } }, ctx);
  if (clone.winner === team) return "match";
  if (clone.setsWon[team] > sets) return "set";
  if (clone.sets.length === setIdx && currentSet(clone).games[team] > games) return server === team ? "game" : "break";
  return null;
}
