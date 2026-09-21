"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { cn } from "@/lib/utils";

/** Re-fetches the server component tree on an interval and on demand. */
export function AutoRefresh({ intervalMs = 20_000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, router]);

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-2 hover:text-foreground"
      aria-label="Refresh"
    >
      <RefreshCw className={cn("size-3.5", pending && "animate-spin")} /> Auto-updating
    </button>
  );
}
