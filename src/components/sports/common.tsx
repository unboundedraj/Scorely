"use client";

import { Plus, RotateCcw, Trophy, UserPlus } from "lucide-react";
import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { TeamMark } from "@/components/ui/misc";
import type { Participant, Player } from "@/lib/sports/types";
import { cn, uid } from "@/lib/utils";

export interface NewPlayer {
  team: 0 | 1;
  id: string;
  name: string;
}

/** Players typed in during a form, sent along with the event as `add`. */
export function useRosterAdds() {
  const [adds, setAdds] = useState<NewPlayer[]>([]);
  return {
    adds,
    add(team: 0 | 1, name: string): string {
      const p = { team, id: uid(8), name: name.trim().slice(0, 60) };
      setAdds((a) => [...a, p]);
      return p.id;
    },
    withAdds(team: 0 | 1, roster: Player[]): Player[] {
      return [...roster, ...adds.filter((a) => a.team === team).map(({ id, name }) => ({ id, name }))];
    },
    reset() {
      setAdds([]);
    },
  };
}

export function PlayerPicker({
  label,
  players,
  value,
  onChange,
  onAdd,
  disabled = {},
  suggestion,
  color,
  columns = 2,
}: {
  label?: ReactNode;
  players: Player[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Called with a new name; must return the new player's id. */
  onAdd?: (name: string) => string;
  /** id → reason it can't be picked. */
  disabled?: Record<string, string>;
  suggestion?: string;
  color?: string;
  columns?: 1 | 2 | 3;
}) {
  // Open the name field straight away when nobody listed can be picked.
  const [adding, setAdding] = useState(() => players.every((p) => !!disabled[p.id]));
  const [name, setName] = useState("");

  const submit = () => {
    const n = name.trim() || suggestion || "";
    if (!n || !onAdd) return;
    onChange(onAdd(n));
    setName("");
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      {label ? <p className="text-sm font-semibold">{label}</p> : null}
      {players.length ? (
        <div className={cn("grid gap-1.5", columns === 1 ? "grid-cols-1" : columns === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
          {players.map((p) => {
            const reason = disabled[p.id];
            const active = value === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!!reason}
                onClick={() => onChange(active ? null : p.id)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors",
                  active ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border bg-surface hover:bg-surface-2",
                  reason && "opacity-45",
                )}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color ?? "var(--muted)" }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{p.name}</span>
                  {reason ? <span className="block truncate text-[11px] font-normal text-muted">{reason}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {onAdd ? (
        adding ? (
          <div className="flex gap-2">
            <Input
              autoFocus={players.length > 0}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestion ?? "Player name"}
              maxLength={60}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              aria-label="New player name"
            />
            <Button variant="soft" size="lg" onClick={submit} aria-label="Save new player">
              <Plus className="size-5" />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted hover:border-primary/50 hover:text-foreground"
          >
            <UserPlus className="size-4" /> Add player
          </button>
        )
      ) : null}
    </div>
  );
}

export function UndoButton({ onUndo, disabled, className, label = "Undo" }: { onUndo: () => void; disabled?: boolean; className?: string; label?: string }) {
  return (
    <Button variant="secondary" size="lg" onClick={onUndo} disabled={disabled} className={className} aria-label="Undo last action">
      <RotateCcw className="size-4" /> {label}
    </Button>
  );
}

export function ResultBanner({ text, winner, className }: { text: string; winner?: Participant | null; className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3", className)}
      role="status"
    >
      {winner ? <TeamMark name={winner.name} short={winner.short} color={winner.color} size="md" /> : null}
      <p className="min-w-0 flex-1 font-semibold">{text}</p>
      <Trophy className="size-6 shrink-0 text-amber-500" />
    </div>
  );
}

/** Large action button used on scoring keypads. */
export function PadButton({
  tone = "neutral",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { tone?: "neutral" | "primary" | "soft" | "danger" | "warning" }) {
  const tones = {
    neutral: "bg-surface-2 text-foreground hover:bg-surface-3",
    primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
    soft: "bg-primary-soft text-primary-soft-foreground hover:brightness-95 dark:hover:brightness-125",
    danger: "bg-danger text-white hover:opacity-90",
    warning: "bg-warning-soft text-warning hover:brightness-95 dark:hover:brightness-125",
  } as const;
  return (
    <button
      type="button"
      className={cn(
        "flex h-14 items-center justify-center gap-1.5 rounded-2xl text-lg font-bold select-none touch-manipulation transition-[transform,background-color,filter] active:scale-95 disabled:opacity-40 sm:h-16",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function StatRow({ label, values, format = String }: { label: string; values: [number, number]; format?: (n: number) => string }) {
  const total = values[0] + values[1];
  const left = total ? (values[0] / total) * 100 : 50;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="w-10 font-mono font-bold tabular">{format(values[0])}</span>
        <span className="text-muted">{label}</span>
        <span className="w-10 text-right font-mono font-bold tabular">{format(values[1])}</span>
      </div>
      <div className="mt-1.5 flex h-1.5 gap-1 overflow-hidden rounded-full">
        <div className="rounded-full bg-primary" style={{ width: `${left}%` }} />
        <div className="flex-1 rounded-full bg-surface-3" />
      </div>
    </div>
  );
}

export function ServeDot({ className }: { className?: string }) {
  return <span className={cn("inline-block size-2.5 rounded-full bg-amber-400 shadow-[0_0_0_3px_rgb(251_191_36/0.25)]", className)} aria-label="Serving" />;
}
