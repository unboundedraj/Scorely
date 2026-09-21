import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";
import { TeamsManager } from "@/components/teams/teams-manager";
import { getCurrentUser, listTeams } from "@/lib/data/server";

export const metadata: Metadata = { title: "Saved teams" };

export default async function TeamsPage() {
  const user = await getCurrentUser();
  const teams = await listTeams();
  if (teams.backend === "ready" && !user) redirect("/login?next=/teams");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Saved teams</h1>
        <p className="mt-1 text-sm text-muted">Reusable line-ups for cricket, football, basketball and more.</p>
      </div>
      {teams.backend === "ready" ? <TeamsManager teams={teams.items} /> : <SetupNotice state={teams.backend} />}
    </div>
  );
}
