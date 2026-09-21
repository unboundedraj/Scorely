"use client";

import { useEffect } from "react";

/** Keeps the screen awake while scoring (Screen Wake Lock API, where supported). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (disposed) void sentinel.release();
        else lock = sentinel;
      } catch {
        // Denied (battery saver, unsupported context…) — not critical.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
