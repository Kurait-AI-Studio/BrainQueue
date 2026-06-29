// The Capture inbox — frictionless intake, decoupled from processing. Type or paste
// anything and leave; it's saved raw here. Process a capture into tasks (via the existing
// Brain Dump preview) whenever you have the energy. The capture-first model that ADHD needs:
// get the thought out before it's lost, organize later.
import { useState } from "react";
import { glass, glassStrong } from "./tokens";
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
  const save = (thenProcess) => {
    const t = text.trim();
    if (!t) return;
    const cap = onCapture(t); // returns the created capture
    setText("");
    if (thenProcess && cap) onProcess(cap);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "#0a0a0d", overflow: "auto", fontFamily: FONT }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1.4rem 4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
          <h1 style={{ color: "#fff", fontSize: "1.5rem", margin: 0 }}>📥 Capture</h1>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <p style={{ color: "#666", fontSize: "0.85rem", lineHeight: 1.65, marginBottom: "1rem" }}>
          Get it out of your head. Paste or type anything — messy is completely fine. It's saved here untouched; turn it into tasks whenever you have the energy.
        </p>

        <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={"Everything on your mind right now…"}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(true); }}
          style={{ width: "100%", minHeight: 150, ...glass, borderRadius: 12, padding: "1rem", color: "#ddd", fontSize: "0.9rem", fontFamily: FONT, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
        {(() => {
          const dup = text.trim().length > 8 ? findSimilar(text, captures, 0.45) : null;
          return dup ? (
            <p style={{ fontSize: "0.72rem", color: "#ff9b54", marginTop: "0.6rem", display: "flex", gap: 6 }}>
              <span>⚠️</span><span>Similar to something you captured {timeAgo(dup.match.createdAt)}. Capture anyway, or process that one instead.</span>
            </p>
          ) : null;
        })()}
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.8rem", flexWrap: "wrap" }}>
          <GlassButton onClick={() => save(false)} disabled={!text.trim()} style={{ flex: 1, minWidth: 140, opacity: text.trim() ? 1 : 0.5 }}>Capture &amp; keep</GlassButton>
          <GlassButton onClick={() => save(true)} disabled={!text.trim()} accent="#bef24a" style={{ flex: 1, minWidth: 140, opacity: text.trim() ? 1 : 0.5 }}>Capture &amp; process now →</GlassButton>
        </div>

        <div style={{ marginTop: "2.2rem" }}>
          <div style={{ fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.9rem" }}>
            {captures.length} waiting to process
          </div>
          {captures.length === 0 ? (
            <p style={{ color: "#3a3a3a", fontSize: "0.82rem" }}>Inbox empty. Capture freely above — no pressure to process now.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {captures.map((c) => (
                <div key={c.id} style={{ ...glass, borderRadius: 12, padding: "0.85rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "flex-start" }}>
                    <p style={{ color: "#bcbcc6", fontSize: "0.82rem", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap", flex: 1, maxHeight: "4.5em", overflow: "hidden" }}>{c.text}</p>
                    <span style={{ color: "#444", fontSize: "0.66rem", whiteSpace: "nowrap" }}>{timeAgo(c.createdAt)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}>
                    <button onClick={() => onProcess(c)} style={{ background: "#bef24a", border: "none", borderRadius: 8, padding: "0.4rem 0.95rem", color: "#0a0a0d", fontWeight: 700, fontSize: "0.76rem", cursor: "pointer", fontFamily: FONT }}>Process →</button>
                    <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "0.4rem 0.7rem", color: "#666", fontSize: "0.76rem", cursor: "pointer", fontFamily: FONT }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
