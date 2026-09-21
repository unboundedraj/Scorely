import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { matchTitle } from "@/components/match/match-card";
import { MatchScreen } from "@/components/match/match-screen";
import { getCurrentUser, getMatchWithEvents } from "@/lib/data/server";
import { sportOrDefault } from "@/lib/sports/registry";

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getMatchWithEvents(id);
  if (!data) return { title: "Match not found" };
  const { match } = data;
  const sport = sportOrDefault(match.sport);
  const title = `${sport.emoji} ${matchTitle(match)}`;
  const byId = new Map(match.participants.map((p) => [p.id, p.name]));
  const scoreLine = (match.summary?.lines ?? []).map((l) => `${byId.get(l.participantId) ?? ""} ${l.score}`.trim()).join(" · ");
  const description = [scoreLine, match.summary?.status].filter(Boolean).join(" — ") || `Live ${sport.name.toLowerCase()} scores on Scorely`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
    robots: match.is_public ? undefined : { index: false },
  };
}

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const { id } = await params;
  const [data, user] = await Promise.all([getMatchWithEvents(id), getCurrentUser()]);
  if (!data) notFound();
  const canEdit = !!user && user.id === data.match.owner_id;
  return (
    <MatchScreen
      key={data.match.id}
      initialMatch={data.match}
      initialEvents={data.events}
      mode="cloud"
      canEdit={canEdit}
      ownerName={data.ownerName}
    />
  );
}
