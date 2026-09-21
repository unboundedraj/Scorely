"use client";

import { Flag, Pause, Play, RefreshCcw, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { useNow } from "@/hooks/use-now";
import {
  CHESS_METHODS,
  currentChessGame,
  remainingNow,
  type ChessConfig,
  type ChessMethod,
  type ChessOutcome,
  type ChessState,
} from "@/lib/sports/engines/chess";
import type { Participant } from "@/lib/sports/types";
import type { MatchSync } from "@/lib/store/use-match-sync";
import { cn, eventTime, formatChessClock, formatHalf, plural } from "@/lib/utils";
import { ResultBanner, UndoButton } from "./common";

const other = (t: 0 | 1): 0 | 1 => (t === 0 ? 1 : 0);

function ColorChip({ white }: { white: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase",
        white ? "bg-white text-slate-900 ring-1 ring-slate-300" : "bg-slate-900 text-white ring-1 ring-slate-700",
      )}
    >
      {white ? "♔ White" : "♚ Black"}
    </span>
  );
}

function ClockFace({
  p,
  white,
  ms,
  active,
  flagged,
  hasClock,
  plies,
  onPress,
  rotate,
  className,
}: {
  p: Participant;
  white: boolean;
  ms: number;
  active: boolean;
  flagged: boolean;
  hasClock: boolean;
  plies: number;
  onPress?: () => void;
  rotate?: boolean;
  className?: string;
}) {
  const low = hasClock && active && ms < 20_000;
  const body = (
    <div className={cn("flex h-full w-full flex-col justify-between gap-3", rotate && "max-md:rotate-180")}>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-left text-base font-bold sm:text-lg">{p.name}</span>
        <ColorChip white={white} />
      </div>
      {hasClock ? (
        <span className={cn("font-mono text-6xl leading-none font-extrabold tracking-tight tabular sm:text-7xl lg:text-8xl", low && "animate-live-pulse")}>
          {formatChessClock(ms)}
        </span>
      ) : (
        <span className="text-4xl font-extrabold">{white ? "♔" : "♚"}</span>
      )}
      <span className="text-left text-xs font-medium opacity-70">{hasClock ? plural(Math.ceil(plies / 2), "move") : ""}</span>
    </div>
  );
  const cls = cn(
    "flex min-h-40 flex-1 rounded-3xl p-5 text-left shadow-card transition-colors sm:min-h-52",
    flagged ? "bg-live text-white" : active ? "bg-primary text-primary-foreground" : "bg-surface-2 text-foreground",
    className,
  );
  if (!onPress) return <div className={cls}>{body}</div>;
  return (
    <button type="button" onClick={onPress} className={cn(cls, "touch-manipulation active:brightness-95")} aria-label={`${p.name}: end turn`}>
      {body}
    </button>
  );
}

