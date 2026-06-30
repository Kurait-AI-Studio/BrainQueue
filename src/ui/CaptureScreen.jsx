// The Capture inbox — frictionless intake, decoupled from processing. Type or paste
// anything and leave; it's saved raw here. Process captures into tasks (via the Brain Dump
// preview) when you have the energy. Calm and reassuring by design: a safe place to unload a
// busy mind, no pressure to sort. Previous captures are hidden by default (less to overwhelm
// an ADHD brain) and revealed only on a discreet tap. Spacing follows the golden ratio.
import { useState } from "react";
import { GlassButton } from "./GlassButton";
import { findSimilar } from "../lib/similar";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const PHI = 1.618;
// Fibonacci scale ≈ golden-ratio steps, used for every gap / margin / padding.
const SP = { xxs: 5, xs: 8, sm: 13, md: 21, lg: 34, xl: 55, xxl: 89 };
const MAXW = 600;
const CANVAS_H = Math.round((MAXW - SP.md * 2) / PHI); // golden-rectangle writing canvas

const timeAgo = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function CaptureScreen({ captures = [], onCapture, onProcessAll, onDelete, onClose }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const save = () => {
    const t = text.trim();
    if (!t) return;
    onCapture(t);
    setText("");
  };
  const dup = text.trim().length > 8 ? findSimilar(text, captures, 0.45) : null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "#0a0a0d", overflow: "auto", fontFamily: FONT }}>
      {/* soft, calming ambient light behind the canvas */}
      <div style={{ position: "fixed", top: "-12%", left: "50%", transform: "translateX(-50%)", width: "min(700px, 92vw)", height: 360, background: "radial-gradient(closest-side, rgba(190,242,74,0.10), rgba(190,242,74,0))", filter: "blur(24px)", pointerEvents: "none", zIndex: 0 }} />
      <button onClick={onClose} aria-label="Close" style={{ position: "fixed", top: SP.md, right: SP.md, background: "none", border: "none", color: "#555", fontSize: "1.5rem", cursor: "pointer", zIndex: 2, lineHeight: 1 }}>×</button>

      <div style={{ position: "relative", zIndex: 1, maxWidth: MAXW, margin: "0 auto", padding: `${SP.xl}px ${SP.md}px ${SP.xxl}px`, animation: "task-enter 0.45s ease" }}>
        {/* warm, reassuring header */}
        <div style={{ textAlign: "center", marginBottom: SP.lg }}>
          <div style={{ width: SP.xl, height: SP.xl, borderRadius: "50%", margin: `0 auto ${SP.md}px`, display: "grid", placeItems: "center", background: "rgba(190,242,74,0.10)", border: "1px solid rgba(190,242,74,0.22)", fontSize: "1.55rem" }}>🧠</div>
          <h1 style={{ color: "#f4f4f5", fontSize: "1.65rem", fontWeight: 700, margin: `0 0 ${SP.xs}px`, letterSpacing: "-0.01em" }}>What's on your mind?</h1>
          <p style={{ color: "#8a8a92", fontSize: "1.02rem", lineHeight: 1.6, maxWidth: Math.round(MAXW / PHI), margin: "0 auto" }}>
            Let it all out — messy is perfect. Nothing here is a task yet, and there's no rush to sort it.
          </p>
        </div>

        {/* the calm canvas (a golden rectangle) */}
        <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }}
          placeholder={"Start typing… thoughts, worries, to-dos, half-ideas — anything."}
          style={{
            width: "100%", minHeight: CANVAS_H, background: "rgba(255,255,255,0.025)",
            border: `1px solid ${focused ? "rgba(190,242,74,0.40)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: focused ? "0 0 0 4px rgba(190,242,74,0.06), 0 20px 55px -22px rgba(190,242,74,0.18)" : "0 12px 44px -24px rgba(0,0,0,0.7)",
            borderRadius: 18, padding: SP.md, color: "#e4e4e7", fontSize: "0.95rem", lineHeight: 1.7,
            fontFamily: FONT, resize: "vertical", outline: "none", boxSizing: "border-box", transition: "border-color 0.25s, box-shadow 0.25s",
          }} />

        {dup && (
          <p style={{ fontSize: "0.72rem", color: "#e3a06a", marginTop: SP.sm, display: "flex", gap: 6, lineHeight: 1.5 }}>
            <span>🍂</span><span>Similar to something you captured {timeAgo(dup.match.createdAt)}. Capture it anyway, or sort that one instead — your call.</span>
          </p>
        )}

        <div style={{ marginTop: SP.md }}>
          <GlassButton onClick={save} disabled={!text.trim()} accent="#bef24a" style={{ width: "100%", padding: `${SP.sm}px`, opacity: text.trim() ? 1 : 0.5 }}>Save it</GlassButton>
        </div>
        <p style={{ textAlign: "center", color: "#3a3a3a", fontSize: "0.68rem", marginTop: SP.sm }}>⌘/Ctrl + Enter to save</p>

        {/* Saved — collapsed by default; a discreet tap reveals it. Sorting is batch-only. */}
        {captures.length > 0 && (
          <div style={{ marginTop: SP.xl }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SP.sm }}>
              <button onClick={() => setShowSaved((v) => !v)} aria-expanded={showSaved}
                style={{ background: "none", border: "none", color: "#777", fontSize: "0.74rem", textTransform: "uppercase", letterSpacing: "0.1em", cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 7, padding: 0 }}>
                <span>Saved · {captures.length}</span>
                <span style={{ fontSize: "0.62rem", display: "inline-block", transition: "transform 0.2s", transform: showSaved ? "rotate(90deg)" : "none" }}>▸</span>
              </button>
              <button onClick={() => onProcessAll(captures)}
                style={{ background: "rgba(190,242,74,0.10)", border: "1px solid rgba(190,242,74,0.30)", borderRadius: 9, padding: `${SP.xs}px ${SP.sm + 2}px`, color: "#bef24a", fontWeight: 700, fontSize: "0.74rem", cursor: "pointer", fontFamily: FONT }}>
                Sort all into tasks →
              </button>
            </div>
            {showSaved && (
              <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, marginTop: SP.md }}>
                {captures.map((c) => (
                  <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: `${SP.sm}px ${SP.md}px` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: SP.sm, alignItems: "flex-start" }}>
                      <p style={{ color: "#bcbcc6", fontSize: "0.82rem", lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap", flex: 1, maxHeight: "4.6em", overflow: "hidden" }}>{c.text}</p>
                      <span style={{ color: "#444", fontSize: "0.65rem", whiteSpace: "nowrap", marginTop: 2 }}>{timeAgo(c.createdAt)}</span>
                    </div>
                    <button onClick={() => onDelete(c.id)} style={{ marginTop: SP.xs, background: "none", border: "none", color: "#5a5a62", fontSize: "0.72rem", cursor: "pointer", fontFamily: FONT, padding: 0 }}>Discard</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
