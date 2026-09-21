import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ThemeSelect } from "@/components/layout/theme-toggle";
import { DeleteDataButton, ProfileForm, SignOutButton } from "@/components/settings/settings-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/data/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (isSupabaseConfigured && !user) redirect("/login?next=/settings");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>

      {user ? (
        <Card>
          <CardHeader title="Profile" description={user.email} />
          <CardBody>
            <ProfileForm userId={user.id} initialName={user.displayName} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Appearance" description="Dark mode is great for night matches and saves battery." />
        <CardBody>
          <ThemeSelect />
        </CardBody>
      </Card>

      {user ? (
        <>
          <Card>
            <CardHeader title="Session" />
            <CardBody>
              <SignOutButton />
            </CardBody>
          </Card>
          <Card className="border-danger/30">
            <CardHeader title="Danger zone" description="Remove every match and team you've created in Scorely. Spectator links will stop working." />
            <CardBody>
              <DeleteDataButton userId={user.id} />
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
