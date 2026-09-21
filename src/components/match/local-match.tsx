"use client";

import { HardDrive } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import type { MatchRecord } from "@/lib/sports/types";
import { localMatchStore } from "@/lib/store/local";
import { BoardScreen } from "./board-screen";
import { MatchScreen } from "./match-screen";

const noop = () => () => {};

function Loaded({ match, board, canUpload }: { match: MatchRecord; board: boolean; canUpload: boolean }) {
  // Read the event log once; the sync hook owns it from here on.
  const [events] = useState(() => localMatchStore.events(match.id));
  return board ? (
    <BoardScreen initialMatch={match} initialEvents={events} mode="local" />
  ) : (
    <MatchScreen initialMatch={match} initialEvents={events} mode="local" canEdit canUpload={canUpload} />
  );
}

/** Loads a match stored in this browser's localStorage. */
export function LocalMatch({ id, board = false, canUpload = false }: { id: string; board?: boolean; canUpload?: boolean }) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const list = useSyncExternalStore(localMatchStore.subscribe, localMatchStore.getSnapshot, localMatchStore.getServerSnapshot);
  // Freeze the first record we see: later index updates flow through the sync hook.
  const [initial, setInitial] = useState<MatchRecord | null>(null);
  const found = list.find((m) => m.id === id) ?? null;
  if (found && !initial) setInitial(found);

  if (!mounted || (found && !initial)) {
    return <div className="min-h-dvh" aria-busy="true" />;
  }
  if (!initial) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <EmptyState
          icon={<HardDrive className="mx-auto size-10 text-muted" />}
          title="This match isn't on this device"
          description="Matches scored without an account are saved in the browser where they were created. It may have been deleted, or it was scored on another device."
          action={<ButtonLink href="/matches">Go to my matches</ButtonLink>}
        />
      </div>
    );
  }
  return <Loaded key={initial.id} match={initial} board={board} canUpload={canUpload} />;
}
