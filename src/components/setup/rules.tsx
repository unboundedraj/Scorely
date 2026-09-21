"use client";

import type { ReactNode } from "react";
import { Field, Input, Segmented, Stepper, Switch } from "@/components/ui/form";
import type { ChessConfig } from "@/lib/sports/engines/chess";
import type { CricketConfig } from "@/lib/sports/engines/cricket";
import type { RallyConfig } from "@/lib/sports/engines/rally";
import type { TallyConfig } from "@/lib/sports/engines/tally";
import type { TennisConfig } from "@/lib/sports/engines/tennis";
import type { TimedConfig } from "@/lib/sports/engines/timed";
import type { EngineId } from "@/lib/sports/types";
import { cn } from "@/lib/utils";

type Names = [string, string];

interface RulesProps<C> {
  config: C;
  onChange: (config: C) => void;
  names: Names;
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Chips<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-lg border px-3 text-sm font-semibold transition-colors",
            value === o.value ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-surface-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CricketRules({ config, onChange, names }: RulesProps<CricketConfig>) {
  const set = (patch: Partial<CricketConfig>) => onChange({ ...config, ...patch });
  const toss = config.toss ?? { winner: 0 as const, decision: "bat" as const };
  const setToss = (patch: Partial<NonNullable<CricketConfig["toss"]>>) => {
    const next = { ...toss, ...patch };
    set({ toss: next, battingFirst: next.decision === "bat" ? next.winner : ((1 - next.winner) as 0 | 1) });
  };
  return (
    <div className="space-y-5">
      <Field label="Overs per innings">
        <Chips
          value={config.overs}
          options={[2, 5, 6, 10, 20, 50].map((n) => ({ value: n, label: String(n) }))}
          onChange={(overs) => set({ overs, bowlerMaxOvers: config.bowlerMaxOvers ? Math.max(1, Math.ceil(overs / 5)) : null })}
        />
        <Stepper value={config.overs} min={1} max={100} label="Overs" onChange={(overs) => set({ overs })} />
      </Field>
      <Grid>
        <Field label="Players per side" hint={`${Math.max(1, config.playersPerSide - 1)} wickets to bowl a side out`}>
          <Stepper value={config.playersPerSide} min={2} max={15} label="Players per side" onChange={(playersPerSide) => set({ playersPerSide })} />
        </Field>
        <Field label="Balls per over">
          <Segmented
            value={config.ballsPerOver}
            onChange={(ballsPerOver) => set({ ballsPerOver })}
            options={[4, 5, 6, 8].map((n) => ({ value: n, label: String(n) }))}
          />
        </Field>
        <Field label="Runs for a wide">
          <Segmented value={config.wideRuns} onChange={(wideRuns) => set({ wideRuns })} options={[0, 1, 2].map((n) => ({ value: n, label: String(n) }))} />
        </Field>
        <Field label="Runs for a no-ball">
          <Segmented value={config.noBallRuns} onChange={(noBallRuns) => set({ noBallRuns })} options={[0, 1, 2].map((n) => ({ value: n, label: String(n) }))} />
        </Field>
      </Grid>
      <div className="space-y-3 rounded-xl bg-surface-2/60 p-3.5">
        <Switch
          checked={config.bowlerMaxOvers !== null}
          onChange={(on) => set({ bowlerMaxOvers: on ? Math.max(1, Math.ceil(config.overs / 5)) : null })}
          label="Limit overs per bowler"
          description={config.bowlerMaxOvers ? `${config.bowlerMaxOvers} overs each` : "Any bowler can bowl any number of overs"}
        />
        {config.bowlerMaxOvers !== null ? (
          <Stepper value={config.bowlerMaxOvers} min={1} max={config.overs} label="Max overs per bowler" onChange={(bowlerMaxOvers) => set({ bowlerMaxOvers })} />
        ) : null}
      </div>
      <Grid>
        <Field label="Toss won by">
          <Segmented value={toss.winner} onChange={(winner) => setToss({ winner })} options={[0, 1].map((i) => ({ value: i as 0 | 1, label: names[i] }))} />
        </Field>
        <Field label="Elected to">
          <Segmented
            value={toss.decision}
            onChange={(decision) => setToss({ decision })}
            options={[
              { value: "bat", label: "Bat" },
              { value: "bowl", label: "Bowl" },
            ]}
          />
        </Field>
      </Grid>
      <p className="text-sm text-muted">
        <span className="font-semibold text-foreground">{names[config.battingFirst]}</span> will bat first.
      </p>
    </div>
  );
}

function TimedRules({ config, onChange }: RulesProps<TimedConfig>) {
  const set = (patch: Partial<TimedConfig>) => onChange({ ...config, ...patch });
  return (
    <div className="space-y-5">
      <Grid>
        <Field label={`Number of ${config.periodName.toLowerCase()}s`}>
          <Stepper value={config.periods} min={1} max={8} label="Periods" onChange={(periods) => set({ periods })} />
        </Field>
        <Field label={`Minutes per ${config.periodName.toLowerCase()}`}>
          <Stepper value={config.periodMinutes} min={1} max={120} label="Minutes" onChange={(periodMinutes) => set({ periodMinutes })} />
        </Field>
      </Grid>
      <Field label="Clock">
        <Segmented
          value={config.clock}
          onChange={(clock) => set({ clock })}
          options={[
            { value: "up", label: "Counts up (45:00)" },
            { value: "down", label: "Counts down (10:00 → 0)" },
          ]}
        />
      </Field>
      <div className="space-y-4 rounded-xl bg-surface-2/60 p-3.5">
        <Switch
          checked={!!config.extraTime}
          onChange={(on) => set({ extraTime: on ? (config.repeatExtraTime ? { periods: 1, minutes: 5 } : { periods: 2, minutes: 15 }) : null })}
          label={config.repeatExtraTime ? "Overtime if tied" : "Extra time if tied"}
          description={
            config.extraTime
              ? config.repeatExtraTime
                ? `${config.extraTime.minutes} min periods until there's a winner`
                : `${config.extraTime.periods} × ${config.extraTime.minutes} min`
              : "Matches can end in a draw"
          }
        />
        {config.extraTime ? (
          <Grid>
            {!config.repeatExtraTime ? (
              <Field label="Extra periods">
                <Stepper
                  value={config.extraTime.periods}
                  min={1}
                  max={4}
                  label="Extra periods"
                  onChange={(periods) => set({ extraTime: { ...config.extraTime!, periods } })}
                />
              </Field>
            ) : null}
            <Field label="Minutes each">
              <Stepper
                value={config.extraTime.minutes}
                min={1}
                max={30}
                label="Extra minutes"
                onChange={(minutes) => set({ extraTime: { ...config.extraTime!, minutes } })}
              />
            </Field>
          </Grid>
        ) : null}
        <Switch
          checked={config.shootout}
          onChange={(shootout) => set({ shootout })}
          label="Penalty shootout if still tied"
          description={config.shootout ? `${config.shootoutRounds} kicks each, then sudden death` : undefined}
        />
      </div>
    </div>
  );
}

function RallyRules({ config, onChange, names }: RulesProps<RallyConfig>) {
  const set = (patch: Partial<RallyConfig>) => onChange({ ...config, ...patch });
  const g = config.gameName.toLowerCase();
  return (
    <div className="space-y-5">
      <Grid>
        <Field label={`Points to win a ${g}`}>
          <Stepper value={config.pointsToWin} min={5} max={50} label="Points to win" onChange={(pointsToWin) => set({ pointsToWin })} />
        </Field>
        <Field label="Match format">
          <Segmented
            value={config.bestOf}
            onChange={(bestOf) => set({ bestOf })}
            options={[1, 3, 5, 7].map((n) => ({ value: n, label: n === 1 ? `1 ${g}` : `Best of ${n}` }))}
            size="sm"
          />
        </Field>
      </Grid>
      <div className="space-y-4 rounded-xl bg-surface-2/60 p-3.5">
        <Switch checked={config.winBy === 2} onChange={(on) => set({ winBy: on ? 2 : 1 })} label="Must win by 2" />
        <Switch
          checked={config.cap !== null}
          onChange={(on) => set({ cap: on ? config.pointsToWin + 9 : null })}
          label="Cap the score"
          description={config.cap !== null ? `First to ${config.cap} wins regardless` : undefined}
        />
        {config.cap !== null ? (
          <Stepper value={config.cap} min={config.pointsToWin + 1} max={99} label="Cap" onChange={(cap) => set({ cap })} />
        ) : null}
        {config.bestOf > 1 ? (
          <Switch
            checked={config.decidingPoints !== null}
            onChange={(on) => set({ decidingPoints: on ? Math.max(5, Math.round(config.pointsToWin * 0.6)) : null })}
            label={`Shorter deciding ${g}`}
            description={config.decidingPoints !== null ? `Deciding ${g} to ${config.decidingPoints}` : undefined}
          />
        ) : null}
        {config.decidingPoints !== null && config.bestOf > 1 ? (
          <Stepper value={config.decidingPoints} min={5} max={50} label="Deciding points" onChange={(decidingPoints) => set({ decidingPoints })} />
        ) : null}
      </div>
      <Field label="First serve">
        <Segmented value={config.firstServer} onChange={(firstServer) => set({ firstServer })} options={[0, 1].map((i) => ({ value: i as 0 | 1, label: names[i] }))} />
      </Field>
    </div>
  );
}

function TennisRules({ config, onChange, names }: RulesProps<TennisConfig>) {
  const set = (patch: Partial<TennisConfig>) => onChange({ ...config, ...patch });
  return (
    <div className="space-y-5">
      <Grid>
        <Field label="Match format">
          <Segmented
            value={config.bestOf}
            onChange={(bestOf) => set({ bestOf })}
            options={[
              { value: 3 as const, label: "Best of 3" },
              { value: 5 as const, label: "Best of 5" },
            ]}
          />
        </Field>
        <Field label="Games per set">
          <Segmented
            value={config.gamesPerSet}
            onChange={(gamesPerSet) => set({ gamesPerSet, tiebreakAt: gamesPerSet })}
            options={[
              { value: 4, label: "4 (Fast4)" },
              { value: 6, label: "6" },
            ]}
          />
        </Field>
      </Grid>
      <Field label="Final set">
        <Segmented
          value={config.finalSet}
          onChange={(finalSet) => set({ finalSet })}
          options={[
            { value: "tiebreak", label: "Tiebreak" },
            { value: "super_tiebreak", label: "10-pt tiebreak" },
            { value: "advantage", label: "Advantage" },
          ]}
          size="sm"
        />
      </Field>
      <div className="rounded-xl bg-surface-2/60 p-3.5">
        <Switch checked={config.noAd} onChange={(noAd) => set({ noAd })} label="No-ad scoring" description="Deciding point at deuce" />
      </div>
      <Field label="First serve">
        <Segmented value={config.firstServer} onChange={(firstServer) => set({ firstServer })} options={[0, 1].map((i) => ({ value: i as 0 | 1, label: names[i] }))} />
      </Field>
    </div>
  );
}

const TIME_CONTROLS: { label: string; base: number | null; inc: number }[] = [
  { label: "No clock", base: null, inc: 0 },
  { label: "1+0", base: 1, inc: 0 },
  { label: "3+0", base: 3, inc: 0 },
  { label: "3+2", base: 3, inc: 2 },
  { label: "5+0", base: 5, inc: 0 },
  { label: "5+3", base: 5, inc: 3 },
  { label: "10+0", base: 10, inc: 0 },
  { label: "10+5", base: 10, inc: 5 },
  { label: "15+10", base: 15, inc: 10 },
  { label: "30+0", base: 30, inc: 0 },
];

function ChessRules({ config, onChange, names }: RulesProps<ChessConfig>) {
  const set = (patch: Partial<ChessConfig>) => onChange({ ...config, ...patch });
  const current = TIME_CONTROLS.find((t) => t.base === config.baseMinutes && t.inc === config.incrementSeconds)?.label ?? "custom";
  return (
    <div className="space-y-5">
      <Field label="Time control" hint="Minutes per player + seconds added per move">
        <Chips
          value={current}
          onChange={(label) => {
            if (label === "custom") {
              set({ baseMinutes: config.baseMinutes ?? 10 });
              return;
            }
            const t = TIME_CONTROLS.find((x) => x.label === label)!;
            set({ baseMinutes: t.base, incrementSeconds: t.inc });
          }}
          options={[...TIME_CONTROLS.map((t) => ({ value: t.label, label: t.label })), { value: "custom", label: "Custom" }]}
        />
      </Field>
      {config.baseMinutes !== null ? (
        <Grid>
          <Field label="Minutes each">
            <Stepper value={config.baseMinutes} min={1} max={180} label="Minutes" onChange={(baseMinutes) => set({ baseMinutes })} />
          </Field>
          <Field label="Increment (seconds)">
            <Stepper value={config.incrementSeconds} min={0} max={60} label="Increment" onChange={(incrementSeconds) => set({ incrementSeconds })} />
          </Field>
        </Grid>
      ) : null}
      <Grid>
        <Field label="Games in the match">
          <Stepper value={config.games} min={1} max={24} label="Games" onChange={(games) => set({ games })} />
        </Field>
        <Field label="White in game 1">
          <Segmented value={config.firstWhite} onChange={(firstWhite) => set({ firstWhite })} options={[0, 1].map((i) => ({ value: i as 0 | 1, label: names[i] }))} />
        </Field>
      </Grid>
      {config.games > 1 ? (
        <div className="rounded-xl bg-surface-2/60 p-3.5">
          <Switch checked={config.alternateColors} onChange={(alternateColors) => set({ alternateColors })} label="Alternate colours each game" />
        </div>
      ) : null}
    </div>
  );
}

function TallyRules({ config, onChange }: RulesProps<TallyConfig>) {
  const set = (patch: Partial<TallyConfig>) => onChange({ ...config, ...patch });
  return (
    <div className="space-y-5">
      <Field label="Winner">
        <Segmented
          value={config.winCondition}
          onChange={(winCondition) => set({ winCondition })}
          options={[
            { value: "highest", label: "Highest score wins" },
            { value: "lowest", label: "Lowest score wins" },
          ]}
        />
      </Field>
      <div className="space-y-3 rounded-xl bg-surface-2/60 p-3.5">
        <Switch
          checked={config.target !== null}
          onChange={(on) => set({ target: on ? 100 : null })}
          label="End at a target score"
          description={config.target !== null ? `Game ends when someone reaches ${config.target}` : "Play until you end the game"}
        />
        {config.target !== null ? <Stepper value={config.target} min={1} max={100000} step={5} label="Target" onChange={(target) => set({ target })} /> : null}
      </div>
      <Field label="Quick buttons" hint="Comma-separated amounts, e.g. 1, 5, 10">
        <Input
          defaultValue={config.increments.join(", ")}
          inputMode="numeric"
          onChange={(e) => {
            const increments = e.target.value
              .split(/[,\s]+/)
              .map((v) => Math.abs(Math.trunc(Number(v))))
              .filter((n) => Number.isFinite(n) && n > 0)
              .slice(0, 5);
            if (increments.length) set({ increments });
          }}
        />
      </Field>
    </div>
  );
}

export function RulesEditor({
  engine,
  config,
  onChange,
  names,
}: {
  engine: EngineId;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  names: Names;
}) {
  const props = { config, onChange, names } as never;
  switch (engine) {
    case "cricket":
      return <CricketRules {...(props as RulesProps<CricketConfig>)} />;
    case "timed":
      return <TimedRules {...(props as RulesProps<TimedConfig>)} />;
    case "rally":
      return <RallyRules {...(props as RulesProps<RallyConfig>)} />;
    case "tennis":
      return <TennisRules {...(props as RulesProps<TennisConfig>)} />;
    case "chess":
      return <ChessRules {...(props as RulesProps<ChessConfig>)} />;
    case "tally":
      return <TallyRules {...(props as RulesProps<TallyConfig>)} />;
  }
}
