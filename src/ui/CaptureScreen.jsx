// The Capture inbox — frictionless intake, decoupled from processing. Type or paste
// anything and leave; it's saved raw here. Process a capture into tasks (via the existing
// Brain Dump preview) whenever you have the energy. Designed to feel calm and reassuring:
// a safe place to unload a busy mind, with no pressure to sort anything right now.
import { useState } from "react";
import { GlassButton } from "./GlassButton";
import { findSimilar } from "../lib/similar";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const timeAgo = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function CaptureScreen({ captures = [], onCapture, onProcess, onDelete, onClose }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const save = (thenProcess) => {
    const t = text.trim();
    if (!t) return;
    const cap = onCapture(t);
    setText("");
    if (thenProcess && cap) onProcess(cap);
  };
  const dup = text.trim().length > 8 ? findSimilar(text, captures, 0.45) : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "#0a0a0d", overflow: "auto", fontFamily: FONT }}>
      {/* a soft, calming ambient light behind the canvas */}
      <div style={{ position: "fixed", top: "-12%", left: "50%", transform: "translateX(-50%)", width: "min(700px, 92vw)", height: 360, background: "radial-gradient(closest-side, rgba(190,242,74,0.10), rgba(190,242,74,0))", filter: "blur(24px)", pointerEvents: "none", zIndex: 0 }} />
      <button onClick={onClose} aria-label="Close" style={{ position: "fixed", top: 18, right: 20, background: "none", border: "none", color: "#555", fontSize: "1.5rem", cursor: "pointer", zIndex: 2, lineHeight: 1 }}>×</button>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto", padding: "3.4rem 1.4rem 5rem", animation: "task-enter 0.45s ease" }}>
        {/* warm, reassuring header */}
        <div style={{ textAlign: "center", marginBottom: "1.9rem" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", margin: "0 auto 1.1rem", display: "grid", placeItems: "center", background: "rgba(190,242,74,0.10)", border: "1px solid rgba(190,242,74,0.22)", fontSize: "1.55rem" }}>🧠</div>
          <h1 style={{ color: "#f4f4f5", fontSize: "1.7rem", fontWeight: 700, margin: "0 0 0.55rem", letterSpacing: "-0.01em" }}>What's on your mind?</h1>
          <p style={{ color: "#8a8a92", fontSize: "0.9rem", lineHeight: 1.65, maxWidth: 420, margin: "0 auto" }}>
            Let it all out — messy is perfect. Nothing here is a task yet, and there's no rush to sort it.
          </p>
        </div>

        {/* the calm canvas */}
        <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(true); }}
          placeholder={"Start typing… thoughts, worries, to-dos, half-ideas — anything."}
          style={{
            width: "100%", minHeight: 190, background: "rgba(255,255,255,0.025)",
            border: `1px solid ${focused ? "rgba(190,242,74,0.40)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: focused ? "0 0 0 4px rgba(190,242,74,0.06), 0 20px 55px -22px rgba(190,242,74,0.18)" : "0 12px 44px -24px rgba(0,0,0,0.7)",
            borderRadius: 18, padding: "1.25rem 1.35rem", color: "#e4e4e7", fontSize: "0.95rem", lineHeight: 1.7,
            fontFamily: FONT, resize: "vertical", outline: "none", boxSizing: "border-box", transition: "border-color 0.25s, box-shadow 0.25s",
          }} />

        {dup && (
          <p style={{ fontSize: "0.72rem", color: "#e3a06a", marginTop: "0.7rem", display: "flex", gap: 6, lineHeight: 1.5 }}>
            <span>🍂</span><span>Similar to something you captured {timeAgo(dup.match.createdAt)}. Capture it anyway, or sort that one instead — your call.</span>
          </p>
        )}

        <div style={{ display: "flex", gap: "0.7rem", marginTop: "1.1rem", flexWrap: "wrap" }}>
          <GlassButton onClick={() => save(false)} disabled={!text.trim()} accent="#bef24a" style={{ flex: 1, minWidth: 150, padding: "0.85rem", opacity: text.trim() ? 1 : 0.5 }}>Save it</GlassButton>
          <GlassButton onClick={() => save(true)} disabled={!text.trim()} style={{ flex: 1, minWidth: 150, padding: "0.85rem", opacity: text.trim() ? 1 : 0.5 }}>Save &amp; sort now →</GlassButton>
        </div>
        <p style={{ textAlign: "center", color: "#3a3a3a", fontSize: "0.68rem", marginTop: "0.75rem" }}>⌘/Ctrl + Enter to save &amp; sort</p>

        {/* what's saved — framed as calm, not a backlog */}
        {captures.length > 0 ? (
          <div style={{ marginTop: "2.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.12em" }}>Saved · {captures.length}</span>
              <span style={{ fontSize: "0.7rem", color: "#3f3f46" }}>no rush to sort these</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              {captures.map((c) => (
                <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "0.95rem 1.1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.7rem", alignItems: "flex-start" }}>
                    <p style={{ color: "#c4c4cc", fontSize: "0.84rem", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap", flex: 1, maxHeight: "4.6em", overflow: "hidden" }}>{c.text}</p>
                    <span style={{ color: "#444", fontSize: "0.65rem", whiteSpace: "nowrap", marginTop: 2 }}>{timeAgo(c.createdAt)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem" }}>
                    <button onClick={() => onProcess(c)} style={{ background: "#bef24a", border: "none", borderRadius: 9, padding: "0.45rem 1rem", color: "#0a0a0d", fontWeight: 700, fontSize: "0.76rem", cursor: "pointer", fontFamily: FONT }}>Sort into tasks →</button>
                    <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, padding: "0.45rem 0.8rem", color: "#5a5a62", fontSize: "0.76rem", cursor: "pointer", fontFamily: FONT }}>Discard</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ textAlign: "center", color: "#333", fontSize: "0.8rem", marginTop: "2.8rem", lineHeight: 1.7 }}>
            Your mind-space is clear.<br />Whatever lands, drop it here.
          </p>
        )}
      </div>
    </div>
  );
}
