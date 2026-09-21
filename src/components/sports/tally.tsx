"use client";

import { Crown, Flag, ListPlus, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { TeamMark } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { tallyRanking, type TallyConfig, type TallyState } from "@/lib/sports/engines/tally";
import type { MatchSync } from "@/lib/store/use-match-sync";
import { cn } from "@/lib/utils";
import { ResultBanner, UndoButton } from "./common";

function RoundSheet({ sync, onClose }: { sync: MatchSync; onClose: () => void }) {
  const ps = sync.match.participants;
  const s = sync.state as TallyState;
  const [values, setValues] = useState<string[]>(() => ps.map(() => ""));
  const parsed = values.map((v) => Math.trunc(Number(v)) || 0);
  return (
    <Sheet
      open
      onClose={onClose}
      title={`Round ${s.rounds.length + 1}`}
      description="Enter each player's score for this round. Use a minus sign for penalties."
      footer={
        <Button
          size="lg"
          block
          disabled={values.every((v) => !v.trim())}
          onClick={() => {
            sync.dispatch("round", { scores: parsed });
            onClose();
          }}
        >
          Add round
        </Button>
      }
    >
      <div className="space-y-2">
        {ps.map((p, i) => (
          <label key={p.id} className="flex items-center gap-3">
            <TeamMark name={p.name} color={p.color} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
            <span className="w-14 text-right text-xs text-muted tabular">{s.totals[i]}</span>
            <Input
              inputMode="numeric"
              autoFocus={i === 0}
              value={values[i]}
              onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value.replace(/[^0-9-]/g, "") : v)))}
              className="w-24 text-right font-mono"
              placeholder="0"
              aria-label={`${p.name} round score`}
            />
          </label>
        ))}
      </div>
    </Sheet>
  );
}

