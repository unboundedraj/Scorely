import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { MatchGrid } from "@/components/match/match-card";
import { SetupNotice } from "@/components/setup-notice";
import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { EmptyState, LiveDot } from "@/components/ui/misc";
import { listPublicMatches } from "@/lib/data/server";
import { getSport, SPORTS } from "@/lib/sports/registry";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Live scores", description: "Public matches being scored right now on Scorely." };

export default async function LivePage({ searchParams }: PageProps<"/live">) {
  const sp = await searchParams;
  const sportParam = typeof sp.sport === "string" && getSport(sp.sport) ? sp.sport : undefined;
  const { items, backend } = await listPublicMatches({ sport: sportParam, limit: 90 });
  const live = items.filter((m) => m.status === "live");
  const upcoming = items.filter((m) => m.status === "scheduled");
  const finished = items.filter((m) => m.status === "completed").slice(0, 24);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight sm:text-3xl">
            <LiveDot className="size-2.5" /> Live
          </h1>
          <p className="mt-1 text-sm text-muted">Public matches from everyone on Scorely.</p>
        </div>
        {backend === "ready" ? <AutoRefresh /> : null}
      </div>

      <SetupNotice state={backend} />

      <nav className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Filter by sport">
        <FilterChip href="/live" active={!sportParam}>
          All sports
        </FilterChip>
        {SPORTS.map((s) => (
          <FilterChip key={s.id} href={`/live?sport=${s.id}`} active={sportParam === s.id}>
            {s.emoji} {s.name}
          </FilterChip>
        ))}
      </nav>

      {items.length === 0 ? (
        <EmptyState
          icon="📡"
          title="Nothing live right now"
          description="Public matches show up here while they're being scored. Start one and share the link!"
          action={<ButtonLink href="/new">Start a match</ButtonLink>}
        />
      ) : (
        <div className="space-y-10">
          {live.length ? (
            <section>
              <SectionTitle>Live now · {live.length}</SectionTitle>
              <MatchGrid matches={live} />
            </section>
          ) : null}
          {upcoming.length ? (
            <section>
              <SectionTitle>Upcoming</SectionTitle>
              <MatchGrid matches={upcoming} />
            </section>
          ) : null}
          {finished.length ? (
            <section>
              <SectionTitle>Recently finished</SectionTitle>
              <MatchGrid matches={finished} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors",
        active ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border bg-surface text-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
