"use client";

import { ChevronDown, Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { ColorSwatches } from "@/components/ui/color-swatches";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { TeamMark } from "@/components/ui/misc";
import type { SavedTeam } from "@/lib/data/mappers";
import { TEAM_COLORS, type SportDef } from "@/lib/sports/registry";
import { cn, shortName, uid } from "@/lib/utils";

export interface DraftParticipant {
  key: string;
  name: string;
  short: string;
  color: string;
  rosterText: string;
}

export function defaultParticipants(sport: SportDef): DraftParticipant[] {
  // Deterministic keys: this runs during SSR too, and random ids would not hydrate.
  return Array.from({ length: sport.minParticipants }, (_, i) => newDraft(sport, i, `initial-${i}`));
}

export function newDraft(sport: SportDef, i: number, key = uid(6)): DraftParticipant {
  const label = sport.side === "team" ? `Team ${String.fromCharCode(65 + i)}` : `Player ${i + 1}`;
  return { key, name: label, short: "", color: TEAM_COLORS[i % TEAM_COLORS.length], rosterText: "" };
}

export function parseRoster(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)-]\s*/, "").trim())
    .filter((l) => {
      const k = l.toLowerCase();
      if (!l || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 40)
    .map((l) => l.slice(0, 60));
}

export function ParticipantsEditor({
  sport,
  value,
  onChange,
  savedTeams,
}: {
  sport: SportDef;
  value: DraftParticipant[];
  onChange: (value: DraftParticipant[]) => void;
  savedTeams: SavedTeam[];
}) {
  const isTeam = sport.side === "team";
  const update = (i: number, patch: Partial<DraftParticipant>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const canAdd = value.length < sport.maxParticipants;
  const canRemove = value.length > sport.minParticipants;
  const many = sport.maxParticipants > 2;

  return (
    <div className="space-y-3">
      <div className={cn("grid gap-3", !many && "md:grid-cols-2")}>
        {value.map((p, i) =>
          many ? (
            <CompactRow
              key={p.key}
              index={i}
              value={p}
              onChange={(patch) => update(i, patch)}
              onRemove={canRemove ? () => onChange(value.filter((_, j) => j !== i)) : undefined}
            />
          ) : (
            <ParticipantCard
              key={p.key}
              index={i}
              isTeam={isTeam}
              label={sport.participantLabel}
              value={p}
              onChange={(patch) => update(i, patch)}
              savedTeams={isTeam ? savedTeams : []}
            />
          ),
        )}
      </div>
      {many && canAdd ? (
        <button
          type="button"
          onClick={() => onChange([...value, newDraft(sport, value.length)])}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-muted hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="size-4" /> Add player
        </button>
      ) : null}
    </div>
  );
}

function CompactRow({
  index,
  value,
  onChange,
  onRemove,
}: {
  index: number;
  value: DraftParticipant;
  onChange: (patch: Partial<DraftParticipant>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Change colour for ${value.name}`}
        onClick={() => {
          const i = TEAM_COLORS.indexOf(value.color);
          onChange({ color: TEAM_COLORS[(i + 1) % TEAM_COLORS.length] });
        }}
      >
        <TeamMark name={value.name || `P${index + 1}`} color={value.color} size="md" />
      </button>
      <Input
        aria-label={`Player ${index + 1} name`}
        value={value.name}
        maxLength={40}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder={`Player ${index + 1}`}
      />
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${value.name}`}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function ParticipantCard({
  index,
  isTeam,
  label,
  value,
  onChange,
  savedTeams,
}: {
  index: number;
  isTeam: boolean;
  label: string;
  value: DraftParticipant;
  onChange: (patch: Partial<DraftParticipant>) => void;
  savedTeams: SavedTeam[];
}) {
  const [open, setOpen] = useState(false);
  const roster = parseRoster(value.rosterText);

  return (
    <div className="rounded-2xl border border-border bg-surface-2/40 p-3.5">
      <div className="flex items-center gap-3">
        <TeamMark name={value.name || label} short={value.short || shortName(value.name)} color={value.color} size="lg" />
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold tracking-wide text-muted uppercase" htmlFor={`p-${value.key}`}>
            {label} {index + 1}
          </label>
          <Input
            id={`p-${value.key}`}
            value={value.name}
            maxLength={40}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={`${label} name`}
            className="mt-1"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1 text-sm font-medium text-muted hover:text-foreground"
      >
        <span className="flex items-center gap-2">
          {isTeam ? (
            <>
              <Users className="size-4" /> Colour, short name & players
              {roster.length ? <span className="rounded-full bg-primary-soft px-2 text-xs text-primary-soft-foreground">{roster.length}</span> : null}
            </>
          ) : (
            "Colour"
          )}
        </span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="mt-2 space-y-4 border-t border-border pt-3">
          {savedTeams.length ? (
            <Field label="Load a saved team">
              <Select
                defaultValue=""
                onChange={(e) => {
                  const team = savedTeams.find((t) => t.id === e.target.value);
                  if (team)
                    onChange({
                      name: team.name,
                      short: team.short_name,
                      color: team.color,
                      rosterText: team.players.map((p) => p.name).join("\n"),
                    });
                }}
              >
                <option value="" disabled>
                  Choose a team…
                </option>
                {savedTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.players.length} players)
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <ColorSwatches value={value.color} onChange={(color) => onChange({ color })} />
          {isTeam ? (
            <>
              <Field label="Short name" hint="Shown on scoreboards, up to 4 letters">
                <Input
                  value={value.short}
                  maxLength={4}
                  onChange={(e) => onChange({ short: e.target.value.toUpperCase() })}
                  placeholder={shortName(value.name) || "ABC"}
                />
              </Field>
              <Field label="Players" hint="Optional · one per line · you can also add players while scoring">
                <Textarea
                  value={value.rosterText}
                  onChange={(e) => onChange({ rosterText: e.target.value })}
                  placeholder={"Rohit\nVirat\nSurya"}
                  rows={5}
                />
              </Field>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
