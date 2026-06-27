import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon — the BrainQueue "queue" mark on lime, legible at tab size.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#bef24a",
          borderRadius: 7,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ width: 17, height: 3.4, borderRadius: 2, background: "#0a0a0d" }} />
          <div style={{ width: 12, height: 3.4, borderRadius: 2, background: "#0a0a0d" }} />
          <div style={{ width: 8, height: 3.4, borderRadius: 2, background: "#0a0a0d" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
