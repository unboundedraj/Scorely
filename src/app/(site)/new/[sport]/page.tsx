import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchSetup } from "@/components/setup/match-setup";
import { SetupNotice } from "@/components/setup-notice";
import { getCurrentUser, listTeams, probeBackend } from "@/lib/data/server";
import { getSport } from "@/lib/sports/registry";

export async function generateMetadata({ params }: PageProps<"/new/[sport]">): Promise<Metadata> {
  const { sport } = await params;
  const def = getSport(sport);
  return { title: def ? `New ${def.name.toLowerCase()} match` : "New match" };
}

export default async function NewSportMatchPage({ params }: PageProps<"/new/[sport]">) {
  const { sport } = await params;
  const def = getSport(sport);
  if (!def) notFound();

  const [user, backend] = await Promise.all([getCurrentUser(), probeBackend()]);
  const cloud = !!user && backend === "ready";
  const teams = cloud && def.side === "team" ? await listTeams() : null;
  const savedTeams = (teams?.items ?? []).filter((t) => !t.sport || t.sport === def.id);

  return (
    <>
      {backend === "schema_missing" ? <SetupNotice state={backend} className="mx-auto mb-4 max-w-3xl" /> : null}
      <MatchSetup sportId={def.id} mode={cloud ? "cloud" : "local"} savedTeams={savedTeams} />
    </>
  );
}