function ResultSheet({ sync, onClose }: { sync: MatchSync; onClose: () => void }) {
  const s = sync.state as ChessState;
  const ps = sync.match.participants;
  const game = currentChessGame(s);
  const [outcome, setOutcome] = useState<ChessOutcome | null>(null);
  const [method, setMethod] = useState<ChessMethod | null>(null);
  const decisive: ChessMethod[] = ["checkmate", "resignation", "timeout", "other"];
  const draws: ChessMethod[] = ["agreement", "stalemate", "repetition", "insufficient", "fifty_moves"];
  const whiteName = ps[game.white].name;
  const blackName = ps[other(game.white)].name;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Record result"
      footer={
        <Button
          size="lg"
          block
          disabled={!outcome}
          onClick={() => {
            sync.dispatch("result", { outcome, method: method ?? (outcome === "draw" ? "agreement" : "other"), at: eventTime() });
            onClose();
          }}
        >
          Save result
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["white", `${whiteName} wins`, "1–0"],
              ["draw", "Draw", "½–½"],
              ["black", `${blackName} wins`, "0–1"],
            ] as [ChessOutcome, string, string][]
          ).map(([value, label, score]) => (
            <button
              key={value}
              type="button"
              aria-pressed={outcome === value}
              onClick={() => {
                setOutcome(value);
                setMethod(null);
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center transition-colors",
                outcome === value ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-surface-2",
              )}
            >
              <span className="font-mono text-lg font-bold">{score}</span>
              <span className="line-clamp-2 text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
        {outcome ? (
          <div className="flex flex-wrap gap-1.5">
            {(outcome === "draw" ? draws : decisive).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={method === m}
                onClick={() => setMethod(m)}
                className={cn(
                  "h-9 rounded-lg border px-3 text-sm font-semibold",
                  method === m ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-surface-2",
                )}
              >
                {CHESS_METHODS[m]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

export function ChessScorer({ sync }: { sync: MatchSync }) {
  const s = sync.state as ChessState;
  const cfg = sync.config as unknown as ChessConfig;
  const ps = sync.match.participants;
  const game = currentChessGame(s);
  const hasClock = cfg.baseMinutes !== null;
  const ticking = hasClock && s.clock.running !== null && !s.clock.paused && !game.outcome;
  const now = useNow(100, ticking);
  const remaining: [number, number] = [remainingNow(s, 0, now || s.clock.lastAt || 0), remainingNow(s, 1, now || s.clock.lastAt || 0)];
  const editable = sync.canEdit && !s.ended && sync.status !== "abandoned";
  const [rotate, setRotate] = useState(true);
  const [resultOpen, setResultOpen] = useState(false);
  const flaggedFor = useRef<string | null>(null);

  // Flag fall: record a loss on time automatically (undo is always available).
  const runningSide = s.clock.running;
  const flagged = ticking && runningSide !== null && remaining[runningSide] <= 0;
  const gameKey = `${s.games.length}`;
  useEffect(() => {
    if (!flagged || !editable || runningSide === null || flaggedFor.current === gameKey) return;
    flaggedFor.current = gameKey;
    const loserIsWhite = runningSide === game.white;
    sync.dispatch("result", { outcome: loserIsWhite ? "black" : "white", method: "timeout", at: eventTime() });
  }, [flagged, editable, runningSide, gameKey, game.white, sync]);

  const press = (by: 0 | 1) => {
    if (!editable || game.outcome) return;
    if (!s.clock.started) {
      sync.dispatch("clock_start", { at: eventTime() });
      return;
    }
    if (s.clock.paused || s.clock.running !== by) return;
    sync.dispatch("press", { by, at: eventTime() });
  };

  const face = (t: 0 | 1, top: boolean) => (
    <ClockFace
      p={ps[t]}
      white={game.white === t}
      ms={remaining[t]}
      active={!game.outcome && s.clock.running === t && !s.clock.paused}
      flagged={hasClock && remaining[t] <= 0}
      hasClock={hasClock}
      plies={game.plies}
      onPress={editable && hasClock ? () => press(t) : undefined}
      rotate={top && rotate && sync.canEdit}
      className={top ? "order-1 md:order-2" : "order-3 md:order-1"}
    />
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between text-sm">
        <p className="font-semibold">
          {cfg.games > 1 ? `Game ${s.games.length} of ${cfg.games}` : "Game"}
          {hasClock ? <span className="font-normal text-muted"> · {cfg.baseMinutes}+{cfg.incrementSeconds}</span> : null}
        </p>
        {cfg.games > 1 ? (
          <p className="font-mono font-bold tabular">
            {formatHalf(s.score[0])} – {formatHalf(s.score[1])}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:grid md:grid-cols-2">
        {face(1, true)}
        <div className="order-2 flex flex-wrap items-center justify-center gap-2 md:order-3 md:col-span-2">
          {editable && !game.outcome ? (
            <>
              {hasClock && !s.clock.started ? (
                <Button size="lg" onClick={() => sync.dispatch("clock_start", { at: eventTime() })}>
                  <Play className="size-4" /> Start clock
                </Button>
              ) : null}
              {hasClock && s.clock.started ? (
                s.clock.paused ? (
                  <Button size="lg" variant="soft" onClick={() => sync.dispatch("resume", { at: eventTime() })}>
                    <Play className="size-4" /> Resume
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" onClick={() => sync.dispatch("pause", { at: eventTime() })}>
                    <Pause className="size-4" /> Pause
                  </Button>
                )
              ) : null}
              <Button size="lg" variant="outline" onClick={() => setResultOpen(true)}>
                <Flag className="size-4" /> Result
              </Button>
            </>
          ) : null}
          {editable && game.outcome ? (
            <>
              <Button size="lg" onClick={() => sync.dispatch("next_game")}>
                <SkipForward className="size-4" /> Next game
              </Button>
              <Button size="lg" variant="outline" onClick={() => sync.dispatch("end_match", { at: eventTime() })}>
                <Flag className="size-4" /> End match
              </Button>
            </>
          ) : null}
          {sync.canEdit && sync.status !== "abandoned" ? <UndoButton onUndo={sync.undo} disabled={sync.events.length === 0} /> : null}
          {sync.canEdit && hasClock ? (
            <Button size="icon" variant="ghost" className="md:hidden" onClick={() => setRotate((r) => !r)} aria-label="Flip top clock" title="Flip top clock">
              <RefreshCcw className="size-4" />
            </Button>
          ) : null}
        </div>
        {face(0, false)}
      </div>

      {s.ended && sync.summary.result ? (
        <ResultBanner text={sync.summary.result} winner={s.winner !== null ? ps[s.winner] : null} />
      ) : game.outcome ? (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-center text-sm font-semibold">
          Game {s.games.length}:{" "}
          {game.outcome === "draw" ? "Draw" : `${ps[game.outcome === "white" ? game.white : other(game.white)].name} wins`}
          {game.method ? ` · ${CHESS_METHODS[game.method]}` : ""}
        </p>
      ) : null}

      <GamesList s={s} ps={ps} />
      {resultOpen ? <ResultSheet sync={sync} onClose={() => setResultOpen(false)} /> : null}
    </div>
  );
}

function GamesList({ s, ps }: { s: ChessState; ps: Participant[] }) {
  const played = s.games.filter((g) => g.outcome);
  if (!played.length) return null;
  return (
    <Card className="divide-y divide-border">
      {played.map((g, i) => {
        const w = ps[g.white];
        const b = ps[other(g.white)];
        const score = g.outcome === "white" ? "1–0" : g.outcome === "black" ? "0–1" : "½–½";
        return (
          <div key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="w-14 shrink-0 text-xs font-semibold text-muted">Game {i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{w.name}</span> <span className="text-muted">vs</span> <span className="font-semibold">{b.name}</span>
            </span>
            <span className="font-mono font-bold">{score}</span>
            <span className="hidden w-28 truncate text-right text-xs text-muted sm:block">{g.method ? CHESS_METHODS[g.method] : ""}</span>
          </div>
        );
      })}
    </Card>
  );
}

export function ChessBoardView({ sync }: { sync: MatchSync }) {
  const s = sync.state as ChessState;
  const cfg = sync.config as unknown as ChessConfig;
  const ps = sync.match.participants;
  const game = currentChessGame(s);
  const hasClock = cfg.baseMinutes !== null;
  const ticking = hasClock && s.clock.running !== null && !s.clock.paused && !game.outcome;
  const now = useNow(100, ticking);
  return (
    <div className="w-full max-w-[1600px] text-center">
      <p className="text-[2.6vw] font-semibold text-white/60">
        {cfg.games > 1 ? `Game ${s.games.length} of ${cfg.games} · ${formatHalf(s.score[0])}–${formatHalf(s.score[1])}` : "Chess"}
      </p>
      <div className="mt-[2vw] grid grid-cols-2 gap-[3vw]">
        {[0, 1].map((i) => {
          const t = i as 0 | 1;
          const active = s.clock.running === t && !s.clock.paused && !game.outcome;
          return (
            <div key={t} className={cn("rounded-[3vw] p-[3vw]", active ? "bg-emerald-500 text-emerald-950" : "bg-white/10")}>
              <p className="truncate text-[3.2vw] font-bold">
                {game.white === t ? "♔" : "♚"} {ps[t].name}
              </p>
              <p className="font-mono text-[11vw] leading-none font-extrabold tabular">
                {hasClock ? formatChessClock(remainingNow(s, t, now || s.clock.lastAt || 0)) : formatHalf(s.score[t])}
              </p>
            </div>
          );
        })}
      </div>
      {sync.summary.result ? <p className="mt-[3vw] text-[3vw] font-semibold text-amber-300">{sync.summary.result}</p> : null}
    </div>
  );
}
