"use client";

import { Check, Clock, Flag, Minus, Pause, Play, Plus, Timer, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Switch } from "@/components/ui/form";
import { LiveDot, TeamMark } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Tabs } from "@/components/ui/tabs";
import { useNow } from "@/hooks/use-now";
import {
  breakLabel,
  displayClock,
  elapsedAt,
  isPeriodOver,
  nextSteps,
  periodLengthMs,
  periodLong,
  periodOffsetMinutes,
  periodShort,
  shootoutState,
  type CardColor,
  type TimedAction,
  type TimedConfig,
  type TimedState,
  type TimelineEntry,
} from "@/lib/sports/engines/timed";
import type { Participant, Player } from "@/lib/sports/types";
import type { MatchSync } from "@/lib/store/use-match-sync";
import { cn, eventTime } from "@/lib/utils";
import { PadButton, PlayerPicker, ResultBanner, StatRow, UndoButton, useRosterAdds } from "./common";

type Ctx = { s: TimedState; cfg: TimedConfig; ps: Participant[] };
const useCtx = (sync: MatchSync): Ctx => ({ s: sync.state as TimedState, cfg: sync.config as unknown as TimedConfig, ps: sync.match.participants });

function nameOf(s: TimedState, id: string | null): string | null {
  if (!id) return null;
  for (const r of s.rosters) {
    const p = r.find((x) => x.id === id);
    if (p) return p.name;
  }
  return null;
}

function phaseLabel(cfg: TimedConfig, s: TimedState): string {
  if (s.phase === "pre") return "Not started";
  if (s.phase === "live") return periodLong(cfg, s.period);
  if (s.phase === "break") return breakLabel(cfg, s.period);
  if (s.phase === "shootout") return "Penalty shootout";
  return "Full time";
}

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

function Scorers({ s, team, align }: { s: TimedState; team: 0 | 1; align: "left" | "right" }) {
  const byPlayer = new Map<string, string[]>();
  for (const e of s.timeline) {
    if (e.kind !== "score" || e.team !== team) continue;
    const key = nameOf(s, e.playerId) ?? e.label;
    const tag = e.ownGoal ? " (OG)" : e.penalty ? " (P)" : "";
    byPlayer.set(key, [...(byPlayer.get(key) ?? []), `${e.clock}${tag}`.trim()]);
  }
  if (!byPlayer.size) return <div />;
  return (
    <ul className={cn("space-y-0.5 text-xs text-muted", align === "right" && "text-right")}>
      {[...byPlayer.entries()].slice(0, 8).map(([name, clocks]) => (
        <li key={name} className="truncate">
          <span className="font-medium text-foreground">{name}</span> {clocks.filter(Boolean).join(", ")}
        </li>
      ))}
    </ul>
  );
}

function ShootoutDots({ s, team, rounds }: { s: TimedState; team: 0 | 1; rounds: number }) {
  const kicks = s.shootout.filter((k) => k.team === team);
  const slots = Math.max(rounds, kicks.length);
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: slots }, (_, i) => {
        const k = kicks[i];
        return (
          <span
            key={i}
            className={cn(
              "grid size-5 place-items-center rounded-full text-[10px] text-white",
              !k ? "border border-border" : k.scored ? "bg-emerald-500" : "bg-live",
            )}
          >
            {k ? k.scored ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} /> : null}
          </span>
        );
      })}
    </div>
  );
}

