import type { Metadata } from "next";
import { LocalMatch } from "@/components/match/local-match";

export const metadata: Metadata = { title: "Scoreboard", robots: { index: false } };

export default async function LocalBoardPage({ params }: PageProps<"/local/[id]/board">) {
  const { id } = await params;
  return <LocalMatch id={id} board />;
}
