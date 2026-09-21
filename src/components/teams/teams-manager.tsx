"use client";

import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { parseRoster } from "@/components/setup/participants-editor";
import { Button } from "@/components/ui/button";
import { ColorSwatches } from "@/components/ui/color-swatches";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, Spinner, TeamMark } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import type { SavedTeam } from "@/lib/data/mappers";
import { getSport, SPORTS, TEAM_COLORS } from "@/lib/sports/registry";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { shortName, uid } from "@/lib/utils";

interface Draft {
  id: string | null;
  name: string;
  short: string;
  color: string;
  sport: string;
  roster: string;
}

const EMPTY: Draft = { id: null, name: "", short: "", color: TEAM_COLORS[0], sport: "", roster: "" };

export function TeamsManager({ teams }: { teams: SavedTeam[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const teamSports = SPORTS.filter((s) => s.side === "team");

  const open = (t?: SavedTeam) =>
    setDraft(
      t
        ? { id: t.id, name: t.name, short: t.short_name, color: t.color, sport: t.sport ?? "", roster: t.players.map((p) => p.name).join("\n") }
        : { ...EMPTY, color: TEAM_COLORS[teams.length % TEAM_COLORS.length] },
    );

  async function save() {
    if (!draft) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error("Give the team a name.");
      return;
    }
    setSaving(true);
    // Keep ids of players that already existed so history stays linked.
    const existing = new Map((teams.find((t) => t.id === draft.id)?.players ?? []).map((p) => [p.name.toLowerCase(), p.id]));
    const players = parseRoster(draft.roster).map((n) => ({ id: existing.get(n.toLowerCase()) ?? uid(8), name: n }));
    const row = {
      name,
      short_name: (draft.short.trim() || shortName(name)).slice(0, 4),
      color: draft.color,
      sport: draft.sport || null,
      players,
    };
    const { error } = draft.id
      ? await supabase.from("scorely_teams").update(row).eq("id", draft.id)
      : await supabase.from("scorely_teams").insert(row);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(draft.id ? "Team updated" : "Team saved");
    setDraft(null);
    router.refresh();
  }

  async function remove(t: SavedTeam) {
    if (!window.confirm(`Delete ${t.name}? Past matches keep their line-ups.`)) return;
    const supabase = getBrowserSupabase();
    const { error } = (await supabase?.from("scorely_teams").delete().eq("id", t.id)) ?? { error: null };
    if (error) toast.error(error.message);
    else {
      toast.success("Team deleted");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {teams.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const sport = t.sport ? getSport(t.sport) : null;
            return (
              <div key={t.id} className="rounded-2xl border border-border bg-surface p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <TeamMark name={t.name} short={t.short_name} color={t.color} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{t.name}</p>
                    <p className="text-xs text-muted">
                      {sport ? `${sport.emoji} ${sport.name} · ` : ""}
                      {t.players.length} players
                    </p>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={() => open(t)} aria-label={`Edit ${t.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => remove(t)} aria-label={`Delete ${t.name}`} className="text-muted hover:text-danger">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {t.players.length ? (
                  <p className="mt-3 line-clamp-2 text-sm text-muted">{t.players.map((p) => p.name).join(", ")}</p>
                ) : null}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => open()}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm font-semibold text-muted hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-5" /> New team
          </button>
        </div>
      ) : (
        <EmptyState
          icon={<Users className="mx-auto size-10 text-muted" />}
          title="No saved teams yet"
          description="Save your regular line-ups once and load them into any new match in a tap."
          action={
            <Button size="lg" onClick={() => open()}>
              <Plus className="size-5" /> Create a team
            </Button>
          }
        />
      )}

      {draft ? (
        <Sheet
          open
          onClose={() => setDraft(null)}
          title={draft.id ? "Edit team" : "New team"}
          footer={
            <Button size="lg" block onClick={save} disabled={saving}>
              {saving ? <Spinner /> : null} Save team
            </Button>
          }
        >
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <TeamMark name={draft.name || "Team"} short={draft.short || shortName(draft.name)} color={draft.color} size="lg" />
              <Field label="Team name" className="flex-1">
                <Input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Sunday Strikers" autoFocus />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Short name">
                <Input value={draft.short} maxLength={4} onChange={(e) => setDraft({ ...draft, short: e.target.value.toUpperCase() })} placeholder={shortName(draft.name) || "SS"} />
              </Field>
              <Field label="Sport">
                <Select value={draft.sport} onChange={(e) => setDraft({ ...draft, sport: e.target.value })}>
                  <option value="">Any sport</option>
                  {teamSports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Colour">
              <ColorSwatches value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
            </Field>
            <Field label="Players" hint={`One per line · ${parseRoster(draft.roster).length} players`}>
              <Textarea value={draft.roster} rows={8} onChange={(e) => setDraft({ ...draft, roster: e.target.value })} placeholder={"Player one\nPlayer two"} />
            </Field>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
