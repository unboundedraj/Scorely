"use client";

import { ArrowLeft, CalendarClock, Globe, HardDrive, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/form";
import { SportTile, Spinner } from "@/components/ui/misc";
import type { SavedTeam } from "@/lib/data/mappers";
import { getSport } from "@/lib/sports/registry";
import type { Participant, SportId } from "@/lib/sports/types";
import { createMatch } from "@/lib/store/create-match";
import { shortName, uid } from "@/lib/utils";
import { defaultParticipants, parseRoster, ParticipantsEditor, type DraftParticipant } from "./participants-editor";
import { RulesEditor } from "./rules";

function Section({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-4 shadow-card sm:p-6">
      <h2 className="mb-4 flex items-center gap-2.5 text-base font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary-soft-foreground">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function MatchSetup({
  sportId,
  mode,
  savedTeams,
}: {
  sportId: SportId;
  /** "cloud" when signed in with Supabase configured; otherwise matches stay on this device. */
  mode: "cloud" | "local";
  savedTeams: SavedTeam[];
}) {
  const sport = getSport(sportId)!;
  const router = useRouter();
  const [drafts, setDrafts] = useState<DraftParticipant[]>(() => defaultParticipants(sport));
  const [config, setConfig] = useState<Record<string, unknown>>(() => sport.defaults());
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  const names: [string, string] = [
    drafts[0]?.name.trim() || drafts[0]?.name || "Side 1",
    drafts[1]?.name.trim() || drafts[1]?.name || "Side 2",
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const participants: Participant[] = drafts.map((d, i) => {
      const name = d.name.trim() || `${sport.participantLabel} ${i + 1}`;
      return {
        id: uid(8),
        name,
        short: (d.short.trim() || shortName(name)).slice(0, 4),
        color: d.color,
        players: sport.side === "team" ? parseRoster(d.rosterText).map((n) => ({ id: uid(8), name: n })) : [],
      };
    });
    const lowerNames = participants.map((p) => p.name.toLowerCase());
    if (new Set(lowerNames).size !== lowerNames.length) {
      toast.error(`Give each ${sport.participantLabel.toLowerCase()} a different name.`);
      return;
    }
    if (schedule && !scheduledAt) {
      toast.error("Pick a date and time, or turn off scheduling.");
      return;
    }
    setSaving(true);
    try {
      const url = await createMatch(
        {
          sport: sport.id,
          title: title.trim(),
          venue: venue.trim(),
          isPublic,
          participants,
          config,
          scheduledAt: schedule ? scheduledAt : null,
        },
        mode,
      );
      router.push(url);
    } catch (err) {
      toast.error(`Couldn't create the match: ${(err as Error).message}`);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/new" aria-label="Back to sports" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <SportTile emoji={sport.emoji} accent={sport.accent} />
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">New {sport.name.toLowerCase()} match</h1>
          <p className="truncate text-sm text-muted">{sport.tagline}</p>
        </div>
      </div>

      {mode === "local" ? (
        <p className="flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
          <HardDrive className="mt-0.5 size-4 shrink-0" />
          <span>
            This match will be saved <strong className="text-foreground">on this device</strong>.{" "}
            <Link href={`/login?next=/new/${sport.id}`} className="font-semibold text-primary">
              Sign in
            </Link>{" "}
            to share it live and keep it in the cloud.
          </span>
        </p>
      ) : null}

      <Section step={1} title={sport.maxParticipants > 2 ? "Players" : sport.side === "team" ? "Teams" : "Players"}>
        <ParticipantsEditor sport={sport} value={drafts} onChange={setDrafts} savedTeams={savedTeams} />
      </Section>

      <Section step={2} title="Rules">
        <RulesEditor engine={sport.engine} config={config} onChange={setConfig} names={names} />
      </Section>

      <Section step={3} title="Details">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title" hint="Optional — defaults to the names">
              <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={`${names[0]} vs ${names[1]}`} />
            </Field>
            <Field label="Venue" hint="Optional">
              <Input value={venue} maxLength={120} onChange={(e) => setVenue(e.target.value)} placeholder="Where are you playing?" />
            </Field>
          </div>
          {mode === "cloud" ? (
            <Switch
              checked={isPublic}
              onChange={setIsPublic}
              label={
                <span className="inline-flex items-center gap-1.5">
                  {isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />} {isPublic ? "Public" : "Private"}
                </span>
              }
              description={isPublic ? "Anyone with the link can follow live, and it appears in Live." : "Only you can see this match."}
            />
          ) : null}
          <Switch
            checked={schedule}
            onChange={setSchedule}
            label={
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" /> Schedule for later
              </span>
            }
            description="Create the fixture now and start scoring when it begins."
          />
          {schedule ? (
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} aria-label="Start time" />
          ) : null}
        </div>
      </Section>

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <Button type="submit" size="xl" block disabled={saving} className="shadow-float">
          {saving ? <Spinner /> : null}
          {schedule ? "Create fixture" : "Start match"}
        </Button>
      </div>
    </form>
  );
}
