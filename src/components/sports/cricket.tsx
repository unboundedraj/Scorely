"use client";

import { ArrowLeftRight, CircleDot, Flag, HeartPulse, MoreHorizontal, UserRoundX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/form";
import { TeamMark } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Tabs } from "@/components/ui/tabs";
import {
  availableBatters,
  bowlerQuotaReached,
  cricketPhase,
  currentInnings,
  dismissalText,
  economy,
  oversList,
  oversText,
  playerName,
  recentOver,
  runRate,
  strikeRate,
  WICKET_LABELS,
  type CricketConfig,
  type CricketState,
  type Delivery,
  type ExtraType,
  type Innings,
  type WicketKind,
} from "@/lib/sports/engines/cricket";
import type { Participant } from "@/lib/sports/types";
import type { MatchSync } from "@/lib/store/use-match-sync";
import { cn, ordinal, plural } from "@/lib/utils";
import { PadButton, PlayerPicker, ResultBanner, UndoButton, useRosterAdds } from "./common";

type Ctx = { s: CricketState; cfg: CricketConfig; ps: Participant[] };

function useCtx(sync: MatchSync): Ctx {
  return { s: sync.state as CricketState, cfg: sync.config as unknown as CricketConfig, ps: sync.match.participants };
}

// ---------------------------------------------------------------------------
// Delivery chip
// ---------------------------------------------------------------------------

