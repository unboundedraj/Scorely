"use client";

import {
  ArrowLeft,
  Check,
  CloudUpload,
  Copy,
  HardDrive,
  MonitorPlay,
  MoreVertical,
  Pencil,
  PlayCircle,
  Share2,
  Trash2,
  WifiOff,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SPORT_VIEWS } from "@/components/sports";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { LiveDot, SportTile, Spinner, StatusBadge } from "@/components/ui/misc";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { sportOrDefault } from "@/lib/sports/registry";
import type { MatchEvent, MatchRecord } from "@/lib/sports/types";
import type { MatchBackend } from "@/lib/store/backend";
import { createCloudBackend } from "@/lib/store/cloud";
import { createRematch, uploadLocalMatch } from "@/lib/store/create-match";
import { createLocalBackend, localMatchStore } from "@/lib/store/local";
import { useMatchSync, type MatchSync } from "@/lib/store/use-match-sync";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { cn, formatDateTime } from "@/lib/utils";
import { EditMatchSheet } from "./edit-match-sheet";
import { matchTitle } from "./match-card";
import { ShareSheet } from "./share-sheet";
import { TimeAgo } from "./time-ago";

export interface MatchScreenProps {
  initialMatch: MatchRecord;
  initialEvents: MatchEvent[];
  mode: "cloud" | "local";
  canEdit: boolean;
  ownerName?: string | null;
  /** Local match + signed in with a working backend → offer "Save to account". */
  canUpload?: boolean;
}

export function useBackend(mode: "cloud" | "local"): MatchBackend {
  const [backend] = useState<MatchBackend>(() => {
    const supabase = mode === "cloud" ? getBrowserSupabase() : null;
    return supabase ? createCloudBackend(supabase) : createLocalBackend();
  });
  return backend;
}

function SyncIndicator({ sync }: { sync: MatchSync }) {
  if (sync.backend.kind === "local") {
    return (
      <span className="hidden items-center gap-1.5 text-xs font-medium text-muted sm:flex" title="Saved on this device">
        <HardDrive className="size-3.5" /> On device
      </span>
    );
  }
  if (sync.canEdit) {
    if (sync.offline)
      return (
        <span className="flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-1 text-xs font-semibold text-warning" role="status">
          <WifiOff className="size-3.5" /> Offline{sync.pending ? ` · ${sync.pending}` : ""}
        </span>
      );
    if (sync.pending)
      return (
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted" role="status">
          <Spinner className="size-3" /> <span className="hidden sm:inline">Saving</span>
        </span>
      );
    return (
      <span className="hidden items-center gap-1 text-xs font-medium text-muted sm:flex" role="status">
        <Check className="size-3.5 text-primary" /> Saved
      </span>
    );
  }
  return sync.connected ? (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-live" role="status">
      <LiveDot className="size-1.5" /> <span className="hidden sm:inline">Following live</span>
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-xs text-muted" role="status">
      <Spinner className="size-3" /> <span className="hidden sm:inline">Connecting</span>
    </span>
  );
}

