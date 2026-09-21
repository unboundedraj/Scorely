import { clampInt, plural } from "@/lib/utils";
import type { Engine, MatchContext, MatchEvent, MatchSummary, Player } from "../types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface CricketConfig {
  overs: number;
  playersPerSide: number;
  ballsPerOver: number;
  wideRuns: number;
  noBallRuns: number;
  /** Max overs a single bowler may bowl; null = no limit. */
  bowlerMaxOvers: number | null;
  /** Index of the participant batting first. */
  battingFirst: 0 | 1;
  toss: { winner: 0 | 1; decision: "bat" | "bowl" } | null;
}

export const CRICKET_DEFAULTS: CricketConfig = {
  overs: 20,
  playersPerSide: 11,
  ballsPerOver: 6,
  wideRuns: 1,
  noBallRuns: 1,
  bowlerMaxOvers: 4,
  battingFirst: 0,
  toss: null,
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type ExtraType = "wd" | "nb" | "b" | "lb";

export type WicketKind =
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket"
  | "obstructing";

export type RetireKind = "retired_hurt" | "retired_out";

export const WICKET_LABELS: Record<WicketKind, string> = {
  bowled: "Bowled",
  caught: "Caught",
  lbw: "LBW",
  run_out: "Run out",
  stumped: "Stumped",
  hit_wicket: "Hit wicket",
  obstructing: "Obstructing",
};

const BOWLER_CREDITED: ReadonlySet<string> = new Set(["bowled", "caught", "lbw", "stumped", "hit_wicket"]);

export interface NewPlayer {
  team: 0 | 1;
  id: string;
  name: string;
}

export interface BallPayload {
  runs: number;
  extra?: ExtraType | null;
  wicket?: { kind: WicketKind; outId?: string | null; fielderId?: string | null } | null;
  add?: NewPlayer[];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface Dismissal {
  kind: WicketKind | "retired_out";
  bowlerId: string | null;
  fielderId: string | null;
}

export interface BatterCard {
  id: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: Dismissal | null;
  retiredHurt: boolean;
}

export interface BowlerCard {
  id: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  wides: number;
  noBalls: number;
  dots: number;
}

export interface Delivery {
  seq: number;
  /** 0-based over index the delivery belongs to. */
  over: number;
  /** Legal balls completed in the over after this delivery. */
  ballInOver: number;
  bowlerId: string;
  batterId: string;
  runs: number;
  batRuns: number;
  extra: ExtraType | null;
  legal: boolean;
  wicket: { kind: WicketKind; outId: string; fielderId: string | null } | null;
  label: string;
}

export interface FallOfWicket {
  wicket: number;
  runs: number;
  balls: number;
  batterId: string;
}

export type CloseReason = "all_out" | "overs" | "target" | "declared";

export interface Innings {
  batting: 0 | 1;
  bowling: 0 | 1;
  runs: number;
  wickets: number;
  balls: number;
  extras: { wd: number; nb: number; b: number; lb: number };
  batters: Record<string, BatterCard>;
  battingOrder: string[];
  bowlers: Record<string, BowlerCard>;
  bowlingOrder: string[];
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  lastOverBowlerId: string | null;
  deliveries: Delivery[];
  fow: FallOfWicket[];
  partnership: { runs: number; balls: number };
  target: number | null;
  closed: boolean;
  closeReason: CloseReason | null;
  /** Bowler runs this over (for maidens) and whether the bowler changed mid-over. */
  over: { bowlerRuns: number; bowlerChanged: boolean };
}

export interface CricketState {
  rosters: [Player[], Player[]];
  innings: Innings[];
  result: { winner: 0 | 1 | null; text: string } | null;
}

export type CricketPhase = "openers" | "batter" | "bowler" | "play" | "break" | "done";

// ---------------------------------------------------------------------------
// Helpers (also used by the UI)
// ---------------------------------------------------------------------------

export function maxWickets(cfg: CricketConfig): number {
  return Math.max(1, cfg.playersPerSide - 1);
}

export function oversText(balls: number, bpo: number): string {
  const o = Math.floor(balls / bpo);
  const b = balls % bpo;
  return b === 0 ? String(o) : `${o}.${b}`;
}

export function runRate(runs: number, balls: number, bpo: number): number {
  if (balls === 0) return 0;
  return (runs / balls) * bpo;
}

export function strikeRate(runs: number, balls: number): number {
  return balls === 0 ? 0 : (runs / balls) * 100;
}

export function economy(runs: number, balls: number, bpo: number): number {
  return balls === 0 ? 0 : (runs / balls) * bpo;
}

export function currentInnings(s: CricketState): Innings | null {
  return s.innings.length ? s.innings[s.innings.length - 1] : null;
}

function liveInnings(s: CricketState): Innings | null {
  const inn = currentInnings(s);
  return inn && !inn.closed && !s.result ? inn : null;
}

export function cricketPhase(s: CricketState): CricketPhase {
  if (s.result) return "done";
  const inn = currentInnings(s);
  if (!inn) return "openers";
  if (inn.closed) return s.innings.length < 2 ? "break" : "done";
  if (!inn.strikerId || !inn.nonStrikerId) return "batter";
  if (!inn.bowlerId) return "bowler";
  return "play";
}

export function playerName(s: CricketState, id: string | null | undefined): string {
  if (!id) return "—";
  for (const roster of s.rosters) {
    const p = roster.find((x) => x.id === id);
    if (p) return p.name;
  }
  return "Unknown";
}

/** Batters from the batting side who can still come in. */
export function availableBatters(s: CricketState, inn: Innings): Player[] {
  return s.rosters[inn.batting].filter((p) => {
    if (p.id === inn.strikerId || p.id === inn.nonStrikerId) return false;
    const card = inn.batters[p.id];
    return !card || (!card.dismissal && card.retiredHurt);
  });
}

export function bowlerQuotaReached(cfg: CricketConfig, inn: Innings, id: string): boolean {
  if (!cfg.bowlerMaxOvers) return false;
  const card = inn.bowlers[id];
  return !!card && card.balls >= cfg.bowlerMaxOvers * cfg.ballsPerOver;
}

export function dismissalText(s: CricketState, d: Dismissal | null, retiredHurt = false): string {
  if (!d) return retiredHurt ? "retired hurt" : "not out";
  const b = playerName(s, d.bowlerId);
  const f = d.fielderId ? playerName(s, d.fielderId) : null;
  switch (d.kind) {
    case "bowled":
      return `b ${b}`;
    case "caught":
      return f && d.fielderId === d.bowlerId ? `c & b ${b}` : `c ${f ?? "sub"} b ${b}`;
    case "lbw":
      return `lbw b ${b}`;
    case "stumped":
      return `st ${f ?? "keeper"} b ${b}`;
    case "hit_wicket":
      return `hit wicket b ${b}`;
    case "run_out":
      return f ? `run out (${f})` : "run out";
    case "obstructing":
      return "obstructing the field";
    case "retired_out":
      return "retired out";
  }
}

/** Deliveries of the over currently in progress (or the last completed one). */
export function recentOver(inn: Innings, bpo: number): Delivery[] {
  if (inn.deliveries.length === 0) return [];
  const overIdx = inn.balls % bpo === 0 && inn.bowlerId === null ? Math.max(0, inn.balls / bpo - 1) : Math.floor(inn.balls / bpo);
  return inn.deliveries.filter((d) => d.over === overIdx);
}

export function oversList(inn: Innings): { over: number; bowlerId: string; deliveries: Delivery[]; runs: number; wickets: number }[] {
  const map = new Map<number, Delivery[]>();
  for (const d of inn.deliveries) {
    const list = map.get(d.over) ?? [];
    list.push(d);
    map.set(d.over, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([over, deliveries]) => ({
      over,
      bowlerId: deliveries[0].bowlerId,
      deliveries,
      runs: deliveries.reduce((sum, d) => sum + d.runs, 0),
      wickets: deliveries.filter((d) => d.wicket).length,
    }));
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function newInnings(batting: 0 | 1, target: number | null): Innings {
  return {
    batting,
    bowling: (1 - batting) as 0 | 1,
    runs: 0,
    wickets: 0,
    balls: 0,
    extras: { wd: 0, nb: 0, b: 0, lb: 0 },
    batters: {},
    battingOrder: [],
    bowlers: {},
    bowlingOrder: [],
    strikerId: null,
    nonStrikerId: null,
    bowlerId: null,
    lastOverBowlerId: null,
    deliveries: [],
    fow: [],
    partnership: { runs: 0, balls: 0 },
    target,
    closed: false,
    closeReason: null,
    over: { bowlerRuns: 0, bowlerChanged: false },
  };
}

function addBatter(inn: Innings, id: string) {
  if (!inn.batters[id]) {
    inn.batters[id] = { id, runs: 0, balls: 0, fours: 0, sixes: 0, dismissal: null, retiredHurt: false };
    inn.battingOrder.push(id);
  }
}

function addBowler(inn: Innings, id: string) {
  if (!inn.bowlers[id]) {
    inn.bowlers[id] = { id, balls: 0, runs: 0, wickets: 0, maidens: 0, wides: 0, noBalls: 0, dots: 0 };
    inn.bowlingOrder.push(id);
  }
}

function registerPlayers(s: CricketState, add: unknown) {
  if (!Array.isArray(add)) return;
  for (const raw of add as Partial<NewPlayer>[]) {
    if (!raw || (raw.team !== 0 && raw.team !== 1) || typeof raw.id !== "string" || !raw.id) continue;
    const roster = s.rosters[raw.team];
    if (roster.some((p) => p.id === raw.id)) continue;
    roster.push({ id: raw.id, name: String(raw.name ?? "Player").slice(0, 60) });
  }
}

function swapStrike(inn: Innings) {
  const t = inn.strikerId;
  inn.strikerId = inn.nonStrikerId;
  inn.nonStrikerId = t;
}

function deliveryLabel(extra: ExtraType | null, runs: number, total: number, wicket: boolean): string {
  let base: string;
  switch (extra) {
    case "wd":
      base = runs > 0 ? `wd+${runs}` : "wd";
      break;
    case "nb":
      base = runs > 0 ? `nb+${runs}` : "nb";
      break;
    case "b":
      base = `${runs}b`;
      break;
    case "lb":
      base = `${runs}lb`;
      break;
    default:
      base = String(total);
  }
  if (!wicket) return base;
  return base === "0" ? "W" : `${base}+W`;
}

function closeInnings(s: CricketState, inn: Innings, reason: CloseReason, ctx: MatchContext<CricketConfig>) {
  inn.closed = true;
  inn.closeReason = reason;
  inn.bowlerId = null;
  if (s.innings.length === 2) computeResult(s, ctx);
}

function checkInningsEnd(s: CricketState, inn: Innings, ctx: MatchContext<CricketConfig>) {
  const cfg = ctx.config;
  if (inn.target !== null && inn.runs >= inn.target) closeInnings(s, inn, "target", ctx);
  else if (inn.wickets >= maxWickets(cfg)) closeInnings(s, inn, "all_out", ctx);
  else if (inn.balls >= cfg.overs * cfg.ballsPerOver) closeInnings(s, inn, "overs", ctx);
}

function computeResult(s: CricketState, ctx: MatchContext<CricketConfig>) {
  const [first, second] = s.innings;
  if (!first || !second || second.target === null) return;
  const name = (i: 0 | 1) => ctx.participants[i]?.name ?? `Team ${i + 1}`;
  const cfg = ctx.config;
  if (second.runs >= second.target) {
    const margin = maxWickets(cfg) - second.wickets;
    const ballsLeft = cfg.overs * cfg.ballsPerOver - second.balls;
    s.result = {
      winner: second.batting,
      text: `${name(second.batting)} won by ${plural(margin, "wicket")}${ballsLeft > 0 ? ` (${plural(ballsLeft, "ball")} left)` : ""}`,
    };
  } else if (second.runs === second.target - 1) {
    s.result = { winner: null, text: "Match tied" };
  } else {
    const margin = second.target - 1 - second.runs;
    s.result = { winner: first.batting, text: `${name(first.batting)} won by ${plural(margin, "run")}` };
  }
}

function applyBall(s: CricketState, seq: number, p: BallPayload, ctx: MatchContext<CricketConfig>) {
  const inn = liveInnings(s);
  if (!inn || !inn.strikerId || !inn.nonStrikerId || !inn.bowlerId) return;
  const cfg = ctx.config;
  const bpo = cfg.ballsPerOver;
  const extra: ExtraType | null = p.extra ?? null;
  const runs = clampInt(p.runs, 0, 12, 0);
  const legal = extra !== "wd" && extra !== "nb";
  const strikerId = inn.strikerId;
  const bowlerId = inn.bowlerId;
  const striker = inn.batters[strikerId];
  const bowler = inn.bowlers[bowlerId];

  let total = 0;
  let batRuns = 0;
  let bowlerRuns = 0;
  switch (extra) {
    case "wd":
      total = cfg.wideRuns + runs;
      bowlerRuns = total;
      inn.extras.wd += total;
      bowler.wides += 1;
      break;
    case "nb":
      total = cfg.noBallRuns + runs;
      batRuns = runs;
      bowlerRuns = total;
      inn.extras.nb += cfg.noBallRuns;
      bowler.noBalls += 1;
      break;
    case "b":
      total = runs;
      inn.extras.b += runs;
      break;
    case "lb":
      total = runs;
      inn.extras.lb += runs;
      break;
    default:
      total = runs;
      batRuns = runs;
      bowlerRuns = runs;
  }

  // A wide is not a ball faced; a no-ball is.
  if (extra !== "wd") striker.balls += 1;
  striker.runs += batRuns;
  if (batRuns === 4) striker.fours += 1;
  if (batRuns === 6) striker.sixes += 1;

  bowler.runs += bowlerRuns;
  if (legal) {
    bowler.balls += 1;
    inn.balls += 1;
    if (bowlerRuns === 0) bowler.dots += 1;
  }
  inn.runs += total;
  inn.over.bowlerRuns += bowlerRuns;
  inn.partnership.runs += total;
  if (legal) inn.partnership.balls += 1;

  // Batters cross on odd runs (boundaries are even so never swap).
  if (runs % 2 === 1) swapStrike(inn);

  let wicketRecord: Delivery["wicket"] = null;
  if (p.wicket && WICKET_LABELS[p.wicket.kind]) {
    const outId = p.wicket.outId ?? strikerId;
    if (outId === inn.strikerId || outId === inn.nonStrikerId) {
      const kind = p.wicket.kind;
      const credited = BOWLER_CREDITED.has(kind);
      const fielderId = p.wicket.fielderId ?? null;
      inn.batters[outId].dismissal = { kind, bowlerId: credited ? bowlerId : null, fielderId };
      if (credited) bowler.wickets += 1;
      inn.wickets += 1;
      inn.fow.push({ wicket: inn.wickets, runs: inn.runs, balls: inn.balls, batterId: outId });
      if (inn.strikerId === outId) inn.strikerId = null;
      else inn.nonStrikerId = null;
      inn.partnership = { runs: 0, balls: 0 };
      wicketRecord = { kind, outId, fielderId };
    }
  }

  const overIdx = legal ? Math.floor((inn.balls - 1) / bpo) : Math.floor(inn.balls / bpo);
  inn.deliveries.push({
    seq,
    over: overIdx,
    ballInOver: legal ? ((inn.balls - 1) % bpo) + 1 : inn.balls % bpo,
    bowlerId,
    batterId: strikerId,
    runs: total,
    batRuns,
    extra,
    legal,
    wicket: wicketRecord,
    label: deliveryLabel(extra, runs, total, !!wicketRecord),
  });

  // End of over: batters change ends and a new bowler is needed.
  if (legal && inn.balls % bpo === 0) {
    if (inn.over.bowlerRuns === 0 && !inn.over.bowlerChanged) bowler.maidens += 1;
    swapStrike(inn);
    inn.lastOverBowlerId = bowlerId;
    inn.bowlerId = null;
    inn.over = { bowlerRuns: 0, bowlerChanged: false };
  }

  checkInningsEnd(s, inn, ctx);
}

export const cricketEngine: Engine<CricketConfig, CricketState> = {
  id: "cricket",

  init(ctx) {
    return {
      rosters: [
        (ctx.participants[0]?.players ?? []).map((p) => ({ ...p })),
        (ctx.participants[1]?.players ?? []).map((p) => ({ ...p })),
      ],
      innings: [],
      result: null,
    };
  },

  apply(s, e: MatchEvent, ctx) {
    const p = e.payload as Record<string, unknown>;
    registerPlayers(s, p.add);

    switch (e.type) {
      case "add_player":
        return;

      case "start_innings": {
        if (s.result || s.innings.length >= 2) return;
        const prev = currentInnings(s);
        if (prev && !prev.closed) return;
        const strikerId = p.strikerId as string | undefined;
        const nonStrikerId = p.nonStrikerId as string | undefined;
        if (!strikerId || !nonStrikerId || strikerId === nonStrikerId) return;
        const batting: 0 | 1 = prev ? prev.bowling : ctx.config.battingFirst;
        const inn = newInnings(batting, prev ? prev.runs + 1 : null);
        addBatter(inn, strikerId);
        addBatter(inn, nonStrikerId);
        inn.strikerId = strikerId;
        inn.nonStrikerId = nonStrikerId;
        const bowlerId = p.bowlerId as string | undefined;
        if (bowlerId) {
          addBowler(inn, bowlerId);
          inn.bowlerId = bowlerId;
        }
        s.innings.push(inn);
        return;
      }

      case "ball":
        applyBall(s, e.seq, p as unknown as BallPayload, ctx);
        return;

      case "new_batter": {
        const inn = liveInnings(s);
        const id = p.batterId as string | undefined;
        if (!inn || !id || (inn.strikerId && inn.nonStrikerId)) return;
        if (id === inn.strikerId || id === inn.nonStrikerId) return;
        const card = inn.batters[id];
        if (card?.dismissal) return;
        if (card) card.retiredHurt = false;
        else addBatter(inn, id);
        if (!inn.strikerId) inn.strikerId = id;
        else inn.nonStrikerId = id;
        return;
      }

      case "new_bowler": {
        const inn = liveInnings(s);
        const id = p.bowlerId as string | undefined;
        if (!inn || !id) return;
        addBowler(inn, id);
        const overIdx = Math.floor(inn.balls / ctx.config.ballsPerOver);
        const midOver = inn.deliveries.some((d) => d.over === overIdx);
        if (inn.bowlerId && inn.bowlerId !== id && midOver) inn.over.bowlerChanged = true;
        inn.bowlerId = id;
        return;
      }

      case "swap_strike": {
        const inn = liveInnings(s);
        if (inn) swapStrike(inn);
        return;
      }

      case "retire": {
        const inn = liveInnings(s);
        const id = p.batterId as string | undefined;
        if (!inn || !id || (id !== inn.strikerId && id !== inn.nonStrikerId)) return;
        const card = inn.batters[id];
        if (p.kind === "retired_out") {
          card.dismissal = { kind: "retired_out", bowlerId: null, fielderId: null };
          inn.wickets += 1;
          inn.fow.push({ wicket: inn.wickets, runs: inn.runs, balls: inn.balls, batterId: id });
          inn.partnership = { runs: 0, balls: 0 };
        } else {
          card.retiredHurt = true;
        }
        if (inn.strikerId === id) inn.strikerId = null;
        else inn.nonStrikerId = null;
        checkInningsEnd(s, inn, ctx);
        return;
      }

      case "end_innings": {
        const inn = liveInnings(s);
        if (inn) closeInnings(s, inn, "declared", ctx);
        return;
      }
    }
  },

  summarize(s, ctx): MatchSummary {
    const cfg = ctx.config;
    const bpo = cfg.ballsPerOver;
    const name = (i: number) => ctx.participants[i]?.name ?? `Team ${i + 1}`;
    const lines = ctx.participants.slice(0, 2).map((p, i) => {
      const inn = s.innings.find((x) => x.batting === i);
      if (!inn) return { participantId: p.id, score: "—", detail: "Yet to bat" };
      return {
        participantId: p.id,
        score: `${inn.runs}/${inn.wickets}`,
        detail: `${oversText(inn.balls, bpo)} ov`,
        active: !inn.closed && !s.result,
        winner: s.result?.winner === i,
      };
    });

    const phase = cricketPhase(s);
    const inn = currentInnings(s);
    let status: string;
    if (s.result) status = s.result.text;
    else if (!inn) {
      status = cfg.toss
        ? `${name(cfg.toss.winner)} won the toss and chose to ${cfg.toss.decision}`
        : `${name(cfg.battingFirst)} to bat first`;
    } else if (phase === "break") {
      status = `Innings break · ${name(inn.bowling)} need ${inn.runs + 1} to win`;
    } else if (inn.target !== null) {
      const need = inn.target - inn.runs;
      const left = cfg.overs * bpo - inn.balls;
      status = `${name(inn.batting)} need ${plural(need, "run")} from ${plural(left, "ball")}`;
    } else {
      status = `${name(inn.batting)} batting · CRR ${runRate(inn.runs, inn.balls, bpo).toFixed(2)}`;
    }

    return {
      lines,
      status,
      result: s.result?.text ?? null,
      winnerId: s.result && s.result.winner !== null ? ctx.participants[s.result.winner]?.id ?? null : null,
      completed: !!s.result,
    };
  },
};
