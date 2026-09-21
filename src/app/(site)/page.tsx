import { ArrowRight, MonitorPlay, Radio, Share2, Smartphone, Undo2, WifiOff } from "lucide-react";
import Link from "next/link";
import { MatchGrid } from "@/components/match/match-card";
import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/card";
import { LiveDot, SportTile } from "@/components/ui/misc";
import { listPublicMatches } from "@/lib/data/server";
import { SPORTS } from "@/lib/sports/registry";

export default async function HomePage() {
  const { items } = await listPublicMatches({ limit: 6 });
  const live = items.filter((m) => m.status === "live").slice(0, 6);

  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Hero */}
      <section className="grid grid-cols-1 items-center gap-10 pt-2 lg:grid-cols-[1.1fr_1fr] lg:pt-8">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-muted">
            <LiveDot /> Live scores, shared with a link
          </p>
          <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Keep score of <span className="text-primary">every game</span> you play.
          </h1>
          <p className="mt-5 max-w-xl text-base text-pretty text-muted sm:text-lg">
            Ball-by-ball cricket, football with a running clock, tennis tiebreaks, a chess clock, badminton, basketball and more.
            Score from your phone and everyone follows live.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/new" size="xl">
              Start a match <ArrowRight className="size-5" />
            </ButtonLink>
            <ButtonLink href="/live" size="xl" variant="outline">
              <Radio className="size-5" /> Watch live
            </ButtonLink>
          </div>
        </div>
        <HeroScoreboard />
      </section>

      {/* Sports */}
      <section>
        <SectionTitle>Pick a sport</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SPORTS.map((s) => (
            <Link
              key={s.id}
              href={`/new/${s.id}`}
              className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card transition-[border-color,transform] hover:border-primary/40 active:scale-[0.98] sm:p-4"
            >
              <SportTile emoji={s.emoji} accent={s.accent} />
              <div className="min-w-0">
                <p className="font-semibold">{s.name}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{s.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Live now */}
      {live.length ? (
        <section>
          <SectionTitle
            action={
              <Link href="/live" className="text-sm font-semibold text-primary">
                See all
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <LiveDot /> Live now
            </span>
          </SectionTitle>
          <MatchGrid matches={live} />
        </section>
      ) : null}

      {/* Features */}
      <section>
        <SectionTitle>Built for the sideline</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Smartphone, title: "One-thumb scoring", text: "Big buttons designed for phones, with the screen kept awake while you score." },
            { icon: Share2, title: "Live share link & QR", text: "Spectators follow every ball, goal and point in real time — no app, no sign-up." },
            { icon: MonitorPlay, title: "TV scoreboard mode", text: "Put a big, bold scoreboard on any screen at the venue with one tap." },
            { icon: Undo2, title: "Unlimited undo", text: "Every action is logged, so mistakes are one tap away from fixed." },
            { icon: WifiOff, title: "Patchy signal? Fine.", text: "Scores queue up offline and sync automatically when you're back." },
            { icon: Radio, title: "Proper rules", text: "Extras & maidens, deuce & tiebreaks, serve rotation, penalties & overtime." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface p-5 shadow-card">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Decorative sample scoreboard for the hero. */
function HeroScoreboard() {
  const balls = ["1", "4", "•", "W", "6", "2"];
  return (
    <div className="relative mx-auto w-full max-w-md pb-10" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-linear-to-br from-emerald-400/25 via-transparent to-sky-400/20 blur-2xl" />
      <div className="rotate-[-1.5deg] rounded-3xl border border-border bg-surface p-5 shadow-float">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-2 text-muted">🏏 T20 · Final</span>
          <span className="flex items-center gap-1.5 rounded-full bg-live/12 px-2 py-0.5 text-live">
            <LiveDot className="size-1.5" /> LIVE
          </span>
        </div>
        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-muted">Mumbai Strikers</p>
            <p className="font-mono text-5xl font-extrabold tracking-tight tabular">
              168<span className="text-muted">/4</span>
            </p>
          </div>
          <p className="pb-1.5 font-mono text-lg font-semibold text-muted tabular">18.4 ov</p>
        </div>
        <p className="mt-2 text-sm font-medium text-primary">Need 12 runs from 8 balls · RRR 9.00</p>
        <div className="mt-5 flex gap-2">
          {balls.map((b, i) => (
            <span
              key={i}
              className={
                "grid size-9 place-items-center rounded-full text-sm font-bold " +
                (b === "W" ? "bg-live text-white" : b === "4" || b === "6" ? "bg-primary text-primary-foreground" : "bg-surface-2")
              }
            >
              {b}
            </span>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
          <div>
            <p className="text-muted">Batting</p>
            <p className="font-semibold">R. Sharma* 72 (41)</p>
          </div>
          <div>
            <p className="text-muted">Bowling</p>
            <p className="font-semibold">J. Archer 3.4-0-31-2</p>
          </div>
        </div>
      </div>
      <div className="absolute right-4 -bottom-10 w-44 rotate-[3deg] rounded-2xl border border-border bg-surface p-3.5 shadow-float sm:-right-6">
        <p className="text-xs font-semibold text-muted">⚽ 67:12 · 2nd Half</p>
        <div className="mt-2 flex items-center justify-between font-mono text-2xl font-extrabold tabular">
          <span>2</span>
          <span className="text-base text-muted">–</span>
          <span>1</span>
        </div>
      </div>
    </div>
  );
}