function TimedScoreboard({ sync }: { sync: MatchSync }) {
  const { s, cfg, ps } = useCtx(sync);
  const now = useNow(1000, s.running);
  const overtime = s.running && isPeriodOver(cfg, s, now);
  const winner = s.result && s.result.winner !== null ? ps[s.result.winner] : null;

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-muted">
        {s.running ? <LiveDot /> : null}
        {phaseLabel(cfg, s)}
      </div>
      {s.phase !== "pre" && s.phase !== "ended" ? (
        <p className={cn("mt-1 text-center font-mono text-2xl font-bold tabular sm:text-3xl", overtime && "text-live", !s.running && "text-muted")}>
          {now || !s.running ? displayClock(cfg, s, now || s.resumedAt || 0) : "--:--"}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
        {ps.slice(0, 2).map((p, i) => (
          <div key={p.id} className={cn("flex flex-col items-center gap-2 text-center", i === 1 && "col-start-3")}>
            <TeamMark name={p.name} short={p.short} color={p.color} size="lg" />
            <p className="w-full truncate text-sm font-semibold sm:text-base">{p.name}</p>
            {cfg.fouls && s.phase !== "pre" ? <p className="text-xs text-muted">Fouls {s.teamFouls[i]}</p> : null}
          </div>
        ))}
        <p className="col-start-2 row-start-1 font-mono text-6xl font-extrabold tracking-tight tabular sm:text-7xl">
          {s.score[0]}
          <span className="mx-1.5 text-muted/60 sm:mx-3">–</span>
          {s.score[1]}
        </p>
      </div>

      {s.shootout.length || s.phase === "shootout" ? (
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-surface-2/60 p-3">
          {[0, 1].map((t) => (
            <div key={t} className={cn("space-y-1.5", t === 1 && "flex flex-col items-end")}>
              <p className="text-xs font-semibold text-muted">
                Pens: <span className="font-mono text-foreground">{shootoutState(s, cfg.shootoutRounds).goals[t]}</span>
              </p>
              <ShootoutDots s={s} team={t as 0 | 1} rounds={cfg.shootoutRounds} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Scorers s={s} team={0} align="left" />
        <Scorers s={s} team={1} align="right" />
      </div>

      {s.result ? <ResultBanner className="mt-4" text={s.result.text} winner={winner} /> : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type SheetState =
  | null
  | { kind: "score"; team: 0 | 1; action: TimedAction }
  | { kind: "card"; team: 0 | 1 }
  | { kind: "foul"; team: 0 | 1 }
  | { kind: "clock" };

function ClockControls({ sync, onAdjust }: { sync: MatchSync; onAdjust: () => void }) {
  const { s, cfg, ps } = useCtx(sync);
  const now = useNow(1000, s.running);
  const at = eventTime;
  const steps = nextSteps(cfg, s);

  if (s.phase === "pre") {
    return (
      <Button size="xl" block onClick={() => sync.dispatch("period_start", { at: at() })}>
        <Play className="size-5" /> Start {periodLong(cfg, 1).toLowerCase()}
      </Button>
    );
  }

  if (s.phase === "live") {
    const over = s.running && isPeriodOver(cfg, s, now);
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {s.running ? (
            <Button size="lg" variant="secondary" onClick={() => sync.dispatch("pause", { at: at() })}>
              <Pause className="size-4" /> Pause clock
            </Button>
          ) : (
            <Button size="lg" variant="soft" onClick={() => sync.dispatch("resume", { at: at() })}>
              <Play className="size-4" /> Resume
            </Button>
          )}
          <Button
            size="lg"
            variant={over ? "primary" : "outline"}
            className={cn(over && "animate-pop")}
            onClick={() => sync.dispatch("period_end", { at: at() })}
          >
            <Flag className="size-4" /> End {periodShort(cfg, s.period)}
          </Button>
        </div>
        <button type="button" onClick={onAdjust} className="flex w-full items-center justify-center gap-1.5 py-1 text-xs font-medium text-muted hover:text-foreground">
          <Clock className="size-3.5" /> Adjust clock
        </button>
      </div>
    );
  }

  if (s.phase === "break") {
    const tied = s.score[0] === s.score[1];
    return (
      <div className="space-y-2">
        {steps.nextPeriod ? (
          <Button size="xl" block onClick={() => sync.dispatch("period_start", { at: at() })}>
            <Play className="size-5" /> Start {periodLong(cfg, s.period + 1).toLowerCase()}
          </Button>
        ) : null}
        {steps.extraTime ? (
          <Button size="lg" block variant={tied ? "primary" : "outline"} onClick={() => sync.dispatch("period_start", { at: at() })}>
            <Timer className="size-4" /> Start {periodLong(cfg, s.period + 1).toLowerCase()}
          </Button>
        ) : null}
        {steps.shootoutAllowed ? (
          <Button size="lg" block variant={steps.shootout ? "primary" : "outline"} onClick={() => sync.dispatch("shootout_start")}>
            Penalty shootout
          </Button>
        ) : null}
        <Button
          size="lg"
          block
          variant={steps.nextPeriod ? "ghost" : tied && (steps.extraTime || steps.shootout) ? "outline" : "primary"}
          onClick={() => sync.dispatch("end_match", { at: at() })}
        >
          <Flag className="size-4" /> Finish match{tied ? ` (${ps[0].short || "draw"} ${s.score[0]}–${s.score[1]})` : ""}
        </Button>
      </div>
    );
  }

  if (s.phase === "shootout") {
    const so = shootoutState(s, cfg.shootoutRounds);
    return (
      <div className="space-y-3">
        {so.winner !== null ? (
          <div className="rounded-xl bg-primary-soft p-3 text-center text-sm font-semibold text-primary-soft-foreground">
            {ps[so.winner].name} win the shootout {so.goals[so.winner]}–{so.goals[so.winner === 0 ? 1 : 0]}
          </div>
        ) : (
          <p className="text-center text-sm text-muted">
            Next kick: <span className="font-semibold text-foreground">{ps[so.next].name}</span>
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((t) => (
            <div key={t} className={cn("space-y-2 rounded-xl p-2", so.next === t && so.winner === null && "bg-surface-2")}>
              <p className="truncate text-center text-xs font-semibold">{ps[t].name}</p>
              <PadButton tone="soft" className="w-full text-base" disabled={so.winner !== null} onClick={() => sync.dispatch("shootout_kick", { team: t, scored: true })}>
                <Check className="size-4" /> Scored
              </PadButton>
              <PadButton className="w-full text-base" disabled={so.winner !== null} onClick={() => sync.dispatch("shootout_kick", { team: t, scored: false })}>
                <X className="size-4" /> Missed
              </PadButton>
            </div>
          ))}
        </div>
        <Button size="lg" block variant={so.winner !== null ? "primary" : "outline"} onClick={() => sync.dispatch("end_match")}>
          <Flag className="size-4" /> Finish match
        </Button>
      </div>
    );
  }

  return null;
}

function TimedControls({ sync }: { sync: MatchSync }) {
  const { s, cfg, ps } = useCtx(sync);
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = () => setSheet(null);
  const at = eventTime;
  const scoring = s.phase !== "ended" && s.phase !== "shootout";
  const wantsDetails = (team: 0 | 1) => s.rosters[team].length > 0 || cfg.assists;
  const cardColors: CardColor[] = sync.match.sport === "hockey" ? ["green", "yellow", "red"] : ["yellow", "red"];

  if (sync.status === "abandoned") return null;

  return (
    <div className="space-y-3">
      <Card className="p-3 sm:p-4">
        <ClockControls sync={sync} onAdjust={() => setSheet({ kind: "clock" })} />
      </Card>

      {scoring ? (
        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3">
            {[0, 1].map((ti) => {
              const team = ti as 0 | 1;
              const p = ps[team];
              return (
                <div key={p.id} className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                  </div>
                  {cfg.actions.map((a) => (
                    <PadButton
                      key={a.key}
                      className={cn("w-full text-white", cfg.actions.length > 2 ? "h-12 text-sm sm:h-14 sm:text-base" : "")}
                      style={{ backgroundColor: p.color }}
                      onClick={() =>
                        wantsDetails(team)
                          ? setSheet({ kind: "score", team, action: a })
                          : sync.dispatch("score", { team, action: a.key, at: at() })
                      }
                    >
                      {cfg.actions.length === 1 ? a.label : `+${a.points} ${a.label}`}
                    </PadButton>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    {cfg.cards ? (
                      <Button variant="secondary" size="md" onClick={() => setSheet({ kind: "card", team })}>
                        <span className="h-3.5 w-2.5 rounded-[2px] bg-amber-400" /> Card
                      </Button>
                    ) : null}
                    {cfg.fouls ? (
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => (s.rosters[team].length ? setSheet({ kind: "foul", team }) : sync.dispatch("foul", { team, at: at() }))}
                      >
                        Foul
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      {cfg.stats.length && s.phase !== "pre" ? (
        <Card className="space-y-2 p-3 sm:p-4">
          {cfg.stats.map((st) => (
            <div key={st.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <Counter value={s.stats[st.key]?.[0] ?? 0} onChange={(delta) => sync.dispatch("stat", { team: 0, key: st.key, delta })} />
              <p className="truncate text-center text-xs font-medium text-muted">{st.label}</p>
              <Counter value={s.stats[st.key]?.[1] ?? 0} onChange={(delta) => sync.dispatch("stat", { team: 1, key: st.key, delta })} />
            </div>
          ))}
        </Card>
      ) : null}

      <UndoButton onUndo={sync.undo} disabled={sync.events.length === 0} className="w-full" />

      {sheet?.kind === "score" ? <ScoreSheet sync={sync} team={sheet.team} action={sheet.action} onClose={close} /> : null}
      {sheet?.kind === "card" ? <CardSheet sync={sync} team={sheet.team} colors={cardColors} onClose={close} /> : null}
      {sheet?.kind === "foul" ? <FoulSheet sync={sync} team={sheet.team} onClose={close} /> : null}
      {sheet?.kind === "clock" ? <ClockSheet sync={sync} onClose={close} /> : null}
    </div>
  );
}

function Counter({ value, onChange }: { value: number; onChange: (delta: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Decrease"
        disabled={value <= 0}
        onClick={() => onChange(-1)}
        className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted hover:text-foreground disabled:opacity-30"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="w-7 text-center font-mono text-sm font-bold tabular">{value}</span>
      <button type="button" aria-label="Increase" onClick={() => onChange(1)} className="grid size-8 place-items-center rounded-lg bg-surface-2 text-muted hover:text-foreground">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function ScoreSheet({ sync, team, action, onClose }: { sync: MatchSync; team: 0 | 1; action: TimedAction; onClose: () => void }) {
  const { s, cfg, ps } = useCtx(sync);
  const roster = useRosterAdds();
  const [at] = useState(() => Date.now());
  const [ownGoal, setOwnGoal] = useState(false);
  const [penalty, setPenalty] = useState(false);
  const [scorer, setScorer] = useState<string | null>(null);
  const [assist, setAssist] = useState<string | null>(null);
  const [minute, setMinute] = useState("");
  const other: 0 | 1 = team === 0 ? 1 : 0;
  const scorerTeam = ownGoal ? other : team;
  const isGoal = cfg.scoreNoun === "Goal";
  const scorers: Player[] = roster.withAdds(scorerTeam, s.rosters[scorerTeam]);

  const confirm = () => {
    sync.dispatch("score", {
      team,
      action: action.key,
      at,
      ...(scorer ? { playerId: scorer } : {}),
      ...(assist && !ownGoal ? { assistId: assist } : {}),
      ...(ownGoal ? { ownGoal: true } : {}),
      ...(penalty ? { penalty: true } : {}),
      ...(minute.trim() ? { minute: minute.trim() } : {}),
      add: roster.adds,
    });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${action.label} · ${ps[team].name}`}
      description={s.period > 0 ? undefined : "The clock hasn't started — you can type the minute below."}
      footer={
        <Button size="lg" block onClick={confirm}>
          Add {action.label.toLowerCase()}
        </Button>
      }
    >
      <div className="space-y-5">
        <PlayerPicker
          label={ownGoal ? `Own goal by (${ps[other].name})` : `Scored by`}
          players={scorers}
          value={scorer}
          onChange={setScorer}
          onAdd={(n) => roster.add(scorerTeam, n)}
          color={ps[scorerTeam].color}
          suggestion="Player name"
        />
        {cfg.assists && !ownGoal ? (
          <PlayerPicker
            label="Assist (optional)"
            players={roster.withAdds(team, s.rosters[team]).filter((p) => p.id !== scorer)}
            value={assist}
            onChange={setAssist}
            onAdd={(n) => roster.add(team, n)}
            color={ps[team].color}
            suggestion="Player name"
          />
        ) : null}
        {isGoal ? (
          <div className="space-y-3 rounded-xl bg-surface-2/60 p-3.5">
            <Switch checked={penalty} onChange={setPenalty} label="Penalty" />
            <Switch
              checked={ownGoal}
              onChange={(v) => {
                setOwnGoal(v);
                setScorer(null);
              }}
              label="Own goal"
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Time</p>
          <Input value={minute} onChange={(e) => setMinute(e.target.value)} placeholder={s.period > 0 ? "Automatic from the clock" : "e.g. 23'"} maxLength={12} />
        </div>
      </div>
    </Sheet>
  );
}

function CardSheet({ sync, team, colors, onClose }: { sync: MatchSync; team: 0 | 1; colors: CardColor[]; onClose: () => void }) {
  const { s, ps } = useCtx(sync);
  const roster = useRosterAdds();
  const [at] = useState(() => Date.now());
  const [color, setColor] = useState<CardColor>("yellow");
  const [player, setPlayer] = useState<string | null>(null);
  const swatch: Record<CardColor, string> = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-600" };
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Card · ${ps[team].name}`}
      footer={
        <Button
          size="lg"
          block
          onClick={() => {
            sync.dispatch("card", { team, color, at, ...(player ? { playerId: player } : {}), add: roster.adds });
            onClose();
          }}
        >
          Give {color} card
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex gap-2">
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn(
                "flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold capitalize",
                color === c ? "border-foreground" : "border-border",
              )}
            >
              <span className={cn("h-6 w-4 rounded-sm", swatch[c])} /> {c}
            </button>
          ))}
        </div>
        <PlayerPicker
          label="Player (optional)"
          players={roster.withAdds(team, s.rosters[team])}
          value={player}
          onChange={setPlayer}
          onAdd={(n) => roster.add(team, n)}
          color={ps[team].color}
          suggestion="Player name"
        />
      </div>
    </Sheet>
  );
}

function FoulSheet({ sync, team, onClose }: { sync: MatchSync; team: 0 | 1; onClose: () => void }) {
  const { s, ps } = useCtx(sync);
  const roster = useRosterAdds();
  const [at] = useState(() => Date.now());
  const [player, setPlayer] = useState<string | null>(null);
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Foul · ${ps[team].name}`}
      footer={
        <Button
          size="lg"
          block
          onClick={() => {
            sync.dispatch("foul", { team, at, ...(player ? { playerId: player } : {}), add: roster.adds });
            onClose();
          }}
        >
          Add foul
        </Button>
      }
    >
      <PlayerPicker
        label="Fouled by (optional)"
        players={roster.withAdds(team, s.rosters[team]).map((p) => ({ ...p, name: s.playerFouls[p.id] ? `${p.name} (${s.playerFouls[p.id]})` : p.name }))}
        value={player}
        onChange={setPlayer}
        onAdd={(n) => roster.add(team, n)}
        color={ps[team].color}
      />
    </Sheet>
  );
}

function ClockSheet({ sync, onClose }: { sync: MatchSync; onClose: () => void }) {
  const { s, cfg } = useCtx(sync);
  const [openedAt] = useState(() => Date.now());
  const len = periodLengthMs(cfg, s.period);
  const offset = cfg.clock === "up" ? periodOffsetMinutes(cfg, s.period) * 60_000 : 0;
  const current = cfg.clock === "up" ? offset + elapsedAt(s, openedAt) : Math.max(0, len - elapsedAt(s, openedAt));
  const [mm, setMm] = useState(String(Math.floor(current / 60_000)));
  const [ss, setSs] = useState(String(Math.floor((current % 60_000) / 1000)).padStart(2, "0"));

  const save = () => {
    const shown = (Number(mm) || 0) * 60_000 + (Number(ss) || 0) * 1000;
    const elapsed = cfg.clock === "up" ? Math.max(0, shown - offset) : Math.max(0, len - shown);
    sync.dispatch("set_clock", { elapsed, at: eventTime() });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Adjust clock"
      description={cfg.clock === "up" ? "Set the match time shown on the clock." : "Set the time remaining in this period."}
      size="sm"
      footer={
        <Button size="lg" block onClick={save}>
          Set clock
        </Button>
      }
    >
      <div className="flex items-center justify-center gap-2 font-mono text-3xl font-bold">
        <Input aria-label="Minutes" inputMode="numeric" value={mm} onChange={(e) => setMm(e.target.value.replace(/\D/g, "").slice(0, 3))} className="h-16 w-24 text-center text-3xl" />
        <span>:</span>
        <Input aria-label="Seconds" inputMode="numeric" value={ss} onChange={(e) => setSs(e.target.value.replace(/\D/g, "").slice(0, 2))} className="h-16 w-24 text-center text-3xl" />
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

function TimelineItem({ e, s, ps }: { e: TimelineEntry; s: TimedState; ps: Participant[] }) {
  if (e.kind === "period") {
    return (
      <li className="flex items-center gap-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
        <span className="h-px flex-1 bg-border" /> {e.label} <span className="h-px flex-1 bg-border" />
      </li>
    );
  }
  const team = ps[e.team];
  let icon: React.ReactNode = null;
  let text: React.ReactNode = null;
  let clock = "";
  if (e.kind === "score") {
    icon = <span className="grid size-7 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-foreground">+{e.points}</span>;
    const who = nameOf(s, e.playerId);
    const assist = nameOf(s, e.assistId);
    text = (
      <>
        <span className="font-semibold">{e.label}</span>
        {who ? ` — ${who}` : ""}
        {e.ownGoal ? " (own goal)" : e.penalty ? " (pen)" : ""}
        {assist ? <span className="text-muted"> · assist {assist}</span> : null}
      </>
    );
    clock = e.clock;
  } else if (e.kind === "card") {
    const swatch = { green: "bg-emerald-500", yellow: "bg-amber-400", red: "bg-red-600" }[e.color];
    icon = (
      <span className="grid size-7 place-items-center">
        <span className={cn("h-5 w-3.5 rounded-sm", swatch)} />
      </span>
    );
    text = (
      <>
        <span className="font-semibold capitalize">{e.color} card</span>
        {nameOf(s, e.playerId) ? ` — ${nameOf(s, e.playerId)}` : ""}
      </>
    );
    clock = e.clock;
  } else if (e.kind === "foul") {
    icon = <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-[10px] font-bold text-muted">F</span>;
    text = (
      <>
        Foul{nameOf(s, e.playerId) ? ` — ${nameOf(s, e.playerId)}` : ""}
      </>
    );
    clock = e.clock;
  } else if (e.kind === "shootout") {
    icon = e.scored ? (
      <span className="grid size-7 place-items-center rounded-full bg-emerald-500 text-white">
        <Check className="size-4" />
      </span>
    ) : (
      <span className="grid size-7 place-items-center rounded-full bg-live text-white">
        <X className="size-4" />
      </span>
    );
    text = <>Penalty {e.scored ? "scored" : "missed"}{nameOf(s, e.playerId) ? ` — ${nameOf(s, e.playerId)}` : ""}</>;
  }
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-14 shrink-0 text-right font-mono text-xs text-muted tabular">{clock}</span>
      {icon}
      <span className="min-w-0 flex-1 text-sm">{text}</span>
      <span className="flex max-w-28 shrink-0 items-center gap-1.5 text-xs text-muted">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
        <span className="truncate">{team.short || team.name}</span>
      </span>
    </li>
  );
}

function TimedDetails({ sync }: { sync: MatchSync }) {
  const { s, cfg, ps } = useCtx(sync);
  const [tab, setTab] = useState<"timeline" | "stats" | "players">("timeline");
  const cardCount = (team: 0 | 1, c: CardColor) => s.timeline.filter((e) => e.kind === "card" && e.team === team && e.color === c).length;
  const hasPlayers = s.rosters[0].length + s.rosters[1].length > 0;

  return (
    <Card className="p-4 sm:p-5">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "timeline", label: "Timeline" },
          { value: "stats", label: "Stats" },
          { value: "players", label: "Players", hidden: !hasPlayers },
        ]}
      />
      <div className="mt-3">
        {tab === "timeline" ? (
          s.timeline.length ? (
            <ol className="divide-y divide-border">
              {[...s.timeline].reverse().map((e) => (
                <TimelineItem key={`${e.kind}-${e.seq}`} e={e} s={s} ps={ps} />
              ))}
            </ol>
          ) : (
            <p className="py-8 text-center text-sm text-muted">Nothing yet — events will appear here.</p>
          )
        ) : null}

        {tab === "stats" ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="truncate">{ps[0].name}</span>
              <span className="truncate text-right">{ps[1].name}</span>
            </div>
            <StatRow label={cfg.scoreNoun === "Goal" ? "Goals" : "Points"} values={s.score} />
            {cfg.stats.map((st) => (
              <StatRow key={st.key} label={st.label} values={s.stats[st.key] ?? [0, 0]} />
            ))}
            {cfg.fouls ? <StatRow label="Fouls (this period)" values={s.teamFouls} /> : null}
            {cfg.cards ? (
              <>
                <StatRow label="Yellow cards" values={[cardCount(0, "yellow"), cardCount(1, "yellow")]} />
                <StatRow label="Red cards" values={[cardCount(0, "red"), cardCount(1, "red")]} />
              </>
            ) : null}
            {s.periodScores.length > 1 ? (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm tabular">
                  <thead className="bg-surface-2/60 text-xs text-muted">
                    <tr>
                      <th className="py-2 pl-3 text-left font-semibold">By period</th>
                      {s.periodScores.map((_, i) => (
                        <th key={i} className="w-12 text-center font-semibold">
                          {periodShort(cfg, i + 1)}
                        </th>
                      ))}
                      <th className="w-12 pr-3 text-center font-semibold">T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1].map((t) => (
                      <tr key={t} className="border-t border-border">
                        <td className="max-w-32 truncate py-2 pl-3 font-medium">{ps[t].name}</td>
                        {s.periodScores.map((ps2, i) => (
                          <td key={i} className="text-center">
                            {ps2[t]}
                          </td>
                        ))}
                        <td className="pr-3 text-center font-bold">{s.score[t]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "players" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1].map((t) => (
              <div key={t}>
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: ps[t].color }} /> {ps[t].name}
                </p>
                <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                  {s.rosters[t].length ? (
                    s.rosters[t].map((p) => (
                      <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        {(s.cards[p.id] ?? []).map((c, i) => (
                          <span key={i} className={cn("h-4 w-3 rounded-[2px]", c === "red" ? "bg-red-600" : c === "green" ? "bg-emerald-500" : "bg-amber-400")} />
                        ))}
                        {cfg.fouls && s.playerFouls[p.id] ? <span className="text-xs text-muted">{s.playerFouls[p.id]}F</span> : null}
                        <span className="w-8 text-right font-mono font-bold tabular">{s.playerPoints[p.id] ?? 0}</span>
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-muted">No players listed</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function TimedScorer({ sync }: { sync: MatchSync }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="lg:col-start-1">
        <TimedScoreboard sync={sync} />
      </div>
      {sync.canEdit ? (
        <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <TimedControls sync={sync} />
        </aside>
      ) : null}
      <div className="lg:col-start-1">
        <TimedDetails sync={sync} />
      </div>
    </div>
  );
}

export function TimedBoard({ sync }: { sync: MatchSync }) {
  const { s, cfg, ps } = useCtx(sync);
  const now = useNow(1000, s.running);
  const so = s.shootout.length ? shootoutState(s, cfg.shootoutRounds) : null;
  return (
    <div className="w-full max-w-[1600px] text-center">
      <p className="text-[2.6vw] font-semibold text-white/60">{phaseLabel(cfg, s)}</p>
      {s.phase !== "pre" ? (
        <p className={cn("font-mono text-[7vw] leading-none font-bold tabular", s.running ? "text-emerald-300" : "text-white/50")}>
          {displayClock(cfg, s, now || s.resumedAt || 0)}
        </p>
      ) : null}
      <div className="mt-[3vw] grid grid-cols-[1fr_auto_1fr] items-center gap-[3vw]">
        {ps.slice(0, 2).map((p, i) => (
          <div key={p.id} className={cn("flex flex-col items-center gap-[1vw]", i === 1 && "col-start-3")}>
            <span className="size-[6vw] rounded-full" style={{ backgroundColor: p.color }} />
            <p className="max-w-full truncate text-[3.4vw] font-bold">{p.name}</p>
            {so ? <p className="text-[2vw] text-white/60">({so.goals[i]} pens)</p> : null}
          </div>
        ))}
        <p className="col-start-2 row-start-1 font-mono text-[18vw] leading-none font-extrabold tabular">
          {s.score[0]}
          <span className="mx-[1vw] text-white/30">–</span>
          {s.score[1]}
        </p>
      </div>
      {s.result ? <p className="mt-[3vw] text-[3vw] font-semibold text-amber-300">{s.result.text}</p> : null}
    </div>
  );
}
