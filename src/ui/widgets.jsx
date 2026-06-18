import { useState } from "react";
import { glass, glassStrong } from "./tokens";
import { totalXP, levelInfo } from "../lib/tasks";

// ─── Gamification + analytics widgets ─────────────────────────────────────────
// Presentational pieces shared by the sidebar and the analytics view.

// Level + XP progress bar (XP/next-level detail in the hover title).
export function XPBar({ tasks }) {
  const xp = totalXP(tasks);
  const { level, into, need, pct, title } = levelInfo(xp);
  return (
    <div style={{ ...glass, borderRadius: "14px", padding: "0.85rem 0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "0.85rem", color: "#e8ff5a", textShadow: "0 0 14px rgba(232,255,90,0.4)" }}>LV {level}</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.66rem", color: "#888" }}>{title}</span>
      </div>
      <div style={{ height: "8px", borderRadius: "20px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}
        title={`${xp} XP · ${into}/${need} to LV ${level + 1}`}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "20px", background: "linear-gradient(90deg,#e8ff5a,#6bffb3)", boxShadow: "0 0 12px rgba(232,255,90,0.5)", transition: "width 0.5s cubic-bezier(0.34,1.3,0.64,1)" }} />
      </div>
    </div>
  );
}

// Bar chart of completions per bucket, with a hover tooltip. `data` items are
// { label, full?, count, xp } from doneSeries().
export function MiniBars({ data, accent = "#e8ff5a", height = 70, showValues = true }) {
  const max = Math.max(1, ...data.map(d => d.count));
  const [hi, setHi] = useState(null);
  const h = hi != null ? data[hi] : null;
  // Plot area and label row are siblings, so each bar's % height resolves cleanly
  // against the fixed-height plot (no flex-shrink squashing them to equal sizes).
  return (
    <div style={{ position: "relative", marginTop: "0.6rem" }}>
      {h && (
        <div style={{ position: "absolute", bottom: "100%", left: `${((hi + 0.5) / data.length) * 100}%`, transform: "translate(-50%, -6px)",
          ...glassStrong, borderRadius: "10px", padding: "0.45rem 0.65rem", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5,
          border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.68rem", color: "#fff" }}>{h.full || h.label}</div>
          <div style={{ fontSize: "0.66rem", color: "#bbb", marginTop: "0.1rem" }}>
            <b style={{ color: "#e8ff5a" }}>{h.count}</b> task{h.count === 1 ? "" : "s"} · <b style={{ color: "#6bffb3" }}>{h.xp}</b> XP
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.25rem", height: `${height}px` }}>
        {data.map((d, i) => (
          <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(p => (p === i ? null : p))}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", cursor: "default" }}>
            <div style={{ width: "100%", height: `${(d.count / max) * 100}%`, minHeight: d.count ? "4px" : "2px",
              background: d.count ? (hi === i ? "#fff" : accent) : "rgba(255,255,255,0.07)", borderRadius: "4px 4px 2px 2px",
              boxShadow: d.count && hi === i ? `0 0 14px ${accent}` : d.count ? `0 0 8px ${accent}55` : "none",
              transition: "height 0.45s cubic-bezier(0.34,1.3,0.64,1), background 0.15s, box-shadow 0.15s",
              display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              {showValues && d.count > 0 && <span style={{ fontSize: "0.5rem", color: hi === i ? "#000" : "#0a0a0f", fontWeight: 700, marginTop: "-0.85rem" }}>{d.count}</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
        {data.map((d, i) => (
          <span key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.5rem", color: hi === i ? "#e8ff5a" : "#555", whiteSpace: "nowrap", overflow: "hidden" }}>
            {data.length > 14 && (i % 5 !== 0) ? "" : d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// A titled sidebar section with an optional right-aligned action.
export function SideSection({ title, children, action }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
        <h4 style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.66rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontWeight: 700 }}>{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

// Donut showing the done-vs-todo split.
export function Donut({ donePct }) {
  return (
    <div style={{ width: "128px", height: "128px", borderRadius: "50%", position: "relative", flexShrink: 0,
      background: `conic-gradient(#6bffb3 ${donePct * 3.6}deg, rgba(255,107,107,0.65) 0)`, boxShadow: "0 0 26px rgba(107,255,179,0.22)" }}>
      <div style={{ position: "absolute", inset: "16px", borderRadius: "50%", background: "#0b0b14", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#6bffb3" }}>{donePct}%</div>
          <div style={{ fontSize: "0.58rem", color: "#777" }}>done</div>
        </div>
      </div>
    </div>
  );
}

// A single big-number stat tile.
export function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...glass, borderRadius: "14px", padding: "0.75rem 0.85rem", flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.35rem", color: accent || "#e8e8e8", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.6rem", color: "#777", marginTop: "0.25rem" }}>{label}</div>
    </div>
  );
}

// The large countdown ring used in Focus Mode.
export function FocusRing({ pct, color, big, sub }) {
  return (
    <div style={{ width: "min(72vw, 300px)", height: "min(72vw, 300px)", borderRadius: "50%", position: "relative",
      background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.05) 0)`, boxShadow: `0 0 70px ${color}33`, transition: "background 0.9s linear" }}>
      <div style={{ position: "absolute", inset: "14px", borderRadius: "50%", background: "#060610", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(2.4rem, 9vw, 3.4rem)", color, letterSpacing: "-0.02em" }}>{big}</div>
          {sub && <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.2rem" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// A −/value/+ minute stepper used in session setup.
export function SessionStepper({ label, value, set, min, max }) {
  return (
    <div style={{ ...glass, borderRadius: "12px", padding: "0.7rem 0.9rem", flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: "0.62rem", color: "#666", fontFamily: "'Syne', sans-serif", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}>
        <button onClick={() => set(Math.max(min, value - 5))} style={{ background: "none", border: "none", color: "#666", fontSize: "1.1rem", cursor: "pointer" }}>−</button>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "#e8ff5a", width: "44px" }}>{value}<span style={{ fontSize: "0.7rem", color: "#555" }}>m</span></span>
        <button onClick={() => set(Math.min(max, value + 5))} style={{ background: "none", border: "none", color: "#666", fontSize: "1.1rem", cursor: "pointer" }}>+</button>
      </div>
    </div>
  );
}
