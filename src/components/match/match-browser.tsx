"use client";

import { Plus } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { SPORTS } from "@/lib/sports/registry";
import type { MatchListItem } from "@/lib/sports/types";
import { localMatchStore } from "@/lib/store/local";
import { cn } from "@/lib/utils";
import { MatchGrid } from "./match-card";

type Filter = "all" | "live" | "completed" | "scheduled";

function isLive(m: MatchListItem) {
  return m.status === "live";
}

/** My matches: cloud matches from the server merged with on-device ones. */
export function MatchBrowser({ cloud }: { cloud: MatchListItem[] }) {
  const localRecords = useSyncExternalStore(localMatchStore.subscribe, localMatchStore.getSnapshot, localMatchStore.getServerSnapshot);
  const [filter, setFilter] = useState<Filter>("all");
  const [sport, setSport] = useState<string | null>(null);

  const all = useMemo(() => {
    const local: MatchListItem[] = localRecords.map((m) => ({ ...m, local: true }));
    return [...cloud, ...local].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [cloud, localRecords]);

  const sportsUsed = useMemo(() => SPORTS.filter((s) => all.some((m) => m.sport === s.id)), [all]);
  const visible = all.filter(
    (m) =>
      (filter === "all" || (filter === "live" ? isLive(m) : m.status === filter)) && (!sport || m.sport === sport),
  );

  if (!all.length) {
    return (
      <EmptyState
        icon="🏟️"
        title="No matches yet"
        description="Start scoring your first game — cricket, football, chess or anything else."
        action={
          <ButtonLink href="/new" size="lg">
            <Plus className="size-5" /> New match
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          size="sm"
          className="sm:w-auto"
          options={[
            { value: "all", label: `All ${all.length}` },
            { value: "live", label: "Live" },
            { value: "completed", label: "Finished" },
            { value: "scheduled", label: "Upcoming" },
          ]}
        />
        {sportsUsed.length > 1 ? (
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <Chip active={!sport} onClick={() => setSport(null)}>
              All sports
            </Chip>
            {sportsUsed.map((s) => (
              <Chip key={s.id} active={sport === s.id} onClick={() => setSport(sport === s.id ? null : s.id)}>
                {s.emoji} {s.name}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>
      {visible.length ? <MatchGrid matches={visible} /> : <p className="py-10 text-center text-sm text-muted">No matches match these filters.</p>}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors",
        active ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border bg-surface text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
