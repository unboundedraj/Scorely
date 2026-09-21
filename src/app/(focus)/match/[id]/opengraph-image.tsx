import { ImageResponse } from "next/og";
import { getMatchWithEvents } from "@/lib/data/server";
import { sportOrDefault } from "@/lib/sports/registry";

export const alt = "Live score on Scorely";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share-card with the current score, so links preview nicely in chats. */
export default async function MatchOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMatchWithEvents(id).catch(() => null);
  const match = data?.match;
  const sport = sportOrDefault(match?.sport ?? "custom");
  const byId = new Map((match?.participants ?? []).map((p) => [p.id, p]));
  const lines = (match?.summary?.lines ?? []).slice(0, 4);
  const live = match?.status === "live";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          background: "linear-gradient(160deg, #0f1720 0%, #080b10 70%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, color: "#94a3b8" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(145deg, #34d399, #047857)" }} />
            Scorely · {sport.name}
          </div>
          {live ? (
            <div style={{ display: "flex", padding: "8px 22px", borderRadius: 999, background: "#e11d48", fontSize: 28, fontWeight: 800 }}>LIVE</div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 56, flex: 1 }}>
          {lines.length ? (
            lines.map((l) => {
              const p = byId.get(l.participantId);
              return (
                <div key={l.participantId} style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: p?.color ?? "#64748b" }} />
                  <div style={{ fontSize: 52, fontWeight: 700, flex: 1, overflow: "hidden" }}>{p?.name ?? ""}</div>
                  {l.detail ? <div style={{ fontSize: 34, color: "#94a3b8" }}>{l.detail}</div> : null}
                  <div style={{ fontSize: 72, fontWeight: 800 }}>{l.score}</div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: 60, fontWeight: 800 }}>{match ? match.title || "Live match" : "Match not found"}</div>
          )}
        </div>
        <div style={{ fontSize: 34, color: "#6ee7b7", fontWeight: 600 }}>{match?.summary?.status ?? "Follow live on Scorely"}</div>
      </div>
    ),
    size,
  );
}
