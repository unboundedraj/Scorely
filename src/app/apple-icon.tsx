import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "linear-gradient(145deg, #34d399, #047857)",
        }}
      >
        <div style={{ width: 44, height: 82, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 13, height: 44, borderRadius: 7, background: "#047857" }} />
        </div>
        <div style={{ width: 44, height: 82, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, fontWeight: 800, color: "#047857" }}>
          7
        </div>
      </div>
    ),
    size,
  );
}
