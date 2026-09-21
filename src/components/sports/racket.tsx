"use client";

import { ArrowLeftRight, Flag } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { currentGame, gamesToWin, rallyPointPressure, type RallyConfig, type RallyState } from "@/lib/sports/engines/rally";
import { currentSet, pointLabels, tennisPointPressure, type TennisConfig, type TennisState } from "@/lib/sports/engines/tennis";
import type { Participant } from "@/lib/sports/types";
import type { MatchSync } from "@/lib/store/use-match-sync";
import { cn } from "@/lib/utils";
import { ResultBanner, ServeDot, UndoButton } from "./common";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function TapPanel({
  p,
  big,
  sub,
  serving,
  pressure,
  onTap,
  disabled,
}: {
  p: Participant;
  big: string;
  sub: React.ReactNode;
  serving: boolean;
  pressure: string | null;
  onTap?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div className="flex w-full items-center justify-between gap-2">
        <span className="min-w-0 truncate text-left text-base font-bold sm:text-lg">{p.name}</span>
        {serving ? <ServeDot /> : null}
      </div>
      <span className="font-mono text-7xl leading-none font-extrabold tracking-tight tabular sm:text-8xl">{big}</span>
      <div className="flex w-full items-end justify-between gap-2 text-sm font-semibold opacity-90">
        <span>{sub}</span>
        {pressure ? <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] tracking-wide uppercase">{pressure}</span> : null}
      </div>
    </>
  );
  const className = cn(
    "relative flex h-52 flex-col items-center justify-between rounded-3xl p-4 text-white shadow-card select-none sm:h-64 sm:p-5",
    "bg-[linear-gradient(160deg,rgb(255_255_255/0.14),transparent_60%)]",
  );
  if (!onTap) {
    return (
      <div className={className} style={{ backgroundColor: p.color }}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      aria-label={`Point to ${p.name}`}
      className={cn(className, "touch-manipulation transition-transform active:scale-[0.97] disabled:opacity-60")}
      style={{ backgroundColor: p.color }}
    >
      {content}
    </button>
  );
}

function RetireSheet({ sync, ps, onClose }: { sync: MatchSync; ps: Participant[]; onClose: () => void }) {
  const [team, setTeam] = useState<0 | 1>(0);
  return (
    <Sheet
      open
      onClose={onClose}
      title="End match early"
      description="Record a retirement or walkover. The other side wins."
      size="sm"
      footer={
        <Button
          variant="danger"
          size="lg"
          block
          onClick={() => {
            sync.dispatch("retire", { team });
            onClose();
          }}
        >
          <Flag className="size-4" /> {ps[team].name} retires
        </Button>
      }
    >
      <Segmented value={team} onChange={setTeam} options={[0, 1].map((i) => ({ value: i as 0 | 1, label: ps[i].name }))} />
    </Sheet>
  );
}

function ControlsRow({ sync, onSwapServe, ps }: { sync: MatchSync; onSwapServe: () => void; ps: Participant[] }) {
  const [retire, setRetire] = useState(false);
  return (
    <div className="grid grid-cols-3 gap-2">
      <UndoButton onUndo={sync.undo} disabled={sync.events.length === 0} />
      <Button variant="secondary" size="lg" onClick={onSwapServe} disabled={sync.summary.completed}>
        <ArrowLeftRight className="size-4" /> Serve
      </Button>
      <Button variant="secondary" size="lg" onClick={() => setRetire(true)} disabled={sync.summary.completed}>
        <Flag className="size-4" /> End
      </Button>
      {retire ? <RetireSheet sync={sync} ps={ps} onClose={() => setRetire(false)} /> : null}
    </div>
  );
}

function pressureLabel(p: string | null, gameName = "Game"): string | null {
  if (!p) return null;
  if (p === "match") return "Match point";
  if (p === "set") return "Set point";
  if (p === "break") return "Break point";
  if (p === "game") return `${gameName} point`;
  return null;
}

// ---------------------------------------------------------------------------
// Rally sports (badminton, table tennis, volleyball…)
// ---------------------------------------------------------------------------

export function RallyScorer({ sync }: { sync: MatchSync }) {
  const s = sync.state as RallyState;
  const cfg = sync.config as unknown as RallyConfig;
  const ps = sync.match.participants;
  const ctx = { participants: ps, config: cfg };
  const g = currentGame(s);
  const done = s.winner !== null;
  const editable = sync.canEdit && !done && sync.status !== "abandoned";
  const winner = s.winner !== null ? ps[s.winner] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold">
          {done ? "Final" : `${cfg.gameName} ${s.games.length}`}
          <span className="font-normal text-muted"> · first to {gamesToWin(cfg)}</span>
        </p>
        <p className="text-muted">
          {cfg.gameName}s{" "}
          <span className="font-mono font-bold text-foreground tabular">
            {s.won[0]}–{s.won[1]}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => {
          const t = i as 0 | 1;
          return (
            <TapPanel
              key={ps[t].id}
              p={ps[t]}
              big={String(done ? s.won[t] : g.points[t])}
              sub={done ? `${cfg.gameName}s won` : `${cfg.gameName}s ${s.won[t]}`}
              serving={!done && s.server === t}
              pressure={done ? null : pressureLabel(rallyPointPressure(s, ctx, t), cfg.gameName)}
              onTap={editable ? () => sync.dispatch("point", { team: t }) : undefined}
            />
          );
        })}
      </div>

      {winner && sync.summary.result ? <ResultBanner text={sync.summary.result} winner={winner} /> : null}

      {sync.canEdit && sync.status !== "abandoned" ? (
        <ControlsRow sync={sync} ps={ps} onSwapServe={() => sync.dispatch("set_server", { team: s.server === 0 ? 1 : 0 })} />
      ) : null}

      <Card className="overflow-x-auto p-4 sm:p-5">
        <table className="w-full text-sm tabular">
          <thead className="text-xs text-muted">
            <tr>
              <th className="pb-2 text-left font-semibold">{cfg.gameName}s</th>
              {s.games.map((_, i) => (
                <th key={i} className="w-12 pb-2 text-center font-semibold">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((t) => (
              <tr key={t} className="border-t border-border">
                <td className="max-w-40 truncate py-2.5 font-semibold">
                  <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: ps[t].color }} />
                  {ps[t].name}
                </td>
                {s.games.map((game, i) => (
                  <td
                    key={i}
                    className={cn(
                      "text-center font-mono",
                      game.winner === t ? "font-extrabold" : "text-muted",
                      game.winner === null && "text-foreground",
                    )}
                  >
                    {game.points[t]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {g.log.length && !done ? (
          <p className="mt-3 text-xs text-muted">
            Longest run this {cfg.gameName.toLowerCase()}: <strong className="text-foreground">{longestRun(g.log)}</strong> points
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function longestRun(log: (0 | 1)[]): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < log.length; i++) {
    run = i > 0 && log[i] === log[i - 1] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function RallyBoard({ sync }: { sync: MatchSync }) {
  const s = sync.state as RallyState;
  const cfg = sync.config as unknown as RallyConfig;
  const ps = sync.match.participants;
  const g = currentGame(s);
  return (
    <BoardTwoSides
      ps={ps}
      top={s.winner !== null ? "Final" : `${cfg.gameName} ${s.games.length}`}
      values={s.winner !== null ? [String(s.won[0]), String(s.won[1])] : [String(g.points[0]), String(g.points[1])]}
      subs={[`${cfg.gameName}s ${s.won[0]}`, `${cfg.gameName}s ${s.won[1]}`]}
      server={s.winner === null ? s.server : null}
      footer={sync.summary.result ?? s.games.filter((x) => x.winner !== null).map((x) => `${x.points[0]}–${x.points[1]}`).join("   ")}
    />
  );
}

// ---------------------------------------------------------------------------
// Tennis
// ---------------------------------------------------------------------------

export function TennisScorer({ sync }: { sync: MatchSync }) {
  const s = sync.state as TennisState;
  const cfg = sync.config as unknown as TennisConfig;
  const ps = sync.match.participants;
  const ctx = { participants: ps, config: cfg };
  const set = currentSet(s);
  const labels = pointLabels(s, cfg.noAd);
  const done = s.winner !== null;
  const editable = sync.canEdit && !done && sync.status !== "abandoned";
  const deuce = !set.tiebreak && s.points[0] >= 3 && s.points[0] === s.points[1];
  const winner = s.winner !== null ? ps[s.winner] : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold">
          {done ? "Final" : set.tiebreak ? (set.superTiebreak ? "Match tiebreak" : "Tiebreak") : `Set ${s.sets.length}`}
          {deuce && !cfg.noAd ? <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">Deuce</span> : null}
          {deuce && cfg.noAd ? <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">Deciding point</span> : null}
        </p>
        <p className="text-muted">
          Games{" "}
          <span className="font-mono font-bold text-foreground tabular">
            {set.games[0]}–{set.games[1]}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => {
          const t = i as 0 | 1;
          return (
            <TapPanel
              key={ps[t].id}
              p={ps[t]}
              big={done ? String(s.setsWon[t]) : labels[t]}
              sub={done ? "Sets won" : `Games ${set.games[t]}`}
              serving={!done && s.server === t}
              pressure={done ? null : pressureLabel(tennisPointPressure(s, ctx, t))}
              onTap={editable ? () => sync.dispatch("point", { team: t }) : undefined}
            />
          );
        })}
      </div>

      {winner && sync.summary.result ? <ResultBanner text={sync.summary.result} winner={winner} /> : null}

      {sync.canEdit && sync.status !== "abandoned" ? (
        <ControlsRow sync={sync} ps={ps} onSwapServe={() => sync.dispatch("set_server", { team: s.server === 0 ? 1 : 0 })} />
      ) : null}

      <Card className="overflow-x-auto p-4 sm:p-5">
        <table className="w-full text-sm tabular">
          <thead className="text-xs text-muted">
            <tr>
              <th className="pb-2 text-left font-semibold">Player</th>
              {s.sets.map((_, i) => (
                <th key={i} className="w-12 pb-2 text-center font-semibold">
                  S{i + 1}
                </th>
              ))}
              {!done ? <th className="w-14 pb-2 text-center font-semibold">Pts</th> : null}
            </tr>
          </thead>
          <tbody>
            {[0, 1].map((t) => (
              <tr key={t} className="border-t border-border">
                <td className="max-w-40 truncate py-2.5 font-semibold">
                  <span className="mr-2 inline-block size-2.5 rounded-full" style={{ backgroundColor: ps[t].color }} />
                  {ps[t].name}
                  {!done && s.server === t ? <ServeDot className="ml-2 size-2" /> : null}
                </td>
                {s.sets.map((st, i) => (
                  <td key={i} className={cn("text-center font-mono", st.winner === t ? "font-extrabold" : st.winner === null ? "" : "text-muted")}>
                    {st.superTiebreak && st.tiebreak ? st.tiebreak[t] : st.games[t]}
                    {!st.superTiebreak && st.tiebreak && st.winner !== null && st.winner !== t ? (
                      <sup className="ml-0.5 text-[10px] text-muted">{st.tiebreak[t]}</sup>
                    ) : null}
                  </td>
                ))}
                {!done ? <td className="text-center font-mono font-bold">{labels[t]}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">
          Points won:{" "}
          <strong className="text-foreground">
            {s.pointsWon[0]}–{s.pointsWon[1]}
          </strong>{" "}
          · Best of {cfg.bestOf}
          {cfg.noAd ? " · No-ad" : ""}
        </p>
      </Card>
    </div>
  );
}

export function TennisBoard({ sync }: { sync: MatchSync }) {
  const s = sync.state as TennisState;
  const cfg = sync.config as unknown as TennisConfig;
  const ps = sync.match.participants;
  const set = currentSet(s);
  const labels = pointLabels(s, cfg.noAd);
  const done = s.winner !== null;
  return (
    <BoardTwoSides
      ps={ps}
      top={done ? "Final" : set.tiebreak ? "Tiebreak" : `Set ${s.sets.length} · ${set.games[0]}–${set.games[1]}`}
      values={done ? [String(s.setsWon[0]), String(s.setsWon[1])] : labels}
      subs={[0, 1].map((t) =>
        s.sets
          .filter((x) => x.winner !== null)
          .map((x) => x.games[t])
          .join("  "),
      ) as [string, string]}
      server={done ? null : s.server}
      footer={sync.summary.result ?? ""}
    />
  );
}

// ---------------------------------------------------------------------------

export function BoardTwoSides({
  ps,
  top,
  values,
  subs,
  server,
  footer,
}: {
  ps: Participant[];
  top: string;
  values: [string, string];
  subs: [string, string];
  server: 0 | 1 | null;
  footer?: string;
}) {
  return (
    <div className="w-full max-w-[1600px] text-center">
      <p className="text-[2.8vw] font-semibold text-white/60">{top}</p>
      <div className="mt-[2vw] grid grid-cols-2 gap-[3vw]">
        {[0, 1].map((t) => (
          <div key={t} className="rounded-[3vw] p-[3vw]" style={{ backgroundColor: ps[t].color }}>
            <p className="flex items-center justify-center gap-[1.5vw] truncate text-[3.2vw] font-bold">
              {ps[t].name}
              {server === t ? <span className="inline-block size-[1.8vw] rounded-full bg-amber-300" /> : null}
            </p>
            <p className="font-mono text-[17vw] leading-none font-extrabold tabular">{values[t]}</p>
            <p className="mt-[1vw] min-h-[3vw] font-mono text-[2.4vw] text-white/80">{subs[t]}</p>
          </div>
        ))}
      </div>
      {footer ? <p className="mt-[3vw] text-[2.6vw] font-semibold text-amber-300">{footer}</p> : null}
    </div>
  );
}
