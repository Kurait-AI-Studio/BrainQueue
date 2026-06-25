import { ImageResponse } from "next/og";

export const alt = "BrainQueue — Your brain is for thinking, not remembering everything";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Dynamically generated social card so /og.png is never a 404.
export default function OG() {
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
          background: "#0a0a0d",
          backgroundImage:
            "radial-gradient(900px 600px at 85% -10%, rgba(190,242,74,0.16), transparent 60%), radial-gradient(700px 500px at 0% 110%, rgba(167,139,250,0.12), transparent 60%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 18, height: 18, borderRadius: 99, background: "#bef24a" }} />
          <div style={{ color: "#f5f7fa", fontSize: 30, fontWeight: 600 }}>BrainQueue</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 70, fontWeight: 600, lineHeight: 1.05, letterSpacing: -1 }}>
            <span style={{ color: "#f5f7fa" }}>Your brain is for</span>
            <span style={{ color: "#bef24a", marginLeft: 18 }}>thinking.</span>
          </div>
          <div style={{ color: "rgba(245,247,250,0.6)", fontSize: 70, fontWeight: 600, lineHeight: 1.05, letterSpacing: -1 }}>
            Not for remembering everything.
          </div>
        </div>

        <div style={{ color: "#9aa3b2", fontSize: 30 }}>
          Capture it messy. BrainQueue makes it clear.
        </div>
      </div>
    ),
    { ...size }
  );
}
