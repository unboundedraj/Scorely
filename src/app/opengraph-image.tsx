import { ImageResponse } from "next/og";

export const alt = "Scorely — live scoring for every game";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 80% 10%, #065f46 0%, #080b10 55%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(145deg, #34d399, #047857)" }} />
          <div style={{ fontSize: 44, fontWeight: 800 }}>Scorely</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>Keep score of every game.</div>
          <div style={{ marginTop: 24, fontSize: 32, color: "#a7f3d0" }}>Cricket · Football · Tennis · Badminton · Chess · and more — shared live.</div>
        </div>
      </div>
    ),
    size,
  );
}
