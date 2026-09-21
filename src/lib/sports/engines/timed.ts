import { clampInt, formatMatchClock as formatClock, ordinal } from "@/lib/utils";
import type { Engine, MatchContext, MatchEvent, MatchSummary, Player } from "../types";

// ---------------------------------------------------------------------------
// Config — one engine, many sports (football, hockey, basketball, rugby, kabaddi…)
// ---------------------------------------------------------------------------

export interface TimedAction {
  key: string;
  label: string;
  points: number;
}

export interface TimedStat {
  key: string;
  label: string;
}

export interface TimedConfig {
  periods: number;
  periodMinutes: number;
  /** "Half" | "Quarter" | "Period" — used for labels. */
  periodName: string;
  clock: "up" | "down";
  actions: TimedAction[];
  /** "Goal" / "Point" — singular noun for scoring events. */
  scoreNoun: string;
  cards: boolean;
  fouls: boolean;
  assists: boolean;
  stats: TimedStat[];
  extraTime: { periods: number; minutes: number } | null;
  /** Keep adding extra periods while tied (basketball overtime). */
  repeatExtraTime: boolean;
  shootout: boolean;
  shootoutRounds: number;
}

export const FOOTBALL_DEFAULTS: TimedConfig = {
  periods: 2,
  periodMinutes: 45,
  periodName: "Half",
  clock: "up",
  actions: [{ key: "goal", label: "Goal", points: 1 }],
  scoreNoun: "Goal",
  cards: true,
  fouls: false,
  assists: true,
  stats: [
    { key: "shots", label: "Shots on target" },
    { key: "corners", label: "Corners" },
    { key: "fouls", label: "Fouls" },
    { key: "offsides", label: "Offsides" },
  ],
  extraTime: { periods: 2, minutes: 15 },
  repeatExtraTime: false,
  shootout: true,
  shootoutRounds: 5,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type CardColor = "green" | "yellow" | "red";

export type TimelineEntry =
  | {
      kind: "score";
      seq: number;
      team: 0 | 1;
      points: number;
      action: string;
      label: string;
      playerId: string | null;
      assistId: string | null;
      ownGoal: boolean;
      penalty: boolean;
      clock: string;
    }
  | { kind: "card"; seq: number; team: 0 | 1; playerId: string | null; color: CardColor; clock: string }
  | { kind: "foul"; seq: number; team: 0 | 1; playerId: string | null; clock: string }
  | { kind: "period"; seq: number; label: string }
  | { kind: "shootout"; seq: number; team: 0 | 1; scored: boolean; playerId: string | null };

export type TimedPhase = "pre" | "live" | "break" | "shootout" | "ended";

export interface TimedState {
  rosters: [Player[], Player[]];
  score: [number, number];
  /** Points per period (index = period - 1). */
  periodScores: [number, number][];
  period: number;
  phase: TimedPhase;
  running: boolean;
  /** Epoch ms when the clock last started running. */
  resumedAt: number | null;
  /** Ms elapsed in the current period before `resumedAt`. */
  elapsed: number;
  timeline: TimelineEntry[];
  teamFouls: [number, number];
  playerFouls: Record<string, number>;
  playerPoints: Record<string, number>;
  cards: Record<string, CardColor[]>;
  stats: Record<string, [number, number]>;
  shootout: { team: 0 | 1; scored: boolean; playerId: string | null }[];
  result: { winner: 0 | 1 | null; text: string } | null;
}

// ---------------------------------------------------------------------------
// Clock + label helpers (shared with the UI)
// ---------------------------------------------------------------------------

export function isExtraPeriod(cfg: TimedConfig, period: number): boolean {
  return period > cfg.periods;
}

export function periodLengthMs(cfg: TimedConfig, period: number): number {
  const minutes = isExtraPeriod(cfg, period) ? (cfg.extraTime?.minutes ?? cfg.periodMinutes) : cfg.periodMinutes;
  return minutes * 60_000;
}

/** Minutes played before this period starts (for continuous football-style clocks). */
export function periodOffsetMinutes(cfg: TimedConfig, period: number): number {
  let total = 0;
  for (let p = 1; p < period; p++) total += periodLengthMs(cfg, p) / 60_000;
  return total;
}

export function elapsedAt(s: TimedState, now: number): number {
  if (s.running && s.resumedAt !== null) return s.elapsed + Math.max(0, now - s.resumedAt);
  return s.elapsed;
}

export function periodShort(cfg: TimedConfig, period: number): string {
  if (period <= 0) return "";
  if (isExtraPeriod(cfg, period)) {
    const n = period - cfg.periods;
    if (cfg.repeatExtraTime) return `OT${n > 1 ? n : ""}`;
    return `ET${n}`;
  }
  if (cfg.periods === 4) return `Q${period}`;
  if (cfg.periods === 2) return `H${period}`;
  return `P${period}`;
}

export function periodLong(cfg: TimedConfig, period: number): string {
  if (period <= 0) return "Not started";
  if (isExtraPeriod(cfg, period)) {
    const n = period - cfg.periods;
    if (cfg.repeatExtraTime) return n > 1 ? `Overtime ${n}` : "Overtime";
    return `Extra time · ${ordinal(n)} half`;
  }
  return `${ordinal(period)} ${cfg.periodName}`;
}

export function breakLabel(cfg: TimedConfig, period: number): string {
  if (isExtraPeriod(cfg, period)) {
    const n = period - cfg.periods;
    if (!cfg.repeatExtraTime && cfg.extraTime && n < cfg.extraTime.periods) return "Extra time break";
    return cfg.repeatExtraTime ? `End of ${periodShort(cfg, period)}` : "End of extra time";
  }
  if (period === cfg.periods) return "Full time";
  if (cfg.periods === 2 && period === 1) return "Half time";
  return `End of ${periodShort(cfg, period)}`;
}

/** Clock label stored with events: "23'", "45+2'" or "Q2 05:32". */
export function eventClockLabel(cfg: TimedConfig, s: TimedState, at: number): string {
  if (s.period <= 0) return "";
  const ms = elapsedAt(s, at);
  const len = periodLengthMs(cfg, s.period);
  if (cfg.clock === "down") {
    return `${periodShort(cfg, s.period)} ${formatClock(Math.max(0, len - ms))}`;
  }
  const base = periodOffsetMinutes(cfg, s.period);
  const periodMinutes = len / 60_000;
  const minute = Math.floor(ms / 60_000);
  if (minute < periodMinutes) return `${base + minute + 1}'`;
  return `${base + periodMinutes}+${minute - periodMinutes + 1}'`;
}

/** Big clock display: continuous for count-up sports, remaining time for count-down. */
export function displayClock(cfg: TimedConfig, s: TimedState, now: number): string {
  if (s.period <= 0) return cfg.clock === "down" ? formatClock(periodLengthMs(cfg, 1)) : "00:00";
  const ms = elapsedAt(s, now);
  if (cfg.clock === "down") return formatClock(Math.max(0, periodLengthMs(cfg, s.period) - ms));
  return formatClock(periodOffsetMinutes(cfg, s.period) * 60_000 + ms);
}

export function isPeriodOver(cfg: TimedConfig, s: TimedState, now: number): boolean {
  return s.period > 0 && elapsedAt(s, now) >= periodLengthMs(cfg, s.period);
}

export function shootoutState(s: TimedState, rounds: number) {
  const kicks: [number, number] = [0, 0];
  const goals: [number, number] = [0, 0];
  for (const k of s.shootout) {
    kicks[k.team] += 1;
    if (k.scored) goals[k.team] += 1;
  }
  let winner: 0 | 1 | null = null;
  if (kicks[0] <= rounds && kicks[1] <= rounds) {
    const left0 = rounds - kicks[0];
    const left1 = rounds - kicks[1];
    if (goals[0] + left0 < goals[1]) winner = 1;
    else if (goals[1] + left1 < goals[0]) winner = 0;
  } else if (kicks[0] === kicks[1] && goals[0] !== goals[1]) {
    winner = goals[0] > goals[1] ? 0 : 1;
  }
  const first = s.shootout[0]?.team ?? 0;
  const next: 0 | 1 = kicks[0] === kicks[1] ? first : kicks[0] < kicks[1] ? 0 : 1;
  return { kicks, goals, winner, next };
}

/** What the scorer can do after a period ends. */
export function nextSteps(cfg: TimedConfig, s: TimedState) {
  const tied = s.score[0] === s.score[1];
  const inRegulation = s.period < cfg.periods;
  const extraPlayed = Math.max(0, s.period - cfg.periods);
  const canExtra =
    !inRegulation &&
    !!cfg.extraTime &&
    (cfg.repeatExtraTime ? tied : extraPlayed < cfg.extraTime.periods && (extraPlayed > 0 || tied));
  return {
    nextPeriod: inRegulation,
    extraTime: canExtra,
    shootout: !inRegulation && cfg.shootout && tied && s.shootout.length === 0 && !canExtra,
    shootoutAllowed: !inRegulation && cfg.shootout && tied,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function registerPlayers(s: TimedState, add: unknown) {
  if (!Array.isArray(add)) return;
  for (const raw of add as { team?: number; id?: string; name?: string }[]) {
    if (!raw || (raw.team !== 0 && raw.team !== 1) || typeof raw.id !== "string" || !raw.id) continue;
    const roster = s.rosters[raw.team];
    if (!roster.some((p) => p.id === raw.id)) roster.push({ id: raw.id, name: String(raw.name ?? "Player").slice(0, 60) });
  }
}

function team(v: unknown): 0 | 1 | null {
  return v === 0 || v === 1 ? v : null;
}

function atOf(p: Record<string, unknown>, s: TimedState): number {
  const at = Number(p.at);
  return Number.isFinite(at) ? at : (s.resumedAt ?? 0);
}

function clockFor(cfg: TimedConfig, s: TimedState, p: Record<string, unknown>): string {
  if (typeof p.minute === "string" && p.minute.trim()) return p.minute.trim().slice(0, 12);
  return eventClockLabel(cfg, s, atOf(p, s));
}

function finish(s: TimedState, ctx: MatchContext<TimedConfig>) {
  const name = (i: 0 | 1) => ctx.participants[i]?.name ?? `Team ${i + 1}`;
  const [a, b] = s.score;
  s.running = false;
  s.phase = "ended";
  if (a !== b) {
    const w: 0 | 1 = a > b ? 0 : 1;
    s.result = { winner: w, text: `${name(w)} won ${Math.max(a, b)}–${Math.min(a, b)}` };
    return;
  }
  if (s.shootout.length) {
    const so = shootoutState(s, ctx.config.shootoutRounds);
    const [g0, g1] = so.goals;
    if (g0 !== g1) {
      const w: 0 | 1 = g0 > g1 ? 0 : 1;
      s.result = { winner: w, text: `${name(w)} won ${Math.max(g0, g1)}–${Math.min(g0, g1)} on penalties` };
      return;
    }
  }
  s.result = { winner: null, text: `Match drawn ${a}–${b}` };
}

export const timedEngine: Engine<TimedConfig, TimedState> = {
  id: "timed",

  init(ctx) {
    const stats: Record<string, [number, number]> = {};
    for (const st of ctx.config.stats ?? []) stats[st.key] = [0, 0];
    return {
      rosters: [
        (ctx.participants[0]?.players ?? []).map((p) => ({ ...p })),
        (ctx.participants[1]?.players ?? []).map((p) => ({ ...p })),
      ],
      score: [0, 0],
      periodScores: [],
      period: 0,
      phase: "pre",
      running: false,
      resumedAt: null,
      elapsed: 0,
      timeline: [],
      teamFouls: [0, 0],
      playerFouls: {},
      playerPoints: {},
      cards: {},
      stats,
      shootout: [],
      result: null,
    };
  },

  apply(s, e: MatchEvent, ctx) {
    const cfg = ctx.config;
    const p = e.payload as Record<string, unknown>;
    registerPlayers(s, p.add);
    if (s.phase === "ended" && e.type !== "add_player") return;

    switch (e.type) {
      case "period_start": {
        if (s.phase !== "pre" && s.phase !== "break") return;
        s.period += 1;
        s.phase = "live";
        s.running = true;
        s.resumedAt = atOf(p, s);
        s.elapsed = 0;
        s.teamFouls = [0, 0];
        while (s.periodScores.length < s.period) s.periodScores.push([0, 0]);
        s.timeline.push({ kind: "period", seq: e.seq, label: s.period === 1 ? "Kick-off" : `${periodLong(cfg, s.period)} underway` });
        return;
      }
      case "pause": {
        if (s.phase !== "live" || !s.running) return;
        s.elapsed = elapsedAt(s, atOf(p, s));
        s.running = false;
        s.resumedAt = null;
        return;
      }
      case "resume": {
        if (s.phase !== "live" || s.running) return;
        s.running = true;
        s.resumedAt = atOf(p, s);
        return;
      }
      case "set_clock": {
        if (s.period <= 0) return;
        s.elapsed = clampInt(p.elapsed, 0, 1000 * 60 * 60 * 3, s.elapsed);
        if (s.running) s.resumedAt = atOf(p, s);
        return;
      }
      case "period_end": {
        if (s.phase !== "live") return;
        s.elapsed = elapsedAt(s, atOf(p, s));
        s.running = false;
        s.resumedAt = null;
        s.phase = "break";
        s.timeline.push({ kind: "period", seq: e.seq, label: breakLabel(cfg, s.period) });
        return;
      }
      case "score": {
        const t = team(p.team);
        if (t === null || s.phase === "shootout") return;
        const action = cfg.actions.find((a) => a.key === p.action) ?? cfg.actions[0];
        const points = action ? action.points : clampInt(p.points, 1, 10, 1);
        const ownGoal = p.ownGoal === true;
        const playerId = typeof p.playerId === "string" ? p.playerId : null;
        const assistId = typeof p.assistId === "string" && !ownGoal ? p.assistId : null;
        s.score[t] += points;
        const pi = Math.max(0, s.period - 1);
        while (s.periodScores.length <= pi) s.periodScores.push([0, 0]);
        s.periodScores[pi][t] += points;
        if (playerId && !ownGoal) s.playerPoints[playerId] = (s.playerPoints[playerId] ?? 0) + points;
        s.timeline.push({
          kind: "score",
          seq: e.seq,
          team: t,
          points,
          action: action?.key ?? "score",
          label: action?.label ?? cfg.scoreNoun,
          playerId,
          assistId,
          ownGoal,
          penalty: p.penalty === true,
          clock: clockFor(cfg, s, p),
        });
        return;
      }
      case "card": {
        const t = team(p.team);
        const color = p.color as CardColor;
        if (t === null || !["green", "yellow", "red"].includes(color)) return;
        const playerId = typeof p.playerId === "string" ? p.playerId : null;
        if (playerId) (s.cards[playerId] ??= []).push(color);
        s.timeline.push({ kind: "card", seq: e.seq, team: t, playerId, color, clock: clockFor(cfg, s, p) });
        return;
      }
      case "foul": {
        const t = team(p.team);
        if (t === null) return;
        const playerId = typeof p.playerId === "string" ? p.playerId : null;
        s.teamFouls[t] += 1;
        if (playerId) s.playerFouls[playerId] = (s.playerFouls[playerId] ?? 0) + 1;
        s.timeline.push({ kind: "foul", seq: e.seq, team: t, playerId, clock: clockFor(cfg, s, p) });
        return;
      }
      case "stat": {
        const t = team(p.team);
        const key = String(p.key ?? "");
        if (t === null || !s.stats[key]) return;
        s.stats[key][t] = Math.max(0, s.stats[key][t] + clampInt(p.delta, -10, 10, 1));
        return;
      }
      case "shootout_start": {
        if (s.phase !== "break") return;
        s.phase = "shootout";
        s.timeline.push({ kind: "period", seq: e.seq, label: "Penalty shootout" });
        return;
      }
      case "shootout_kick": {
        const t = team(p.team);
        if (t === null || s.phase !== "shootout") return;
        const playerId = typeof p.playerId === "string" ? p.playerId : null;
        s.shootout.push({ team: t, scored: p.scored === true, playerId });
        s.timeline.push({ kind: "shootout", seq: e.seq, team: t, scored: p.scored === true, playerId });
        return;
      }
      case "end_match": {
        if (s.phase === "live") {
          s.elapsed = elapsedAt(s, atOf(p, s));
          s.timeline.push({ kind: "period", seq: e.seq, label: "Full time" });
        }
        finish(s, ctx);
        return;
      }
    }
  },

  summarize(s, ctx): MatchSummary {
    const cfg = ctx.config;
    const so = s.shootout.length ? shootoutState(s, cfg.shootoutRounds) : null;
    const lines = ctx.participants.slice(0, 2).map((p, i) => ({
      participantId: p.id,
      score: String(s.score[i]),
      detail: so ? `(${so.goals[i]} pens)` : undefined,
      active: s.phase === "live",
      winner: s.result?.winner === i,
    }));
    let status: string;
    if (s.result) status = s.result.text;
    else if (s.phase === "pre") status = "Not started";
    else if (s.phase === "shootout") status = "Penalty shootout";
    else if (s.phase === "break") status = breakLabel(cfg, s.period);
    else status = periodLong(cfg, s.period);
    return {
      lines,
      status,
      result: s.result?.text ?? null,
      winnerId: s.result && s.result.winner !== null ? ctx.participants[s.result.winner]?.id ?? null : null,
      completed: !!s.result,
    };
  },
};