export function MatchScreen({ initialMatch, initialEvents, mode, canEdit, ownerName, canUpload }: MatchScreenProps) {
  const backend = useBackend(mode);
  const sync = useMatchSync({ backend, initialMatch, initialEvents, canEdit });
  const router = useRouter();
  const { match, status } = sync;
  const sport = sportOrDefault(match.sport);
  const View = SPORT_VIEWS[sport.engine].Scorer;
  const title = matchTitle(match);
  const base = backend.kind === "cloud" ? `/match/${match.id}` : `/local/${match.id}`;
  const [sheet, setSheet] = useState<null | "share" | "edit">(null);
  const [busy, setBusy] = useState(false);

  useWakeLock(canEdit && status !== "completed" && status !== "abandoned");

  // Ctrl/⌘+Z undoes the last action while scoring.
  const { undo } = sync;
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, undo]);

  const rematch = async () => {
    setBusy(true);
    try {
      router.push(await createRematch(match, backend.kind));
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  const upload = async () => {
    setBusy(true);
    try {
      const url = await uploadLocalMatch(match, sync.events);
      localMatchStore.remove(match.id);
      toast.success("Saved to your account — you can share it live now.");
      router.replace(url);
    } catch (err) {
      toast.error(`Upload failed: ${(err as Error).message}`);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this match permanently?")) return;
    try {
      await backend.deleteMatch(match.id);
      toast.success("Match deleted");
      router.replace("/matches");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const toggleAbandon = async () => {
    if (status === "abandoned") {
      await sync.updateMatch({ status: sync.summary.completed ? "completed" : "live", completed_at: null });
    } else if (window.confirm("Mark this match as abandoned? You can resume it later.")) {
      await sync.updateMatch({ status: "abandoned", completed_at: new Date().toISOString() });
    }
  };

  const shareable = backend.kind === "cloud";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-2 sm:h-16 sm:gap-3 sm:px-6">
          <Link
            href={canEdit ? "/matches" : "/live"}
            aria-label="Back"
            className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <SportTile emoji={sport.emoji} accent={sport.accent} size="sm" className="hidden min-[380px]:inline-grid" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
            <p className="truncate text-xs text-muted">
              {sport.name}
              {match.venue ? ` · ${match.venue}` : ""}
            </p>
          </div>
          <SyncIndicator sync={sync} />
          <StatusBadge status={status} hasStarted={sync.events.length > 0} />
          {shareable ? (
            <Button variant="ghost" size="icon" onClick={() => setSheet("share")} aria-label="Share">
              <Share2 className="size-5" />
            </Button>
          ) : null}
          <Menu
            label="Match options"
            triggerClassName="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground"
            trigger={<MoreVertical className="size-5" />}
            items={[
              { label: "TV scoreboard", icon: <MonitorPlay className="size-4" />, href: `${base}/board` },
              { label: "Share live link", icon: <Share2 className="size-4" />, onSelect: () => setSheet("share"), hidden: !shareable },
              { label: "Edit details", icon: <Pencil className="size-4" />, onSelect: () => setSheet("edit"), hidden: !canEdit },
              { label: "Rematch", icon: <Copy className="size-4" />, onSelect: rematch, hidden: !canEdit, disabled: busy },
              { label: "Save to my account", icon: <CloudUpload className="size-4" />, onSelect: upload, hidden: !canUpload, disabled: busy },
              {
                label: status === "abandoned" ? "Resume match" : "Mark abandoned",
                icon: status === "abandoned" ? <PlayCircle className="size-4" /> : <XCircle className="size-4" />,
                onSelect: toggleAbandon,
                hidden: !canEdit || (status === "completed" && sync.summary.completed),
              },
              { label: "Delete match", icon: <Trash2 className="size-4" />, onSelect: remove, danger: true, hidden: !canEdit },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pt-4 pb-12 sm:px-6 sm:pt-6">
        {status === "scheduled" ? (
          <div className="mb-4 rounded-2xl bg-warning-soft px-4 py-3 text-sm">
            <span className="font-semibold">Scheduled{match.scheduled_at ? ` for ${formatDateTime(match.scheduled_at)}` : ""}.</span>{" "}
            <span className="text-muted">{canEdit ? "Scoring begins with your first action." : "Check back when it starts."}</span>
          </div>
        ) : null}
        {status === "abandoned" ? (
          <div className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
            This match was abandoned{canEdit ? " — resume it from the menu to keep scoring." : "."}
          </div>
        ) : null}
        {canUpload ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary-soft px-4 py-3 text-sm">
            <span className="text-primary-soft-foreground">This match is only on this device. Save it to your account to share it live.</span>
            <Button size="sm" onClick={upload} disabled={busy}>
              <CloudUpload className="size-4" /> Save to account
            </Button>
          </div>
        ) : null}

        <View sync={sync} />

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
          {ownerName ? <span>Scored by {ownerName}</span> : null}
          {match.code && shareable ? (
            <span>
              Code <span className="font-mono font-semibold tracking-wider text-foreground">{match.code}</span>
            </span>
          ) : null}
          <span>
            Updated <TimeAgo iso={match.updated_at} />
          </span>
          {canEdit ? <span className="hidden sm:inline">Tip: Ctrl/⌘+Z to undo</span> : null}
        </footer>
      </main>

      {sheet === "share" ? <ShareSheet sync={sync} title={title} onClose={() => setSheet(null)} /> : null}
      {sheet === "edit" ? <EditMatchSheet sync={sync} onClose={() => setSheet(null)} /> : null}
      {busy ? (
        <div className={cn("fixed inset-0 z-50 grid place-items-center bg-background/60 backdrop-blur-sm")}>
          <Spinner className="size-8 text-primary" />
        </div>
      ) : null}
    </div>
  );
}
