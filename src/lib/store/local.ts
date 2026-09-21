"use client";

import type { MatchEvent, MatchRecord } from "@/lib/sports/types";
import { SyncError, type MatchBackend, type MatchPatch } from "./backend";

// On-device storage for matches scored without an account (or before Supabase
// is configured). Exposed as a tiny external store for useSyncExternalStore.

const PREFIX = "scorely:local:";
const INDEX_KEY = `${PREFIX}matches`;
const eventsKey = (id: string) => `${PREFIX}events:${id}`;

const EMPTY: MatchRecord[] = [];
let cache: MatchRecord[] | null = null;
const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new SyncError("unknown", "Couldn't save on this device — storage may be full or blocked.");
  }
}

function emit() {
  cache = null;
  listeners.forEach((l) => l());
}

function index(): MatchRecord[] {
  if (typeof window === "undefined") return EMPTY;
  cache ??= read<MatchRecord[]>(INDEX_KEY, []);
  return cache;
}

function saveIndex(list: MatchRecord[]) {
  write(INDEX_KEY, list);
  emit();
}

export const localMatchStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith(PREFIX)) emit();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  getSnapshot: index,
  getServerSnapshot: () => EMPTY,

  get(id: string): MatchRecord | null {
    return index().find((m) => m.id === id) ?? null;
  },

  events(id: string): MatchEvent[] {
    if (typeof window === "undefined") return [];
    return read<MatchEvent[]>(eventsKey(id), []);
  },

  create(match: MatchRecord, events: MatchEvent[] = []) {
    write(eventsKey(match.id), events);
    saveIndex([match, ...index().filter((m) => m.id !== match.id)]);
  },

  update(id: string, patch: Partial<MatchRecord>) {
    const now = new Date().toISOString();
    saveIndex(index().map((m) => (m.id === id ? { ...m, ...patch, updated_at: now } : m)));
  },

  remove(id: string) {
    try {
      window.localStorage.removeItem(eventsKey(id));
    } catch {
      // ignore
    }
    saveIndex(index().filter((m) => m.id !== id));
  },

  setEvents(id: string, events: MatchEvent[]) {
    write(eventsKey(id), events);
  },
};

export function isLocalId(id: string): boolean {
  return id.startsWith("local-");
}

export function createLocalBackend(): MatchBackend {
  return {
    kind: "local",

    async append(matchId, event, summary, status) {
      const events = localMatchStore.events(matchId);
      const last = events.at(-1)?.seq ?? 0;
      if (event.seq !== last + 1) throw new SyncError("conflict", "Sequence conflict");
      const saved: MatchEvent = { ...event, id: event.seq, created_at: new Date().toISOString() };
      localMatchStore.setEvents(matchId, [...events, saved]);
      const match = localMatchStore.get(matchId);
      localMatchStore.update(matchId, {
        summary,
        status,
        last_seq: saved.seq,
        last_event: saved,
        started_at: match?.started_at ?? saved.created_at!,
        completed_at: status === "completed" ? (match?.completed_at ?? saved.created_at!) : null,
      });
      return saved;
    },

    async undo(matchId, seq, summary, status) {
      const events = localMatchStore.events(matchId);
      if (events.at(-1)?.seq !== seq) throw new SyncError("conflict", "Sequence conflict");
      const next = events.slice(0, -1);
      localMatchStore.setEvents(matchId, next);
      localMatchStore.update(matchId, {
        summary,
        status,
        last_seq: next.at(-1)?.seq ?? 0,
        last_event: next.at(-1) ?? null,
        completed_at: status === "completed" ? localMatchStore.get(matchId)?.completed_at ?? null : null,
      });
    },

    async fetchEvents(matchId) {
      return localMatchStore.events(matchId);
    },

    async fetchMatch(matchId) {
      return localMatchStore.get(matchId);
    },

    async updateMatch(matchId, patch: MatchPatch) {
      localMatchStore.update(matchId, patch);
    },

    async deleteMatch(matchId) {
      localMatchStore.remove(matchId);
    },

    subscribe(matchId, onRow, onStatus) {
      onStatus(true);
      // Keeps several tabs on the same device in sync.
      const onStorage = (e: StorageEvent) => {
        if (e.key !== INDEX_KEY) return;
        cache = null;
        const row = localMatchStore.get(matchId);
        if (row) onRow(row);
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
  };
}
