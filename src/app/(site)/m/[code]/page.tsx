import { notFound, redirect } from "next/navigation";
import { getMatchIdByCode } from "@/lib/data/server";

/** Short share links: /m/ABC2345 → /match/<uuid>. */
export default async function ShortLinkPage({ params }: PageProps<"/m/[code]">) {
  const { code } = await params;
  const id = await getMatchIdByCode(code);
  if (!id) notFound();
  redirect(`/match/${id}`);
}
