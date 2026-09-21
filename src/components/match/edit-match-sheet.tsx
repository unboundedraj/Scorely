"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ColorSwatches } from "@/components/ui/color-swatches";
import { Field, Input, Switch } from "@/components/ui/form";
import { Spinner, TeamMark } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import type { Participant } from "@/lib/sports/types";
import type { MatchSync } from "@/lib/store/use-match-sync";
import { shortName } from "@/lib/utils";

export function EditMatchSheet({ sync, onClose }: { sync: MatchSync; onClose: () => void }) {
  const { match } = sync;
  const [title, setTitle] = useState(match.title);
  const [venue, setVenue] = useState(match.venue);
  const [isPublic, setIsPublic] = useState(match.is_public);
  const [participants, setParticipants] = useState<Participant[]>(match.participants);
  const [openColor, setOpenColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (id: string, patch: Partial<Participant>) => setParticipants((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const save = async () => {
    setSaving(true);
    const cleaned = participants.map((p, i) => {
      const name = p.name.trim() || match.participants[i].name;
      return { ...p, name, short: (p.short.trim() || shortName(name)).slice(0, 4) };
    });
    const ok = await sync.updateMatch({
      title: title.trim(),
      venue: venue.trim(),
      participants: cleaned,
      ...(sync.backend.kind === "cloud" ? { is_public: isPublic } : {}),
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Edit match"
      footer={
        <Button size="lg" block onClick={save} disabled={saving}>
          {saving ? <Spinner /> : null} Save changes
        </Button>
      }
    >
      <div className="space-y-5">
        <Field label="Title">
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Venue">
          <Input value={venue} maxLength={120} onChange={(e) => setVenue(e.target.value)} placeholder="Optional" />
        </Field>
        {sync.backend.kind === "cloud" ? (
          <Switch checked={isPublic} onChange={setIsPublic} label="Public" description="Anyone with the link can follow live." />
        ) : null}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Names & colours</p>
          {participants.map((p) => (
            <div key={p.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpenColor(openColor === p.id ? null : p.id)} aria-label={`Change colour for ${p.name}`}>
                  <TeamMark name={p.name} short={p.short} color={p.color} size="md" />
                </button>
                <Input value={p.name} maxLength={40} onChange={(e) => update(p.id, { name: e.target.value })} aria-label="Name" />
                {p.players.length || match.sport === "cricket" || match.participants.length === 2 ? (
                  <Input
                    value={p.short}
                    maxLength={4}
                    onChange={(e) => update(p.id, { short: e.target.value.toUpperCase() })}
                    className="w-20 text-center"
                    aria-label="Short name"
                  />
                ) : null}
              </div>
              {openColor === p.id ? <ColorSwatches value={p.color} onChange={(color) => update(p.id, { color })} /> : null}
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
