"use client";

import { useNow } from "@/hooks/use-now";
import { formatDateTime, timeAgo } from "@/lib/utils";

/** Relative time that renders after hydration (server output would go stale). */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const now = useNow(30_000);
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={className}>
      {now ? timeAgo(iso, now) : ""}
    </time>
  );
}
