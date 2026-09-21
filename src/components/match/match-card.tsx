import { HardDrive, Lock, MapPin, Trophy } from "lucide-react";
import Link from "next/link";
import { SportTile, StatusBadge, TeamMark } from "@/components/ui/misc";
import { sportOrDefault } from "@/lib/sports/registry";
import type { MatchListItem } from "@/lib/sports/types";
import { cn, formatDateTime } from "@/lib/utils";
import { TimeAgo } from "./time-ago";

export function matchTitle(m: Pick<MatchListItem, "title" | "participants">): string {
  if (m.title.trim()) return m.title.trim();
  const names = m.participants.map((p) => p.name);
  if (names.length <= 2) return names.join(" vs ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

export function matchHref(m: Pick<MatchListItem, "id" | "local">): string {
  return m.local ? `/local/${m.id}` : `/match/${m.id}`;
}

export function MatchCard({ match, className }: { match: MatchListItem; className?: string }) {
  const sport = sportOrDefault(match.sport);
  const summary = match.summary;
  const byId = new Map(match.participants.map((p) => [p.id, p]));
  const lines = summary?.lines?.length
    ? summary.lines
    : match.participants.map((p) => ({ participantId: p.id, score: "", detail: undefined, active: false, winner: false }));
  const shown = lines.slice(0, 4);
  const hidden = lines.length - shown.length;
  const started = !!summary && summary.status !== "Not started";

  return (
    <Link
      href={matchHref(match)}
      className={cn(
        "group block rounded-2xl border border-border bg-surface p-4 shadow-card transition-[border-color,transform] hover:border-primary/40 active:scale-[0.99]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <SportTile emoji={sport.emoji} accent={sport.accent} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{matchTitle(match)}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted">
            <span>{sport.name}</span>
            {match.venue ? (
              <>
                <span aria-hidden>·</span>
                <MapPin className="size-3" />
                <span className="truncate">{match.venue}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {match.local ? <HardDrive className="size-3.5 text-muted" aria-label="Saved on this device" /> : null}
          {!match.local && !match.is_public ? <Lock className="size-3.5 text-muted" aria-label="Private" /> : null}
          <StatusBadge status={match.status} hasStarted={started} />
        </div>
      </div>

      <ul className="mt-3.5 space-y-2">
        {shown.map((line) => {
          const p = byId.get(line.participantId);
          if (!p) return null;
          return (
            <li key={line.participantId} className="flex items-center gap-2.5">
              <TeamMark name={p.name} short={p.short} color={p.color} size="sm" />
              <span className={cn("min-w-0 flex-1 truncate text-sm", line.winner ? "font-bold" : "font-medium", line.active && "text-foreground")}>
                {p.name}
                {line.winner ? <Trophy className="ml-1.5 inline size-3.5 -translate-y-px text-amber-500" /> : null}
              </span>
              {line.detail ? <span className="shrink-0 text-xs text-muted tabular">{line.detail}</span> : null}
              <span className={cn("min-w-8 shrink-0 text-right font-mono text-base font-bold tabular", !line.winner && summary?.completed && "text-muted")}>
                {line.score}
              </span>
            </li>
          );
        })}
        {hidden > 0 ? <li className="pl-9.5 text-xs text-muted">+{hidden} more</li> : null}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
        <p className={cn("min-w-0 truncate font-medium", summary?.completed ? "text-primary" : "text-muted")}>
          {match.status === "scheduled" && match.scheduled_at
            ? `Starts ${formatDateTime(match.scheduled_at)}`
            : (summary?.status ?? "Not started")}
        </p>
        <TimeAgo iso={match.updated_at} className="shrink-0 text-muted" />
      </div>
    </Link>
  );
}

export function MatchGrid({ matches }: { matches: MatchListItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((m) => (
        <MatchCard key={`${m.local ? "l" : "c"}-${m.id}`} match={m} />
      ))}
    </div>
  );
}
