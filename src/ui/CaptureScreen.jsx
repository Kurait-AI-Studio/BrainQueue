// The Capture inbox — frictionless intake, decoupled from processing. Type or paste
// anything and leave; it's saved raw here. Process captures into tasks (via the Brain Dump
// preview) when you have the energy. Calm and reassuring by design: a safe place to unload a
// busy mind, no pressure to sort. Previous dumps get their own card, reachable without
// scrolling past the canvas, but still collapsed until tapped. Spacing follows the golden ratio.
import { useMemo, useState } from "react";
import { GlassButton } from "./GlassButton";
import { useHover } from "./useHover";
import { findSimilar } from "../lib/similar";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const SERIF = "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif";
const PHI = 1.618;
// Fibonacci scale ≈ golden-ratio steps, used for every gap / margin / padding.
const SP = { xxs: 5, xs: 8, sm: 13, md: 21, lg: 34, xl: 55, xxl: 89 };
const MAXW = 620;
const CANVAS_H = Math.round((MAXW - SP.lg * 2) / PHI); // golden-rectangle writing canvas
const PREVIEW_ROWS = 4; // rows shown before "Show more"

const timeAgo = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const excerpt = (t, n = 70) => (t.length > n ? `${t.slice(0, n).trim()}…` : t);
const fullDateTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// Inline SVGs, not emoji/text glyphs — a glyph's rendering (and vertical centering within its
// own em-box) depends on whatever font the OS falls back to; an SVG always centers exactly and
// looks the same everywhere.
const ICON_PROPS = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
function ChevronIcon({ size = 12 }) {
  return <svg width={size} height={size} {...ICON_PROPS} strokeWidth={2.5}><polyline points="9 6 15 12 9 18" /></svg>;
}
function DocumentIcon({ size = 14 }) {
  return <svg width={size} height={size} {...ICON_PROPS}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function LockIcon({ size = 11 }) {
  return <svg width={size} height={size} {...ICON_PROPS} strokeWidth={2.5}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
}
function ShieldIcon({ size = 13 }) {
  return <svg width={size} height={size} {...ICON_PROPS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
}

function StatusBadge({ status }) {
  const on = status === "processed";
  return (
    <span style={{
      flexShrink: 0, fontSize: "0.68rem", fontWeight: 700, borderRadius: 99, padding: "3px 10px",
      background: on ? "rgba(167,139,250,0.12)" : "rgba(190,242,74,0.12)",
      color: on ? "#c4b5fd" : "#bef24a",
      border: `1px solid ${on ? "rgba(167,139,250,0.30)" : "rgba(190,242,74,0.30)"}`,
    }}>{on ? "Processed" : "New"}</span>
  );
}

export function CaptureScreen({ captures = [], processedCaptures = [], onCapture, onProcessAll, onDelete, onClose, defaultShowSaved = false }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [showSaved, setShowSaved] = useState(defaultShowSaved);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [openDetailId, setOpenDetailId] = useState(null);
  const [cardHover, cardHoverProps] = useHover();
  const dumpActive = focused || cardHover;
  const save = () => {
    const t = text.trim();
    if (!t) return;
    onCapture(t);
    setText("");
  };
  const dup = text.trim().length > 8 ? findSimilar(text, captures, 0.45) : null;

  // Merge pending (new) + already-processed dumps into one reverse-chronological history.
  // Only "new" ones are actionable (Discard / Sort all); "processed" rows are read-only —
  // tapping one reveals a couple more details, not the original raw text again.
  const history = useMemo(() => [
    ...captures.map((c) => ({ ...c, status: "new" })),
    ...processedCaptures.map((c) => ({ ...c, status: "processed" })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [captures, processedCaptures]);
  const visibleHistory = showAllHistory ? history : history.slice(0, PREVIEW_ROWS);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 120, background: "#0a0a0d", overflow: "auto", fontFamily: FONT }}>
      {/* soft, calming ambient light behind the canvas */}
      <div style={{ position: "fixed", top: "-12%", left: "50%", transform: "translateX(-50%)", width: "min(700px, 92vw)", height: 360, background: "radial-gradient(closest-side, rgba(190,242,74,0.10), rgba(190,242,74,0))", filter: "blur(24px)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "fixed", top: SP.md, right: SP.md, zIndex: 2, display: "flex", alignItems: "center", gap: SP.sm }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 99, padding: "6px 12px", fontSize: "0.68rem", color: "#8a8a92", whiteSpace: "nowrap" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#bef24a", boxShadow: "0 0 6px rgba(190,242,74,0.7)", flexShrink: 0 }} />
          <span>Private by design</span>
          <LockIcon size={11} />
        </div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#555", fontSize: "1.5rem", cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: MAXW, margin: "0 auto", padding: `${SP.xxl}px ${SP.md}px ${SP.xxl}px`, animation: "task-enter 0.45s ease" }}>
        {/* editorial header */}
        <div style={{ marginBottom: SP.xl }}>
          <p style={{ color: "#bef24a", fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", margin: `0 0 ${SP.sm}px` }}>Capture</p>
          <h1 style={{ fontFamily: SERIF, fontWeight: 400, margin: 0, lineHeight: 1.18 }}>
            <span style={{ display: "block", color: "#f4f4f5", fontSize: "clamp(1.5rem, 5vw, 2.1rem)" }}>Dump it all.</span>
            <span style={{ display: "block", color: "#bef24a", fontSize: "clamp(1.5rem, 5vw, 2.1rem)" }}>We'll make sense of it.</span>
          </h1>
          <p style={{ color: "#8a8a92", fontSize: "0.98rem", lineHeight: 1.6, maxWidth: 440, margin: `${SP.sm}px 0 0`, fontFamily: FONT }}>
            Get every thought, reminder, idea, or worry out of your head. Nothing here is a task yet — there's no rush to sort it.
          </p>
        </div>

        {/* Previous dumps — its own card, positioned above the canvas so it's always
            reachable without scrolling, but the list itself stays collapsed until tapped.
            Merges pending ("New") dumps with already-processed history. */}
        {history.length > 0 && (
          <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, marginBottom: SP.lg, overflow: "hidden", background: "rgba(255,255,255,0.015)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: SP.sm, padding: `${SP.sm}px ${SP.md}px` }}>
              <button onClick={() => setShowSaved((v) => !v)} aria-expanded={showSaved}
                style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: SP.sm, background: "none", border: "none", cursor: "pointer", fontFamily: FONT, textAlign: "left", padding: 0 }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#aaa", flexShrink: 0, transition: "transform 0.2s", transform: showSaved ? "rotate(90deg)" : "none" }}><ChevronIcon size={12} /></span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", color: "#e4e4e7", fontSize: "0.85rem", fontWeight: 700 }}>Previous dumps · {history.length}</span>
                  <span style={{ display: "block", color: "#666", fontSize: "0.7rem", marginTop: 1 }}>Accessible when you need them</span>
                </span>
              </button>
              {captures.length > 0 && (
                <button onClick={() => onProcessAll(captures)}
                  style={{ flexShrink: 0, background: "rgba(190,242,74,0.10)", border: "1px solid rgba(190,242,74,0.30)", borderRadius: 9, padding: `${SP.xs}px ${SP.sm}px`, color: "#bef24a", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", fontFamily: FONT }}>
                  Sort all →
                </button>
              )}
            </div>
            {showSaved && (
              <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, padding: `0 ${SP.md}px ${SP.md}px` }}>
                {visibleHistory.map((c) => {
                  const processed = c.status === "processed";
                  const detailOpen = openDetailId === c.id;
                  return (
                    <div key={c.id} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: `${SP.sm}px ${SP.md}px` }}>
                      <button onClick={() => processed && setOpenDetailId(detailOpen ? null : c.id)}
                        style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: SP.sm, alignItems: "center", background: "none", border: "none", padding: 0, textAlign: "left", cursor: processed ? "pointer" : "default", fontFamily: FONT }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.04)", color: "#888", flexShrink: 0 }}><DocumentIcon size={13} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", color: "#999", fontSize: "0.68rem" }}>Dump · {timeAgo(c.createdAt)}</span>
                          <span style={{ display: "block", color: "#bcbcc6", fontSize: "0.82rem", lineHeight: 1.5, marginTop: 2 }}>{excerpt(c.text)}</span>
                        </span>
                        <StatusBadge status={c.status} />
                      </button>
                      {processed && detailOpen && (
                        <div style={{ marginTop: SP.sm, paddingTop: SP.sm, borderTop: "1px solid rgba(255,255,255,0.06)", color: "#777", fontSize: "0.72rem", lineHeight: 1.7 }}>
                          <div>Captured {fullDateTime(c.createdAt)}</div>
                          {c.processedAt && <div>Processed {fullDateTime(c.processedAt)}</div>}
                        </div>
                      )}
                      {!processed && (
                        <button onClick={() => onDelete(c.id)} style={{ marginTop: SP.xs, background: "none", border: "none", color: "#5a5a62", fontSize: "0.72rem", cursor: "pointer", fontFamily: FONT, padding: 0 }}>Discard</button>
                      )}
                    </div>
                  );
                })}
                {!showAllHistory && history.length > PREVIEW_ROWS && (
                  <button onClick={() => setShowAllHistory(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "none", color: "#8a8a92", fontSize: "0.76rem", fontWeight: 600, cursor: "pointer", fontFamily: FONT, padding: `${SP.xs}px 0` }}>
                    <span>Show more ({history.length - PREVIEW_ROWS})</span>
                    <span style={{ transform: "rotate(90deg)", display: "grid" }}><ChevronIcon size={10} /></span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* the brain-dump card (a golden rectangle canvas inside a bordered card) — a lime
            halo builds on hover and holds while typing, so the card reads as an inviting,
            interactive drop zone rather than a static box. */}
        <div {...cardHoverProps} style={{
          border: `1px solid ${dumpActive ? "rgba(190,242,74,0.45)" : "rgba(255,255,255,0.08)"}`,
          boxShadow: dumpActive
            ? "0 0 0 4px rgba(190,242,74,0.08), 0 0 46px -10px rgba(190,242,74,0.45), 0 24px 60px -24px rgba(190,242,74,0.22)"
            : "0 12px 44px -24px rgba(0,0,0,0.7)",
          transform: cardHover && !focused ? "translateY(-3px)" : "translateY(0)",
          borderRadius: 20, padding: SP.md, background: "rgba(255,255,255,0.02)",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: SP.sm }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#bef24a" }} />
            <span style={{ color: "#777", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>Brain dump</span>
          </div>

          {/* the writing well — a visibly distinct, slightly sunken surface, so it's obvious
              where typing lands rather than blending into the card chrome around it. */}
          <div style={{ background: "rgba(0,0,0,0.18)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: SP.sm, boxShadow: "inset 0 1px 8px rgba(0,0,0,0.25)" }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} autoFocus
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }}
              placeholder={"Start typing… thoughts, worries, to-dos, half-ideas — anything."}
              style={{
                width: "100%", minHeight: CANVAS_H, background: "none", border: "none",
                color: "#e4e4e7", fontSize: "0.95rem", lineHeight: 1.7,
                fontFamily: FONT, resize: "vertical", outline: "none", boxSizing: "border-box", padding: 0,
              }} />
          </div>

          {dup && (
            <p style={{ fontSize: "0.72rem", color: "#e3a06a", marginTop: SP.sm, display: "flex", gap: 6, lineHeight: 1.5 }}>
              <span>🍂</span><span>Similar to something you captured {timeAgo(dup.match.createdAt)}. Capture it anyway, or sort that one instead — your call.</span>
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SP.sm, marginTop: SP.md, paddingTop: SP.sm, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ color: "#3a3a3a", fontSize: "0.68rem" }}>⌘/Ctrl + Enter to save</span>
            <GlassButton onClick={save} disabled={!text.trim()} accent="#bef24a" style={{ padding: `${SP.xs}px ${SP.lg}px`, opacity: text.trim() ? 1 : 0.5 }}>Save it →</GlassButton>
          </div>
        </div>

        <p style={{ textAlign: "center", color: "#555", fontSize: "0.74rem", marginTop: SP.md, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <ShieldIcon size={13} /><span>Nothing is lost. Everything stays private.</span>
        </p>
      </div>
    </div>
  );
}
