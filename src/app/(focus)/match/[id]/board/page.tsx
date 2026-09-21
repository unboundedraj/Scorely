import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardScreen } from "@/components/match/board-screen";
import { matchTitle } from "@/components/match/match-card";
import { getMatchWithEvents } from "@/lib/data/server";

export async function generateMetadata({ params }: PageProps<"/match/[id]/board">): Promise<Metadata> {
  const { id } = await params;
  const data = await getMatchWithEvents(id);
  return { title: data ? `${matchTitle(data.match)} · Scoreboard` : "Scoreboard" };
}

export default async function MatchBoardPage({ params }: PageProps<"/match/[id]/board">) {
  const { id } = await params;
  const data = await getMatchWithEvents(id);
  if (!data) notFound();
  return <BoardScreen key={data.match.id} initialMatch={data.match} initialEvents={data.events} mode="cloud" />;
}
