"use client";

import { useSyncExternalStore } from "react";

// Shared tickers so every clock on the page re-renders from one interval.

interface Ticker {
  now: number;
  subscribe(listener: () => void): () => void;
}

const tickers = new Map<number, Ticker>();

function getTicker(intervalMs: number): Ticker {
  let ticker = tickers.get(intervalMs);
  if (ticker) return ticker;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  const t: Ticker = {
    now: typeof window === "undefined" ? 0 : Date.now(),
    subscribe(listener) {
      listeners.add(listener);
      t.now = Date.now();
      timer ??= setInterval(() => {
        t.now = Date.now();
        listeners.forEach((l) => l());
      }, intervalMs);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
  ticker = t;
  tickers.set(intervalMs, ticker);
  return ticker;
}

const noopSubscribe = () => () => {};

/** Current time, refreshed every `intervalMs` while `active`. Returns 0 during SSR. */
export function useNow(intervalMs = 1000, active = true): number {
  const ticker = getTicker(intervalMs);
  return useSyncExternalStore(
    active ? ticker.subscribe : noopSubscribe,
    () => ticker.now,
    () => 0,
  );
}
