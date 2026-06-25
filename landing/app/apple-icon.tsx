import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Apple touch icon — dark canvas, lime mark + dot, to match the app aesthetic.
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
          background: "#0a0a0d",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ width: 78, height: 15, borderRadius: 8, background: "#5b6472" }} />
            <div style={{ width: 60, height: 15, borderRadius: 8, background: "#727b8a" }} />
            <div style={{ width: 42, height: 15, borderRadius: 8, background: "#9aa3b2" }} />
          </div>
          <div style={{ width: 26, height: 26, borderRadius: 99, background: "#bef24a" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