export function BallChip({ d, size = "md" }: { d: Delivery; size?: "sm" | "md" | "lg" }) {
  const boundary = d.batRuns === 4 || d.batRuns === 6;
  const tone = d.wicket
    ? "bg-live text-white"
    : boundary
      ? "bg-primary text-primary-foreground"
      : d.extra === "wd" || d.extra === "nb"
        ? "bg-warning-soft text-warning"
        : d.runs === 0
          ? "bg-surface-2 text-muted"
          : "bg-surface-3 text-foreground";
  const sizes = { sm: "h-7 min-w-7 text-xs", md: "h-9 min-w-9 text-sm", lg: "h-14 min-w-14 text-xl" } as const;
  return (
    <span className={cn("inline-grid place-items-center rounded-full px-1.5 font-bold tabular", sizes[size], tone)} title={d.label}>
      {d.label === "0" ? "•" : d.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Scoreboard
// ---------------------------------------------------------------------------

function CricketScoreboard({ sync }: { sync: MatchSync }) {
  const { s, cfg, ps } = useCtx(sync);
  const inn = currentInnings(s);
  const bpo = cfg.ballsPerOver;
  const winner = s.result && s.result.winner !== null ? ps[s.result.winner] : null;

  if (!inn) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-center gap-4 py-2 sm:gap-8">
          {ps.slice(0, 2).map((p, i) => (
            <div key={p.id} className="flex flex-col items-center gap-2 text-center">
              <TeamMark name={p.name} short={p.short} color={p.color} size="xl" />
              <p className="max-w-32 truncate font-semibold">{p.name}</p>
              {i === cfg.battingFirst ? <span className="text-xs font-semibold text-primary">Batting first</span> : <span className="text-xs text-muted">Bowling first</span>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-sm text-muted">
          {sync.summary.status} · {cfg.overs} overs · {cfg.playersPerSide} a side
        </p>
      </Card>
    );
  }

  const batting = ps[inn.batting];
  const others = s.innings.filter((x) => x !== inn);
  const ballsLeft = cfg.overs * bpo - inn.balls;
  const need = inn.target !== null ? inn.target - inn.runs : null;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <TeamMark name={batting.name} short={batting.short} color={batting.color} size="sm" />
          <p className="min-w-0 truncate text-sm font-semibold">{batting.name}</p>
          <span className="text-xs text-muted">· {ordinal(s.innings.length)} innings</span>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-3">
          <p className="font-mono text-5xl leading-none font-extrabold tracking-tight tabular sm:text-6xl">
            {inn.runs}
            <span className="text-muted">/{inn.wickets}</span>
          </p>
          <p className="pb-1 font-mono text-lg font-semibold text-muted tabular">
            {oversText(inn.balls, bpo)}
            <span className="text-sm font-normal"> / {cfg.overs} ov</span>
          </p>
        </div>
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Metric label="CRR" value={runRate(inn.runs, inn.balls, bpo).toFixed(2)} />
          {inn.target !== null ? (
            <>
              <Metric label="Target" value={String(inn.target)} />
              {!inn.closed && need !== null && ballsLeft > 0 ? <Metric label="RRR" value={((need / ballsLeft) * bpo).toFixed(2)} /> : null}
            </>
          ) : !inn.closed && inn.balls > 0 ? (
            <Metric label="Projected" value={String(Math.round(inn.runs + runRate(inn.runs, inn.balls, bpo) * (ballsLeft / bpo)))} />
          ) : null}
          {inn.extras.wd + inn.extras.nb + inn.extras.b + inn.extras.lb > 0 ? (
            <Metric label="Extras" value={String(inn.extras.wd + inn.extras.nb + inn.extras.b + inn.extras.lb)} />
          ) : null}
        </dl>
        {s.result ? (
          <ResultBanner className="mt-4" text={s.result.text} winner={winner} />
        ) : (
          <p className="mt-3 text-sm font-semibold text-primary">{sync.summary.status}</p>
        )}
      </div>
      {others.length ? (
        <div className="border-t border-border bg-surface-2/50 px-4 py-2.5 sm:px-5">
          {others.map((o, i) => {
            const t = ps[o.batting];
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <TeamMark name={t.name} short={t.short} color={t.color} size="xs" />
                <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                <span className="font-mono font-bold tabular">
                  {o.runs}/{o.wickets}
                </span>
                <span className="w-14 text-right text-xs text-muted tabular">({oversText(o.balls, bpo)})</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-mono font-bold tabular">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batters, bowler, this over
// ---------------------------------------------------------------------------

function CurrentPlay({ sync }: { sync: MatchSync }) {
  const { s, cfg } = useCtx(sync);
  const inn = currentInnings(s);
  if (!inn || inn.closed) return null;
  const bpo = cfg.ballsPerOver;
  const batters = [inn.strikerId, inn.nonStrikerId];
  const bowlerId = inn.bowlerId ?? inn.lastOverBowlerId;
  const bowler = bowlerId ? inn.bowlers[bowlerId] : null;
  const over = recentOver(inn, bpo);

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm tabular">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-2 pl-4 text-left font-semibold sm:pl-5">Batter</th>
            <th className="w-10 text-right font-semibold">R</th>
            <th className="w-10 text-right font-semibold">B</th>
            <th className="hidden w-10 text-right font-semibold min-[400px]:table-cell">4s</th>
            <th className="hidden w-10 text-right font-semibold min-[400px]:table-cell">6s</th>
            <th className="w-16 pr-4 text-right font-semibold sm:pr-5">SR</th>
          </tr>
        </thead>
        <tbody>
          {batters.map((id, i) => {
            const b = id ? inn.batters[id] : null;
            return (
              <tr key={i} className="border-t border-border">
                <td className="py-2.5 pl-4 sm:pl-5">
                  <span className={cn("font-semibold", !b && "text-muted italic")}>
                    {b ? playerName(s, b.id) : "Waiting for batter"}
                  </span>
                  {b && id === inn.strikerId ? <span className="ml-1 text-primary">*</span> : null}
                </td>
                <td className="text-right font-bold">{b?.runs ?? ""}</td>
                <td className="text-right text-muted">{b?.balls ?? ""}</td>
                <td className="hidden text-right text-muted min-[400px]:table-cell">{b?.fours ?? ""}</td>
                <td className="hidden text-right text-muted min-[400px]:table-cell">{b?.sixes ?? ""}</td>
                <td className="pr-4 text-right text-muted sm:pr-5">{b ? strikeRate(b.runs, b.balls).toFixed(1) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-border px-4 py-2 text-xs text-muted sm:px-5">
        Partnership <span className="font-semibold text-foreground">{inn.partnership.runs}</span> ({inn.partnership.balls})
      </div>
      <table className="w-full border-t border-border text-sm tabular">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-2 pl-4 text-left font-semibold sm:pl-5">Bowler</th>
            <th className="w-12 text-right font-semibold">O</th>
            <th className="w-10 text-right font-semibold">M</th>
            <th className="w-10 text-right font-semibold">R</th>
            <th className="w-10 text-right font-semibold">W</th>
            <th className="w-16 pr-4 text-right font-semibold sm:pr-5">Econ</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <td className="py-2.5 pl-4 sm:pl-5">
              <span className={cn("font-semibold", !inn.bowlerId && "text-muted")}>{bowler ? playerName(s, bowler.id) : "—"}</span>
              {!inn.bowlerId && bowler ? <span className="ml-1 text-xs text-muted">(last over)</span> : null}
            </td>
            <td className="text-right">{bowler ? oversText(bowler.balls, bpo) : ""}</td>
            <td className="text-right text-muted">{bowler?.maidens ?? ""}</td>
            <td className="text-right">{bowler?.runs ?? ""}</td>
            <td className="text-right font-bold">{bowler?.wickets ?? ""}</td>
            <td className="pr-4 text-right text-muted sm:pr-5">{bowler ? economy(bowler.runs, bowler.balls, bpo).toFixed(2) : ""}</td>
          </tr>
        </tbody>
      </table>
      <div className="flex items-center gap-3 border-t border-border px-4 py-3 sm:px-5">
        <span className="shrink-0 text-xs font-semibold tracking-wide text-muted uppercase">This over</span>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {over.length ? over.map((d) => <BallChip key={d.seq} d={d} size="sm" />) : <span className="text-sm text-muted">—</span>}
        </div>
        <span className="ml-auto shrink-0 font-mono text-sm font-bold tabular">{over.reduce((a, d) => a + d.runs, 0)}</span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Scorer controls
// ---------------------------------------------------------------------------

function StartInnings({ sync }: { sync: MatchSync }) {
  const { s, cfg, ps } = useCtx(sync);
  const prev = currentInnings(s);
  const batting: 0 | 1 = prev ? prev.bowling : cfg.battingFirst;
  const bowling: 0 | 1 = batting === 0 ? 1 : 0;
  const roster = useRosterAdds();
  const [striker, setStriker] = useState<string | null>(null);
  const [nonStriker, setNonStriker] = useState<string | null>(null);
  const [bowler, setBowler] = useState<string | null>(null);
  const batters = roster.withAdds(batting, s.rosters[batting]);
  const bowlers = roster.withAdds(bowling, s.rosters[bowling]);
  const nextN = (team: 0 | 1) => roster.withAdds(team, s.rosters[team]).length + 1;

  return (
    <Card className="space-y-5 p-4 sm:p-5">
      <div>
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">{prev ? "Innings break" : "Let's play"}</p>
        <h3 className="mt-1 text-lg font-bold">
          {prev ? `${ps[batting].name} need ${prev.runs + 1} to win` : `${ps[batting].name} to bat`}
        </h3>
        {prev ? (
          <p className="text-sm text-muted">
            Target {prev.runs + 1} from {cfg.overs} overs · RRR {(((prev.runs + 1) / (cfg.overs * cfg.ballsPerOver)) * cfg.ballsPerOver).toFixed(2)}
          </p>
        ) : null}
      </div>
      <PlayerPicker
        label="Striker"
        players={batters}
        value={striker}
        onChange={setStriker}
        onAdd={(n) => roster.add(batting, n)}
        disabled={nonStriker ? { [nonStriker]: "Non-striker" } : {}}
        suggestion={`Batter ${nextN(batting)}`}
        color={ps[batting].color}
      />
      <PlayerPicker
        label="Non-striker"
        players={batters}
        value={nonStriker}
        onChange={setNonStriker}
        onAdd={(n) => roster.add(batting, n)}
        disabled={striker ? { [striker]: "Striker" } : {}}
        suggestion={`Batter ${nextN(batting)}`}
        color={ps[batting].color}
      />
      <PlayerPicker
        label="Opening bowler"
        players={bowlers}
        value={bowler}
        onChange={setBowler}
        onAdd={(n) => roster.add(bowling, n)}
        suggestion={`Bowler ${nextN(bowling)}`}
        color={ps[bowling].color}
      />
      <Button
        size="xl"
        block
        disabled={!striker || !nonStriker || !bowler || striker === nonStriker}
        onClick={() => {
          sync.dispatch("start_innings", { strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler, add: roster.adds });
          roster.reset();
        }}
      >
        Start {prev ? "2nd" : "1st"} innings
      </Button>
    </Card>
  );
}

function NewBatter({ sync }: { sync: MatchSync }) {
  const { s, ps } = useCtx(sync);
  const inn = currentInnings(s)!;
  const roster = useRosterAdds();
  const [pick, setPick] = useState<string | null>(null);
  const lastOut = [...inn.fow].pop();
  const outCard = lastOut ? inn.batters[lastOut.batterId] : null;
  // Includes retired-hurt batters, who may resume their innings.
  const available = roster.withAdds(inn.batting, availableBatters(s, inn));

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div>
        {outCard && outCard.dismissal ? (
          <>
            <p className="text-xs font-semibold tracking-wide text-live uppercase">Wicket</p>
            <h3 className="mt-1 text-lg font-bold">
              {playerName(s, outCard.id)} {outCard.runs} ({outCard.balls})
            </h3>
            <p className="text-sm text-muted">{dismissalText(s, outCard.dismissal)}</p>
          </>
        ) : (
          <h3 className="text-lg font-bold">Next batter</h3>
        )}
      </div>
      <PlayerPicker
        label="Who's in next?"
        players={available}
        value={pick}
        onChange={setPick}
        onAdd={(n) => roster.add(inn.batting, n)}
        suggestion={`Batter ${s.rosters[inn.batting].length + roster.adds.length + 1}`}
        color={ps[inn.batting].color}
      />
      <div className="flex gap-2">
        <UndoButton onUndo={sync.undo} />
        <Button
          size="lg"
          className="flex-1"
          disabled={!pick}
          onClick={() => {
            sync.dispatch("new_batter", { batterId: pick, add: roster.adds });
            roster.reset();
          }}
        >
          Send in
        </Button>
      </div>
    </Card>
  );
}

function BowlerPicker({ sync, onDone, mid = false }: { sync: MatchSync; onDone?: () => void; mid?: boolean }) {
  const { s, cfg, ps } = useCtx(sync);
  const inn = currentInnings(s)!;
  const roster = useRosterAdds();
  const [pick, setPick] = useState<string | null>(null);
  const bowlers = roster.withAdds(inn.bowling, s.rosters[inn.bowling]);
  const disabled: Record<string, string> = {};
  for (const p of bowlers) {
    if (!mid && p.id === inn.lastOverBowlerId) disabled[p.id] = "Bowled the last over";
    else if (bowlerQuotaReached(cfg, inn, p.id)) disabled[p.id] = "Quota complete";
    else if (mid && p.id === inn.bowlerId) disabled[p.id] = "Bowling now";
  }
  // Show current figures next to bowlers who have already bowled.
  const labelled = bowlers.map((p) => {
    const card = inn.bowlers[p.id];
    return card && !disabled[p.id] ? { ...p, name: `${p.name} · ${oversText(card.balls, cfg.ballsPerOver)}-${card.runs}-${card.wickets}` } : p;
  });
  const lastOver = inn.deliveries.filter((d) => d.over === Math.floor(inn.balls / cfg.ballsPerOver) - 1);

  return (
    <div className="space-y-4">
      {!mid && lastOver.length ? (
        <div>
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">End of over {Math.floor(inn.balls / cfg.ballsPerOver)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {lastOver.map((d) => (
              <BallChip key={d.seq} d={d} size="sm" />
            ))}
            <span className="ml-1 text-sm font-semibold">{plural(lastOver.reduce((a, d) => a + d.runs, 0), "run")}</span>
          </div>
        </div>
      ) : null}
      <PlayerPicker
        label={mid ? "Who completes the over?" : "Who bowls next?"}
        players={labelled}
        value={pick}
        onChange={setPick}
        onAdd={(n) => roster.add(inn.bowling, n)}
        disabled={disabled}
        suggestion={`Bowler ${s.rosters[inn.bowling].length + roster.adds.length + 1}`}
        color={ps[inn.bowling].color}
        columns={1}
      />
      <div className="flex gap-2">
        {!mid ? <UndoButton onUndo={sync.undo} /> : null}
        <Button
          size="lg"
          className="flex-1"
          disabled={!pick}
          onClick={() => {
            sync.dispatch("new_bowler", { bowlerId: pick, add: roster.adds });
            roster.reset();
            onDone?.();
          }}
        >
          {mid ? "Change bowler" : "Start over"}
        </Button>
      </div>
    </div>
  );
}

type Sheet = null | { kind: "extra"; extra: ExtraType } | { kind: "wicket" } | { kind: "more" } | { kind: "bowler" } | { kind: "retire" };

const EXTRA_INFO: Record<ExtraType, { title: string; hint: string; runs: number[] }> = {
  wd: { title: "Wide", hint: "Extra runs taken (a boundary off a wide is 4)", runs: [0, 1, 2, 3, 4] },
  nb: { title: "No ball", hint: "Runs scored off the bat", runs: [0, 1, 2, 3, 4, 6] },
  b: { title: "Byes", hint: "Runs taken", runs: [1, 2, 3, 4] },
  lb: { title: "Leg byes", hint: "Runs taken", runs: [1, 2, 3, 4] },
};

function Keypad({ sync }: { sync: MatchSync }) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);
  const ball = (runs: number, extra: ExtraType | null = null) => sync.dispatch("ball", extra ? { runs, extra } : { runs });

  return (
    <Card className="p-3 sm:p-4">
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((r) => (
          <PadButton key={r} onClick={() => ball(r)} aria-label={`${r} runs`}>
            {r === 0 ? "•" : r}
          </PadButton>
        ))}
        <PadButton tone="soft" onClick={() => ball(4)} aria-label="Four">
          4
        </PadButton>
        <PadButton tone="primary" onClick={() => ball(6)} aria-label="Six">
          6
        </PadButton>
        <PadButton tone="warning" className="text-base" onClick={() => setSheet({ kind: "extra", extra: "wd" })}>
          Wd
        </PadButton>
        <PadButton tone="warning" className="text-base" onClick={() => setSheet({ kind: "extra", extra: "nb" })}>
          NB
        </PadButton>
        <PadButton className="text-base" onClick={() => setSheet({ kind: "extra", extra: "b" })}>
          Bye
        </PadButton>
        <PadButton className="text-base" onClick={() => setSheet({ kind: "extra", extra: "lb" })}>
          LB
        </PadButton>
        <PadButton tone="danger" className="col-span-2" onClick={() => setSheet({ kind: "wicket" })}>
          Wicket
        </PadButton>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <UndoButton onUndo={sync.undo} disabled={sync.events.length === 0} />
        <Button variant="secondary" size="lg" onClick={() => setSheet({ kind: "more" })}>
          <MoreHorizontal className="size-4" /> More
        </Button>
      </div>

      {sheet?.kind === "extra" ? (
        <Sheet open onClose={close} title={EXTRA_INFO[sheet.extra].title} description={EXTRA_INFO[sheet.extra].hint} size="sm">
          <div className="grid grid-cols-3 gap-2">
            {EXTRA_INFO[sheet.extra].runs.map((r) => (
              <PadButton
                key={r}
                tone={r === 4 || r === 6 ? "soft" : "neutral"}
                onClick={() => {
                  ball(r, sheet.extra);
                  close();
                }}
              >
                {sheet.extra === "wd" || sheet.extra === "nb" ? (r === 0 ? sheet.extra : `+${r}`) : r}
              </PadButton>
            ))}
          </div>
        </Sheet>
      ) : null}
      {sheet?.kind === "wicket" ? <WicketSheet sync={sync} onClose={close} /> : null}
      {sheet?.kind === "more" ? (
        <Sheet open onClose={close} title="More options" size="sm">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {[5, 7].map((r) => (
                <PadButton
                  key={r}
                  onClick={() => {
                    ball(r);
                    close();
                  }}
                >
                  {r} runs
                </PadButton>
              ))}
            </div>
            <MoreItem
              icon={<ArrowLeftRight className="size-4" />}
              label="Swap strike"
              onClick={() => {
                sync.dispatch("swap_strike");
                close();
              }}
            />
            <MoreItem icon={<CircleDot className="size-4" />} label="Change bowler mid-over" onClick={() => setSheet({ kind: "bowler" })} />
            <MoreItem icon={<HeartPulse className="size-4" />} label="Retire a batter" onClick={() => setSheet({ kind: "retire" })} />
            <MoreItem
              icon={<Flag className="size-4" />}
              label="End innings now"
              danger
              onClick={() => {
                if (window.confirm("End this innings now?")) {
                  sync.dispatch("end_innings");
                  close();
                }
              }}
            />
          </div>
        </Sheet>
      ) : null}
      {sheet?.kind === "bowler" ? (
        <Sheet open onClose={close} title="Change bowler" size="sm">
          <BowlerPicker sync={sync} mid onDone={close} />
        </Sheet>
      ) : null}
      {sheet?.kind === "retire" ? <RetireSheet sync={sync} onClose={close} /> : null}
    </Card>
  );
}

function MoreItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-12 w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-semibold transition-colors",
        danger ? "text-danger hover:bg-danger-soft" : "bg-surface-2 hover:bg-surface-3",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

const KINDS: WicketKind[] = ["bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket"];

function WicketSheet({ sync, onClose }: { sync: MatchSync; onClose: () => void }) {
  const { s, ps } = useCtx(sync);
  const inn = currentInnings(s)!;
  const roster = useRosterAdds();
  const [kind, setKind] = useState<WicketKind | null>(null);
  const [outId, setOutId] = useState<string>(inn.strikerId ?? "");
  const [runs, setRuns] = useState(0);
  const [delivery, setDelivery] = useState<"legal" | "wd" | "nb">("legal");
  const [fielder, setFielder] = useState<string | null>(null);
  const needsFielder = kind === "caught" || kind === "run_out" || kind === "stumped";
  const deliveries: ("legal" | "wd" | "nb")[] = kind === "run_out" ? ["legal", "wd", "nb"] : kind === "stumped" ? ["legal", "wd"] : ["legal"];

  const confirm = () => {
    if (!kind) return;
    const extra = deliveries.includes(delivery) && delivery !== "legal" ? delivery : null;
    sync.dispatch("ball", {
      runs: kind === "run_out" ? runs : 0,
      ...(extra ? { extra } : {}),
      wicket: { kind, outId: kind === "run_out" ? outId : inn.strikerId, fielderId: needsFielder ? fielder : null },
      add: roster.adds,
    });
    onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Wicket"
      footer={
        <Button size="lg" variant="danger" block disabled={!kind} onClick={confirm}>
          Confirm wicket
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "h-12 rounded-xl border text-sm font-semibold transition-colors",
                kind === k ? "border-danger bg-danger-soft text-danger" : "border-border hover:bg-surface-2",
              )}
            >
              {WICKET_LABELS[k]}
            </button>
          ))}
        </div>

        {kind === "run_out" ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Who&apos;s out?</p>
              <Segmented
                value={outId}
                onChange={setOutId}
                options={[inn.strikerId, inn.nonStrikerId].filter(Boolean).map((id) => ({
                  value: id!,
                  label: `${playerName(s, id)}${id === inn.strikerId ? " *" : ""}`,
                }))}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Runs completed</p>
              <Segmented value={runs} onChange={setRuns} options={[0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
            </div>
          </>
        ) : null}

        {deliveries.length > 1 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Delivery</p>
            <Segmented
              value={delivery}
              onChange={setDelivery}
              options={deliveries.map((d) => ({ value: d, label: d === "legal" ? "Legal" : d === "wd" ? "Wide" : "No ball" }))}
            />
          </div>
        ) : null}

        {needsFielder ? (
          <PlayerPicker
            label={kind === "stumped" ? "Wicket-keeper (optional)" : "Fielder (optional)"}
            players={roster.withAdds(inn.bowling, s.rosters[inn.bowling])}
            value={fielder}
            onChange={setFielder}
            onAdd={(n) => roster.add(inn.bowling, n)}
            color={ps[inn.bowling].color}
            suggestion="Fielder"
          />
        ) : null}
      </div>
    </Sheet>
  );
}

function RetireSheet({ sync, onClose }: { sync: MatchSync; onClose: () => void }) {
  const { s } = useCtx(sync);
  const inn = currentInnings(s)!;
  const [who, setWho] = useState(inn.strikerId ?? "");
  const [kind, setKind] = useState<"retired_hurt" | "retired_out">("retired_hurt");
  return (
    <Sheet
      open
      onClose={onClose}
      title="Retire a batter"
      size="sm"
      footer={
        <Button
          size="lg"
          block
          onClick={() => {
            sync.dispatch("retire", { batterId: who, kind });
            onClose();
          }}
        >
          <UserRoundX className="size-4" /> Retire
        </Button>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={who}
          onChange={setWho}
          options={[inn.strikerId, inn.nonStrikerId].filter(Boolean).map((id) => ({ value: id!, label: playerName(s, id) }))}
        />
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "retired_hurt", label: "Retired hurt" },
            { value: "retired_out", label: "Retired out" },
          ]}
        />
        <p className="text-sm text-muted">
          {kind === "retired_hurt" ? "Not a wicket — they can bat again later." : "Counts as a wicket."}
        </p>
      </div>
    </Sheet>
  );
}

function Controls({ sync }: { sync: MatchSync }) {
  const { s } = useCtx(sync);
  const phase = cricketPhase(s);
  if (sync.status === "abandoned") return null;
  switch (phase) {
    case "openers":
    case "break":
      return (
        <div className="space-y-2">
          <StartInnings sync={sync} />
          {phase === "break" ? <UndoButton onUndo={sync.undo} className="w-full" label="Undo last ball" /> : null}
        </div>
      );
    case "batter":
      return <NewBatter sync={sync} />;
    case "bowler":
      return (
        <Card className="p-4 sm:p-5">
          <BowlerPicker sync={sync} />
        </Card>
      );
    case "play":
      return <Keypad sync={sync} />;
    case "done":
      return (
        <Card className="p-4">
          <UndoButton onUndo={sync.undo} className="w-full" label="Undo last ball" />
        </Card>
      );
  }
}

// ---------------------------------------------------------------------------
// Scorecard & overs
// ---------------------------------------------------------------------------

function InningsCard({ s, cfg, inn, team }: { s: CricketState; cfg: CricketConfig; inn: Innings; team: Participant }) {
  const bpo = cfg.ballsPerOver;
  const extras = inn.extras.wd + inn.extras.nb + inn.extras.b + inn.extras.lb;
  const yetToBat = s.rosters[inn.batting].filter((p) => !inn.batters[p.id]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TeamMark name={team.name} short={team.short} color={team.color} size="sm" />
        <h3 className="min-w-0 flex-1 truncate font-semibold">{team.name}</h3>
        <span className="font-mono font-bold tabular">
          {inn.runs}/{inn.wickets}
        </span>
        <span className="text-sm text-muted tabular">({oversText(inn.balls, bpo)} ov)</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[420px] text-sm tabular">
          <thead className="bg-surface-2/60 text-xs text-muted">
            <tr>
              <th className="py-2 pl-3 text-left font-semibold">Batter</th>
              <th className="w-10 text-right font-semibold">R</th>
              <th className="w-10 text-right font-semibold">B</th>
              <th className="w-9 text-right font-semibold">4s</th>
              <th className="w-9 text-right font-semibold">6s</th>
              <th className="w-14 pr-3 text-right font-semibold">SR</th>
            </tr>
          </thead>
          <tbody>
            {inn.battingOrder.map((id) => {
              const b = inn.batters[id];
              const atCrease = !inn.closed && (id === inn.strikerId || id === inn.nonStrikerId);
              return (
                <tr key={id} className="border-t border-border align-top">
                  <td className="py-2 pl-3">
                    <p className="font-semibold">
                      {playerName(s, id)}
                      {atCrease && id === inn.strikerId ? <span className="text-primary"> *</span> : null}
                    </p>
                    <p className="text-xs text-muted">{dismissalText(s, b.dismissal, b.retiredHurt)}</p>
                  </td>
                  <td className="py-2 text-right font-bold">{b.runs}</td>
                  <td className="py-2 text-right text-muted">{b.balls}</td>
                  <td className="py-2 text-right text-muted">{b.fours}</td>
                  <td className="py-2 text-right text-muted">{b.sixes}</td>
                  <td className="py-2 pr-3 text-right text-muted">{strikeRate(b.runs, b.balls).toFixed(1)}</td>
                </tr>
              );
            })}
            <tr className="border-t border-border">
              <td className="py-2 pl-3 text-muted">
                Extras <span className="text-xs">(wd {inn.extras.wd}, nb {inn.extras.nb}, b {inn.extras.b}, lb {inn.extras.lb})</span>
              </td>
              <td className="py-2 text-right font-bold">{extras}</td>
              <td colSpan={4} />
            </tr>
            <tr className="border-t border-border bg-surface-2/40">
              <td className="py-2 pl-3 font-semibold">Total</td>
              <td className="py-2 text-right font-extrabold">{inn.runs}</td>
              <td colSpan={4} className="py-2 pr-3 text-right text-xs text-muted">
                {inn.wickets} wkts · {oversText(inn.balls, bpo)} ov · RR {runRate(inn.runs, inn.balls, bpo).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {yetToBat.length ? (
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">Yet to bat: </span>
          {yetToBat.map((p) => p.name).join(", ")}
        </p>
      ) : null}
      {inn.fow.length ? (
        <p className="text-sm text-muted">
          <span className="font-semibold text-foreground">Fall of wickets: </span>
          {inn.fow.map((f) => `${f.runs}-${f.wicket} (${playerName(s, f.batterId)}, ${oversText(f.balls, bpo)})`).join(" · ")}
        </p>
      ) : null}
      {inn.bowlingOrder.length ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[420px] text-sm tabular">
            <thead className="bg-surface-2/60 text-xs text-muted">
              <tr>
                <th className="py-2 pl-3 text-left font-semibold">Bowler</th>
                <th className="w-12 text-right font-semibold">O</th>
                <th className="w-9 text-right font-semibold">M</th>
                <th className="w-10 text-right font-semibold">R</th>
                <th className="w-9 text-right font-semibold">W</th>
                <th className="w-14 text-right font-semibold">Econ</th>
                <th className="w-16 pr-3 text-right font-semibold">Wd/Nb</th>
              </tr>
            </thead>
            <tbody>
              {inn.bowlingOrder.map((id) => {
                const b = inn.bowlers[id];
                return (
                  <tr key={id} className="border-t border-border">
                    <td className="py-2 pl-3 font-semibold">{playerName(s, id)}</td>
                    <td className="py-2 text-right">{oversText(b.balls, bpo)}</td>
                    <td className="py-2 text-right text-muted">{b.maidens}</td>
                    <td className="py-2 text-right">{b.runs}</td>
                    <td className="py-2 text-right font-bold">{b.wickets}</td>
                    <td className="py-2 text-right text-muted">{economy(b.runs, b.balls, bpo).toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right text-muted">
                      {b.wides}/{b.noBalls}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function OversTab({ s, inn }: { s: CricketState; inn: Innings }) {
  const overs = oversList(inn).reverse();
  if (!overs.length) return <p className="py-6 text-center text-sm text-muted">No balls bowled yet.</p>;
  return (
    <ol className="divide-y divide-border">
      {overs.map((o) => (
        <li key={o.over} className="flex items-start gap-3 py-3">
          <div className="w-14 shrink-0">
            <p className="text-xs font-semibold text-muted">Over</p>
            <p className="font-mono text-lg font-bold tabular">{o.over + 1}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{playerName(s, o.bowlerId)}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {o.deliveries.map((d) => (
                <BallChip key={d.seq} d={d} size="sm" />
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono font-bold tabular">{o.runs}</p>
            <p className="text-xs text-muted">{o.wickets ? plural(o.wickets, "wkt") : "runs"}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Details({ sync }: { sync: MatchSync }) {
  const { s, cfg, ps } = useCtx(sync);
  const [tab, setTab] = useState<"card" | "overs">("card");
  const [innIdx, setInnIdx] = useState<number | null>(null);
  if (!s.innings.length) return null;
  const idx = innIdx !== null && innIdx < s.innings.length ? innIdx : s.innings.length - 1;
  const inn = s.innings[idx];
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "card", label: "Scorecard" },
            { value: "overs", label: "Overs" },
          ]}
          className="border-none"
        />
        {s.innings.length > 1 ? (
          <Segmented
            size="sm"
            value={idx}
            onChange={setInnIdx}
            options={s.innings.map((x, i) => ({ value: i, label: ps[x.batting].short || ps[x.batting].name }))}
          />
        ) : null}
      </div>
      <div className="mt-4">
        {tab === "card" ? <InningsCard s={s} cfg={cfg} inn={inn} team={ps[inn.batting]} /> : <OversTab s={s} inn={inn} />}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function CricketScorer({ sync }: { sync: MatchSync }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="lg:col-start-1">
        <CricketScoreboard sync={sync} />
      </div>
      <div className="lg:col-start-1">
        <CurrentPlay sync={sync} />
      </div>
      {sync.canEdit ? (
        <aside className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">
          <Controls sync={sync} />
        </aside>
      ) : null}
      <div className="lg:col-start-1">
        <Details sync={sync} />
      </div>
    </div>
  );
}

export function CricketBoard({ sync }: { sync: MatchSync }) {
  const { s, cfg, ps } = useCtx(sync);
  const inn = currentInnings(s);
  const bpo = cfg.ballsPerOver;
  if (!inn) {
    return (
      <div className="text-center">
        <p className="text-[6vw] font-extrabold">
          {ps[0]?.name} <span className="text-white/40">vs</span> {ps[1]?.name}
        </p>
        <p className="mt-4 text-[2.4vw] text-white/60">{sync.summary.status}</p>
      </div>
    );
  }
  const batting = ps[inn.batting];
  const striker = inn.strikerId ? inn.batters[inn.strikerId] : null;
  const non = inn.nonStrikerId ? inn.batters[inn.nonStrikerId] : null;
  const bowler = inn.bowlerId ? inn.bowlers[inn.bowlerId] : inn.lastOverBowlerId ? inn.bowlers[inn.lastOverBowlerId] : null;
  const other = s.innings.find((x) => x !== inn);
  return (
    <div className="w-full max-w-[1600px]">
      <div className="flex items-center gap-[1.5vw]">
        <span className="size-[3vw] rounded-full" style={{ backgroundColor: batting.color }} />
        <p className="text-[3vw] font-bold">{batting.name}</p>
      </div>
      <div className="mt-[1vw] flex items-end gap-[3vw]">
        <p className="font-mono text-[16vw] leading-[0.85] font-extrabold tracking-tight tabular">
          {inn.runs}
          <span className="text-white/40">/{inn.wickets}</span>
        </p>
        <p className="pb-[1.5vw] font-mono text-[4vw] text-white/60 tabular">
          {oversText(inn.balls, bpo)}
          <span className="text-[2vw]"> / {cfg.overs} ov</span>
        </p>
      </div>
      <p className="mt-[2vw] text-[2.6vw] font-semibold text-emerald-300">{sync.summary.status}</p>
      <div className="mt-[3vw] grid grid-cols-2 gap-[3vw] text-[2.2vw]">
        <div className="space-y-[0.6vw]">
          {[striker, non].map((b, i) =>
            b ? (
              <p key={i} className="flex justify-between gap-4">
                <span className="truncate">
                  {playerName(s, b.id)}
                  {b.id === inn.strikerId ? <span className="text-emerald-300"> *</span> : null}
                </span>
                <span className="font-mono font-bold tabular">
                  {b.runs} <span className="font-normal text-white/50">({b.balls})</span>
                </span>
              </p>
            ) : null,
          )}
        </div>
        <div className="space-y-[0.6vw]">
          {bowler ? (
            <p className="flex justify-between gap-4">
              <span className="truncate">{playerName(s, bowler.id)}</span>
              <span className="font-mono font-bold tabular">
                {oversText(bowler.balls, bpo)}-{bowler.maidens}-{bowler.runs}-{bowler.wickets}
              </span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-[0.6vw]">
            {recentOver(inn, bpo).map((d) => (
              <BallChip key={d.seq} d={d} size="lg" />
            ))}
          </div>
        </div>
      </div>
      {other ? (
        <p className="mt-[3vw] text-[2vw] text-white/60">
          {ps[other.batting].name} {other.runs}/{other.wickets} ({oversText(other.balls, bpo)} ov)
        </p>
      ) : null}
    </div>
  );
}
