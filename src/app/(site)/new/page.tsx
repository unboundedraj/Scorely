import type { Metadata } from "next";
import Link from "next/link";
import { SportTile } from "@/components/ui/misc";
import { SPORTS } from "@/lib/sports/registry";

export const metadata: Metadata = { title: "New match" };

export default function NewMatchPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">What are you playing?</h1>
      <p className="mt-1 text-muted">Pick a sport — each one has its own scoring rules built in.</p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SPORTS.map((s) => (
          <Link
            key={s.id}
            href={`/new/${s.id}`}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition-[border-color,transform] hover:border-primary/40 active:scale-[0.99]"
          >
            <SportTile emoji={s.emoji} accent={s.accent} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold">{s.name}</p>
              <p className="mt-0.5 text-sm text-muted">{s.tagline}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