function CustomSheet({ sync, index, onClose }: { sync: MatchSync; index: number; onClose: () => void }) {
  const p = sync.match.participants[index];
  const [value, setValue] = useState("");
  const n = Math.trunc(Number(value)) || 0;
  const apply = (sign: 1 | -1) => {
    if (!n) return;
    sync.dispatch("adjust", { p: index, delta: sign * Math.abs(n) });
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={p.name}
      description="Add or subtract any amount."
      size="sm"
      footer={
        <>
          <Button size="lg" variant="secondary" className="flex-1" disabled={!n} onClick={() => apply(-1)}>
            <Minus className="size-4" /> Subtract
          </Button>
          <Button size="lg" className="flex-1" disabled={!n} onClick={() => apply(1)}>
            <Plus className="size-4" /> Add
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
        className="h-16 text-center font-mono text-3xl font-bold"
        placeholder="0"
        aria-label="Amount"
      />
    </Sheet>
  );
}

export function TallyScorer({ sync }: { sync: MatchSync }) {
  const s = sync.state as TallyState;
  const cfg = sync.config as unknown as TallyConfig;
  const ps = sync.match.participants;
  const ranking = tallyRanking(s, cfg.winCondition);
  const rankOf = new Map(ranking.map((idx, pos) => [idx, pos + 1]));
  const editable = sync.canEdit && !s.ended && sync.status !== "abandoned";
  const [roundOpen, setRoundOpen] = useState(false);
  const [custom, setCustom] = useState<number | null>(null);
  const incs = cfg.increments.length ? cfg.increments : [1];
  const winnerIdx = s.ended && s.winners.length === 1 ? s.winners[0] : null;
  const anyScore = s.totals.some((t) => t !== 0) || s.rounds.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted">
          {cfg.winCondition === "highest" ? "Highest score wins" : "Lowest score wins"}
          {cfg.target !== null ? ` · ends at ${cfg.target}` : ""}
          {s.rounds.length ? ` · ${s.rounds.length} round${s.rounds.length === 1 ? "" : "s"}` : ""}
        </p>
        {editable ? (
          <div className="flex gap-2">
            <Button variant="soft" size="md" onClick={() => setRoundOpen(true)}>
              <ListPlus className="size-4" /> Add round
            </Button>
            <UndoButton onUndo={sync.undo} disabled={sync.events.length === 0} className="h-10 text-sm" />
          </div>
        ) : null}
      </div>

      {s.ended && sync.summary.result ? <ResultBanner text={sync.summary.result} winner={winnerIdx !== null ? ps[winnerIdx] : null} /> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ps.map((p, i) => {
          const rank = rankOf.get(i) ?? 0;
          const leading = anyScore && rank === 1;
          return (
            <Card key={p.id} className={cn("overflow-hidden", leading && "ring-2 ring-amber-400/70")}>
              <div className="h-1.5" style={{ backgroundColor: p.color }} />
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <TeamMark name={p.name} color={p.color} size="sm" />
                  <p className="min-w-0 flex-1 truncate font-semibold">{p.name}</p>
                  {anyScore ? (
                    <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", leading ? "bg-amber-400/20 text-amber-600 dark:text-amber-300" : "bg-surface-2 text-muted")}>
                      {leading ? <Crown className="size-3" /> : null}#{rank}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setCustom(i)}
                  className="mt-2 block w-full text-center font-mono text-6xl font-extrabold tracking-tight tabular disabled:cursor-default"
                  aria-label={editable ? `${p.name}: ${s.totals[i]}. Tap to enter an amount` : undefined}
                >
                  {s.totals[i]}
                </button>
                {editable ? (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" size="lg" onClick={() => sync.dispatch("adjust", { p: i, delta: -incs[0] })} aria-label={`Minus ${incs[0]}`}>
                        <Minus className="size-5" />
                      </Button>
                      <Button size="lg" onClick={() => sync.dispatch("adjust", { p: i, delta: incs[0] })} aria-label={`Plus ${incs[0]}`}>
                        <Plus className="size-5" /> {incs[0]}
                      </Button>
                    </div>
                    {incs.length > 1 ? (
                      <div className="flex gap-1.5">
                        {incs.slice(1).map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => sync.dispatch("adjust", { p: i, delta: n })}
                            className="h-9 flex-1 rounded-lg bg-primary-soft text-sm font-bold text-primary-soft-foreground active:scale-95"
                          >
                            +{n}
                          </button>
                        ))}
                        {incs.slice(1).map((n) => (
                          <button
                            key={`m${n}`}
                            type="button"
                            onClick={() => sync.dispatch("adjust", { p: i, delta: -n })}
                            className="h-9 flex-1 rounded-lg bg-surface-2 text-sm font-bold text-muted active:scale-95"
                          >
                            −{n}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      {editable && anyScore ? (
        <Button
          variant="outline"
          size="lg"
          block
          onClick={() => {
            if (window.confirm("End the game and declare the winner?")) sync.dispatch("end_match");
          }}
        >
          <Flag className="size-4" /> End game
        </Button>
      ) : null}
      {sync.canEdit && s.ended ? <UndoButton onUndo={sync.undo} className="w-full" label="Undo — reopen game" /> : null}

      {s.rounds.length ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-max text-sm tabular">
            <thead className="bg-surface-2/60 text-xs text-muted">
              <tr>
                <th className="sticky left-0 bg-surface-2 py-2 pl-4 text-left font-semibold">Round</th>
                {ps.map((p) => (
                  <th key={p.id} className="px-3 py-2 text-right font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.rounds.map((r, ri) => (
                <tr key={r.seq} className="border-t border-border">
                  <td className="sticky left-0 bg-surface py-2 pl-4 text-muted">{ri + 1}</td>
                  {r.scores.map((v, i) => (
                    <td key={i} className={cn("px-3 py-2 text-right font-mono", v < 0 && "text-danger")}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              {s.adjustments.some((a) => a !== 0) ? (
                <tr className="border-t border-border">
                  <td className="sticky left-0 bg-surface py-2 pl-4 text-muted">Quick +/−</td>
                  {s.adjustments.map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right font-mono text-muted">
                      {v}
                    </td>
                  ))}
                </tr>
              ) : null}
              <tr className="border-t border-border bg-surface-2/40 font-bold">
                <td className="sticky left-0 bg-surface-2 py-2 pl-4">Total</td>
                {s.totals.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right font-mono">
                    {v}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </Card>
      ) : null}

      {roundOpen ? <RoundSheet sync={sync} onClose={() => setRoundOpen(false)} /> : null}
      {custom !== null ? <CustomSheet sync={sync} index={custom} onClose={() => setCustom(null)} /> : null}
    </div>
  );
}

export function TallyBoard({ sync }: { sync: MatchSync }) {
  const s = sync.state as TallyState;
  const cfg = sync.config as unknown as TallyConfig;
  const ps = sync.match.participants;
  const ranking = tallyRanking(s, cfg.winCondition);
  return (
    <div className="w-full max-w-[1400px]">
      <ol className="space-y-[1.2vw]">
        {ranking.map((i, pos) => (
          <li key={ps[i].id} className="flex items-center gap-[2vw] rounded-[2vw] bg-white/8 px-[2.5vw] py-[1.2vw]">
            <span className="w-[4vw] font-mono text-[3vw] font-bold text-white/50">{pos + 1}</span>
            <span className="size-[3vw] rounded-full" style={{ backgroundColor: ps[i].color }} />
            <span className="min-w-0 flex-1 truncate text-[3.4vw] font-bold">{ps[i].name}</span>
            <span className="font-mono text-[5vw] font-extrabold tabular">{s.totals[i]}</span>
          </li>
        ))}
      </ol>
      {sync.summary.result ? <p className="mt-[3vw] text-center text-[3vw] font-semibold text-amber-300">{sync.summary.result}</p> : null}
    </div>
  );
}
