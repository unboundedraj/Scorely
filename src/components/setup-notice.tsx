import { Database, HardDrive } from "lucide-react";
import type { BackendState } from "@/lib/data/server";
import { cn } from "@/lib/utils";

/** Explains why cloud features are unavailable (env vars missing / migration not run). */
export function SetupNotice({ state, className }: { state: BackendState; className?: string }) {
  if (state === "ready") return null;
  const unconfigured = state === "unconfigured";
  return (
    <div className={cn("flex gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm", className)}>
      {unconfigured ? <HardDrive className="mt-0.5 size-5 shrink-0 text-warning" /> : <Database className="mt-0.5 size-5 shrink-0 text-warning" />}
      <div className="min-w-0 space-y-1">
        <p className="font-semibold text-foreground">
          {unconfigured ? "Cloud sync isn't connected yet" : "Database tables not found"}
        </p>
        <p className="text-muted">
          {unconfigured ? (
            <>
              Matches are being saved <strong className="text-foreground">on this device</strong>. Add{" "}
              <code className="rounded bg-surface px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="rounded bg-surface px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
              <code className="rounded bg-surface px-1 py-0.5 text-xs">.env.local</code> to enable accounts, live sharing and sync.
            </>
          ) : (
            <>
              Supabase is connected but the Scorely tables are missing. Run{" "}
              <code className="rounded bg-surface px-1 py-0.5 text-xs">supabase/migrations/20260921120000_scorely_init.sql</code> in the
              Supabase SQL editor (or <code className="rounded bg-surface px-1 py-0.5 text-xs">npm run db:push</code>).
            </>
          )}
        </p>
      </div>
    </div>
  );
}
