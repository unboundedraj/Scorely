"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getEngine, replay } from "@/lib/sports/engines";
import { resolveConfig, sportOrDefault } from "@/lib/sports/registry";
import type { EventPayload, MatchEvent, MatchRecord, MatchStatus, MatchSummary } from "@/lib/sports/types";
import { deepEqual, SyncError, type MatchBackend, type MatchPatch } from "./backend";

type Op =
  | { kind: "append"; event: MatchEvent; summary: MatchSummary; status: MatchStatus }
  | { kind: "undo"; seq: number; summary: MatchSummary; status: MatchStatus };

export interface MatchSync {
  match: MatchRecord;
  events: MatchEvent[];
  config: Record<string, unknown>;
  state: unknown;
  summary: MatchSummary;
  status: MatchStatus;
  canEdit: boolean;
  dispatch: (type: string, payload?: EventPayload) => void;
  undo: () => void;
  updateMatch: (patch: MatchPatch) => Promise<boolean>;
  refresh: () => Promise<void>;
  /** Writes waiting to reach the server. */
  pending: number;
  offline: boolean;
  /** Realtime connection (spectators). */
  connected: boolean;
  backend: MatchBackend;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function effectiveStatus(match: Pick<MatchRecord, "status">, summary: MatchSummary, eventCount: number): MatchStatus {
  if (match.status === "abandoned") return "abandoned";
  if (summary.completed) return "completed";
  if (eventCount === 0 && match.status === "scheduled") return "scheduled";
  return "live";
}

function computeSummary(match: MatchRecord, events: readonly MatchEvent[]): MatchSummary {
  const engine = getEngine(sportOrDefault(match.sport).engine);
  const ctx = { participants: match.participants, config: resolveConfig(match.sport, match.config) };
  return engine.summarize(replay(engine, ctx, events), ctx);
}

function vibrate() {
  try {
    navigator.vibrate?.(8);
  } catch {
    // unsupported
  }
}

export function useMatchSync({
  backend,
  initialMatch,
  initialEvents,
  canEdit,
}: {
  backend: MatchBackend;
  initialMatch: MatchRecord;
  initialEvents: MatchEvent[];
  canEdit: boolean;
}): MatchSync {
  const [match, setMatch] = useState(initialMatch);
  const [events, setEvents] = useState(initialEvents);
  const [pending, setPending] = useState(0);
  const [offline, setOffline] = useState(false);
  const [connected, setConnected] = useState(false);

  // Refs mirror state for use inside async callbacks; only written from callbacks.
  const matchRef = useRef(initialMatch);
  const eventsRef = useRef(initialEvents);
  const queueRef = useRef<Op[]>([]);
  const inFlightRef = useRef<Op | null>(null);
  const processingRef = useRef(false);
  const aliveRef = useRef(true);
  /**
   * Realtime echoes still expected for our own event writes (each RPC updates the
   * match row exactly once). Lets the scorer ignore stale echoes that would
   * otherwise look like remote undos. May dip below zero when an echo beats the
   * RPC response; the matching increment rebalances it.
   */
  const echoesRef = useRef(0);
  const matchId = initialMatch.id;

  const commitMatch = useCallback((next: MatchRecord) => {
    matchRef.current = next;
    setMatch(next);
  }, []);

  const commitEvents = useCallback((next: MatchEvent[]) => {
    eventsRef.current = next;
    setEvents(next);
  }, []);

  // ----- derived scoreboard -------------------------------------------------
  const engine = getEngine(sportOrDefault(match.sport).engine);
  const config = useMemo(() => resolveConfig(match.sport, match.config), [match.sport, match.config]);
  const ctx = useMemo(() => ({ participants: match.participants, config }), [match.participants, config]);
  const state = useMemo(() => replay(engine, ctx, events), [engine, ctx, events]);
  const summary = useMemo(() => engine.summarize(state, ctx), [engine, state, ctx]);
  const status = effectiveStatus(match, summary, events.length);

  // ----- server reconciliation ----------------------------------------------
  const refetch = useCallback(async () => {
    const [m, evs] = await Promise.all([backend.fetchMatch(matchId), backend.fetchEvents(matchId)]);
    if (!aliveRef.current) return;
    if (m) commitMatch(m);
    commitEvents(evs);
    echoesRef.current = 0;
  }, [backend, matchId, commitMatch, commitEvents]);

  const confirm = useCallback(
    (local: MatchEvent, saved: MatchEvent) => {
      const current = eventsRef.current;
      const idx = current.indexOf(local);
      if (idx === -1) return;
      const next = current.slice();
      next[idx] = { ...local, id: saved.id, created_at: saved.created_at ?? local.created_at };
      commitEvents(next);
    },
    [commitEvents],
  );

  /** After a sequence conflict, check whether the server already has our change. */
  const reconcile = useCallback(
    async (op: Op): Promise<boolean> => {
      try {
        const server = await backend.fetchEvents(matchId);
        if (op.kind === "append") {
          const found = server.find((e) => e.seq === op.event.seq);
          if (found && found.type === op.event.type && deepEqual(found.payload, op.event.payload)) {
            confirm(op.event, found);
            return true;
          }
          return false;
        }
        return (server.at(-1)?.seq ?? 0) === op.seq - 1;
      } catch {
        return false;
      }
    },
    [backend, matchId, confirm],
  );

  const process = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    let delay = 1000;
    try {
      while (queueRef.current.length && aliveRef.current) {
        const op = queueRef.current[0];
        inFlightRef.current = op;
        try {
          if (op.kind === "append") {
            const saved = await backend.append(matchId, op.event, op.summary, op.status);
            confirm(op.event, saved);
          } else {
            await backend.undo(matchId, op.seq, op.summary, op.status);
          }
          inFlightRef.current = null;
          queueRef.current.shift();
          echoesRef.current += 1;
          delay = 1000;
          setOffline(false);
        } catch (err) {
          inFlightRef.current = null;
          const kind = err instanceof SyncError ? err.kind : "unknown";
          if (kind === "network") {
            setOffline(true);
            await sleep(delay);
            delay = Math.min(delay * 2, 15_000);
            continue;
          }
          if (kind === "conflict" && (await reconcile(op))) {
            // The earlier attempt did commit, so its echo is on the way.
            queueRef.current.shift();
            echoesRef.current += 1;
            continue;
          }
          queueRef.current = [];
          setOffline(false);
          toast.error(
            kind === "forbidden"
              ? "You can no longer score this match."
              : kind === "conflict"
                ? "This match was updated on another device — loaded the latest score."
                : `Couldn't save: ${(err as Error).message}`,
          );
          await refetch().catch(() => {});
        } finally {
          setPending(queueRef.current.length);
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [backend, matchId, confirm, reconcile, refetch]);

  const enqueue = useCallback(
    (op: Op) => {
      queueRef.current.push(op);
      setPending(queueRef.current.length);
      void process();
    },
    [process],
  );

  // ----- scorer actions -------------------------------------------------------
  const dispatch = useCallback(
    (type: string, payload: EventPayload = {}) => {
      if (!canEdit) return;
      const current = eventsRef.current;
      const event: MatchEvent = {
        seq: (current.at(-1)?.seq ?? 0) + 1,
        type,
        payload,
        created_at: new Date().toISOString(),
      };
      const next = [...current, event];
      const nextSummary = computeSummary(matchRef.current, next);
      commitEvents(next);
      vibrate();
      enqueue({ kind: "append", event, summary: nextSummary, status: effectiveStatus(matchRef.current, nextSummary, next.length) });
    },
    [canEdit, commitEvents, enqueue],
  );

  const undo = useCallback(() => {
    if (!canEdit) return;
    const current = eventsRef.current;
    const last = current.at(-1);
    if (!last) return;
    const next = current.slice(0, -1);
    const nextSummary = computeSummary(matchRef.current, next);
    commitEvents(next);
    vibrate();
    const queue = queueRef.current;
    const idx = queue.findIndex((op) => op.kind === "append" && op.event === last);
    if (idx !== -1 && queue[idx] !== inFlightRef.current) {
      // Never sent — just drop it.
      queue.splice(idx, 1);
      setPending(queue.length);
      return;
    }
    enqueue({ kind: "undo", seq: last.seq, summary: nextSummary, status: effectiveStatus(matchRef.current, nextSummary, next.length) });
  }, [canEdit, commitEvents, enqueue]);

  const updateMatch = useCallback(
    async (patch: MatchPatch): Promise<boolean> => {
      const before = matchRef.current;
      const next = { ...before, ...patch };
      // Names feed into result text, so keep the cached summary in step.
      const withSummary: MatchPatch = { ...patch, summary: computeSummary(next, eventsRef.current) };
      commitMatch({ ...next, summary: withSummary.summary ?? null });
      try {
        await backend.updateMatch(matchId, withSummary);
        return true;
      } catch (err) {
        commitMatch(before);
        toast.error(`Couldn't update match: ${(err as Error).message}`);
        return false;
      }
    },
    [backend, matchId, commitMatch],
  );

  // ----- realtime -------------------------------------------------------------
  const onRemote = useCallback(
    (row: MatchRecord) => {
      if (canEdit && backend.kind === "cloud") {
        // Our own writes echo back; the local log is already ahead of them.
        if (echoesRef.current > 0 || processingRef.current || queueRef.current.length) {
          echoesRef.current -= 1;
          return;
        }
      }
      const current = matchRef.current;
      commitMatch({
        ...current,
        title: row.title,
        venue: row.venue,
        is_public: row.is_public,
        participants: row.participants,
        config: row.config,
        status: row.status,
        summary: row.summary,
        last_seq: row.last_seq,
        last_event: row.last_event,
        updated_at: row.updated_at,
      });
      if (queueRef.current.length || processingRef.current) return;
      const local = eventsRef.current;
      const last = local.at(-1);
      const localSeq = last?.seq ?? 0;
      const remote = row.last_event;
      if (row.last_seq === localSeq && (localSeq === 0 || remote?.id === last?.id)) return;
      if (remote && row.last_seq === localSeq + 1 && remote.seq === row.last_seq && (localSeq === 0 || last?.id !== undefined)) {
        commitEvents([...local, { ...remote, payload: remote.payload ?? {} }]);
        return;
      }
      if (row.last_seq < localSeq && (row.last_seq === 0 || local[row.last_seq - 1]?.id === remote?.id)) {
        commitEvents(local.slice(0, row.last_seq));
        return;
      }
      void refetch().catch(() => {});
    },
    [canEdit, backend, commitMatch, commitEvents, refetch],
  );

  const refresh = useCallback(async () => {
    if (queueRef.current.length || processingRef.current) return;
    await refetch().catch(() => {});
  }, [refetch]);

  useEffect(() => {
    aliveRef.current = true;
    let wasConnected = false;
    const unsubscribe = backend.subscribe(matchId, onRemote, (isConnected) => {
      setConnected(isConnected);
      // Catch up on anything missed while disconnected.
      if (isConnected && wasConnected === false && backend.kind === "cloud") void refresh();
      wasConnected = isConnected;
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      aliveRef.current = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [backend, matchId, onRemote, refresh]);

  // Warn before closing the tab with unsaved scoring.
  useEffect(() => {
    if (pending === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pending]);

  return {
    match,
    events,
    config,
    state,
    summary,
    status,
    canEdit,
    dispatch,
    undo,
    updateMatch,
    refresh,
    pending,
    offline,
    connected,
    backend,
  };
}
