"use client";

import { Check, Copy, ExternalLink, Lock, Share2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import type { MatchSync } from "@/lib/store/use-match-sync";
import { QrCode } from "./qr-code";

const noop = () => () => {};

function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "",
  );
}

export function ShareSheet({ sync, title, onClose }: { sync: MatchSync; title: string; onClose: () => void }) {
  const origin = useOrigin();
  const { match } = sync;
  const url = `${origin}${match.code ? `/m/${match.code}` : `/match/${match.id}`}`;
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <Sheet open onClose={onClose} title="Share live score" description="Anyone with the link can follow along in real time.">
      <div className="space-y-5">
        {!match.is_public ? (
          <div className="space-y-3 rounded-xl border border-warning/30 bg-warning-soft p-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Lock className="size-4" /> This match is private
            </p>
            {sync.canEdit ? (
              <Switch checked={match.is_public} onChange={(v) => void sync.updateMatch({ is_public: v })} label="Make it public" description="Spectators can view, only you can score." />
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-3">
          {origin ? <QrCode value={url} className="size-48 rounded-2xl shadow-card" label="QR code to open the live score" /> : <div className="size-48" />}
          {match.code ? (
            <p className="text-sm text-muted">
              Match code <span className="font-mono font-bold tracking-widest text-foreground">{match.code}</span>
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 p-1.5 pl-3">
          <span className="min-w-0 flex-1 truncate font-mono text-sm">{url}</span>
          <Button size="sm" variant={copied ? "soft" : "primary"} onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {canNativeShare ? (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                navigator.share({ title, text: `Follow ${title} live on Scorely`, url }).catch(() => {});
              }}
            >
              <Share2 className="size-4" /> Share…
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="lg"
            className={canNativeShare ? "" : "col-span-2"}
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Follow ${title} live: ${url}`)}`, "_blank", "noopener")}
          >
            <ExternalLink className="size-4" /> WhatsApp
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
