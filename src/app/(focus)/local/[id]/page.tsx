import type { Metadata } from "next";
import { LocalMatch } from "@/components/match/local-match";
import { getCurrentUser, probeBackend } from "@/lib/data/server";

export const metadata: Metadata = { title: "Match on this device", robots: { index: false } };

export default async function LocalMatchPage({ params }: PageProps<"/local/[id]">) {
  const { id } = await params;
  const [user, backend] = await Promise.all([getCurrentUser(), probeBackend()]);
  return <LocalMatch id={id} canUpload={!!user && backend === "ready"} />;
}
