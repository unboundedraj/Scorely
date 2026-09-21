"use client";

import { LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Spinner } from "@/components/ui/misc";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function ProfileForm({ userId, initialName }: { userId: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setSaving(true);
    const { error } = await supabase.from("scorely_profiles").upsert({ id: userId, display_name: name.trim().slice(0, 60) });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated");
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field label="Display name" hint="Shown to spectators as the scorer" className="flex-1">
        <Input value={name} maxLength={60} required onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" disabled={saving || !name.trim() || name.trim() === initialName}>
        {saving ? <Spinner /> : null} Save
      </Button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={async () => {
        await getBrowserSupabase()?.auth.signOut();
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut className="size-4" /> Sign out
    </Button>
  );
}

/** Deletes only this user's Scorely rows — the shared auth account is untouched. */
export function DeleteDataButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="danger"
      size="lg"
      disabled={busy}
      onClick={async () => {
        if (window.prompt('This permanently deletes all your Scorely matches and teams. Type "DELETE" to confirm.') !== "DELETE") return;
        const supabase = getBrowserSupabase();
        if (!supabase) return;
        setBusy(true);
        const results = await Promise.all([
          supabase.from("scorely_matches").delete().eq("owner_id", userId),
          supabase.from("scorely_teams").delete().eq("owner_id", userId),
        ]);
        setBusy(false);
        const failed = results.find((r) => r.error);
        if (failed?.error) toast.error(failed.error.message);
        else {
          toast.success("All your Scorely data was deleted.");
          router.refresh();
        }
      }}
    >
      {busy ? <Spinner /> : <Trash2 className="size-4" />} Delete my matches & teams
    </Button>
  );
}
