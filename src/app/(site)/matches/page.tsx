import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MatchBrowser } from "@/components/match/match-browser";
import { SetupNotice } from "@/components/setup-notice";
import { ButtonLink } from "@/components/ui/button";
import { getCurrentUser, listMyMatches, probeBackend } from "@/lib/data/server";

export const metadata: Metadata = { title: "My matches" };

export default async function MatchesPage() {
  const [user, backend] = await Promise.all([getCurrentUser(), probeBackend()]);
  const cloud = user && backend === "ready" ? await listMyMatches(user.id) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My matches</h1>
          <p className="mt-1 text-sm text-muted">
            {user ? `Signed in as ${user.displayName}` : "Matches on this device"}
          </p>
        </div>
        <ButtonLink href="/new" className="hidden sm:inline-flex">
          <Plus className="size-4" /> New match
        </ButtonLink>
      </div>

      <SetupNotice state={backend} />

      {!user && backend === "ready" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 text-sm shadow-card">
          <p className="text-muted">
            <span className="font-semibold text-foreground">Sign in to sync & share.</span> Your matches will be saved to your account and anyone can
            follow them live.
          </p>
          <div className="flex gap-2">
            <ButtonLink href="/login?next=/matches" variant="outline" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup" size="sm">
              Create account
            </ButtonLink>
          </div>
        </div>
      ) : null}

      <MatchBrowser cloud={cloud?.items ?? []} />

      {user ? (
        <p className="text-center text-xs text-muted">
          Tip: build <Link href="/teams" className="font-semibold text-primary">saved teams</Link> to set up matches faster.
        </p>
      ) : null}
    </div>
  );
}
