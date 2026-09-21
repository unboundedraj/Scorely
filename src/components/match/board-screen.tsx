"use client";

import { Maximize, Minimize, X } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { SPORT_VIEWS } from "@/components/sports";
import { LogoMark } from "@/components/layout/logo";
import { LiveDot } from "@/components/ui/misc";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { sportOrDefault } from "@/lib/sports/registry";
import type { MatchEvent, MatchRecord } from "@/lib/sports/types";
import { useMatchSync } from "@/lib/store/use-match-sync";
import { matchTitle } from "./match-card";
import { useBackend } from "./match-screen";
import { QrCode } from "./qr-code";

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

const noop = () => () => {};

/** Big, read-only scoreboard for TVs and projectors. */
export function BoardScreen({ initialMatch, initialEvents, mode }: { initialMatch: MatchRecord; initialEvents: MatchEvent[]; mode: "cloud" | "local" }) {
  const backend = useBackend(mode);
  const sync = useMatchSync({ backend, initialMatch, initialEvents, canEdit: false });
  const sport = sportOrDefault(sync.match.sport);
  const Board = SPORT_VIEWS[sport.engine].Board;
  const fullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => !!document.fullscreenElement,
    () => false,
  );
  const origin = useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
  useWakeLock(true);

  const back = mode === "cloud" ? `/match/${sync.match.id}` : `/local/${sync.match.id}`;
  const shareUrl = sync.match.code && mode === "cloud" && sync.match.is_public ? `${origin}/m/${sync.match.code}` : null;
  const live = sync.status === "live" && sync.events.length > 0;

  return (
    <div className="dark flex min-h-dvh flex-col bg-[#05070b] text-white [color-scheme:dark]">
      <header className="flex items-center gap-4 px-[3vw] py-[2vw]">
        <LogoMark className="size-[3.2vw] min-h-8 min-w-8" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[max(1rem,2.2vw)] font-bold">{matchTitle(sync.match)}</p>
          <p className="truncate text-[max(0.8rem,1.4vw)] text-white/50">
            {sport.emoji} {sport.name}
            {sync.match.venue ? ` · ${sync.match.venue}` : ""}
          </p>
        </div>
        {live ? (
          <span className="flex items-center gap-2 rounded-full bg-rose-500/15 px-[1.4vw] py-[0.5vw] text-[max(0.8rem,1.4vw)] font-bold text-rose-400">
            <LiveDot className="size-[1vw] min-h-2 min-w-2" /> LIVE
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})}
          className="grid size-10 place-items-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
          aria-label={fullscreen ? "Exit full screen" : "Full screen"}
        >
          {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
        </button>
        <Link href={back} aria-label="Close scoreboard" className="grid size-10 place-items-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white">
          <X className="size-5" />
        </Link>
      </header>
      <main className="grid flex-1 place-items-center px-[4vw] pb-[2vw]">
        <Board sync={sync} />
      </main>
      <footer className="flex items-end justify-between gap-4 px-[3vw] pb-[2.5vw]">
        <p className="max-w-[70%] text-[max(0.9rem,1.8vw)] font-semibold text-white/70">{sync.summary.status}</p>
        {shareUrl ? (
          <div className="flex items-center gap-3 text-right">
            <p className="hidden text-[max(0.7rem,1.1vw)] text-white/50 sm:block">
              Follow live
              <br />
              <span className="font-mono text-white/80">{shareUrl.replace(/^https?:\/\//, "")}</span>
            </p>
            <QrCode value={shareUrl} className="size-[9vw] min-h-20 min-w-20 rounded-lg" />
          </div>
        ) : null}
      </footer>
    </div>
  );
}
