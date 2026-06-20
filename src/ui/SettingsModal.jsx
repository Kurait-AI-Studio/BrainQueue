import { useState } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";
import { WeightSlider } from "./misc";
import { DEFAULT_WEIGHTS } from "../lib/tasks";
import { REVIEW_TONES, DEFAULT_REVIEW_TONE } from "../lib/weeklyReview";

// Settings: score-weight sliders + the weekly-review tone. (Brain Dump runs through a
// server-side edge function now, so there's no user-facing API key.)
export function SettingsModal({ weights, reviewTone, onSave, onClose }) {
  const [w, setW] = useState({ ...DEFAULT_WEIGHTS, ...(weights || {}) });
  const [tone, setTone] = useState(reviewTone || DEFAULT_REVIEW_TONE);
  const setWField = (k, v) => setW(prev => ({ ...prev, [k]: v }));
  const total = w.urgency + w.importance + w.effort + w.energy + (w.pleasure ?? 0);
  const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.2rem", color: "#fff", margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
            <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>Score Weights</label>
            <span style={{ fontSize: "0.68rem", color: total === 100 ? "#6bffb3" : "#ffb347" }}>
              total: {total} {total !== 100 ? "(normalised)" : ""}
            </span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#333", marginBottom: "1.2rem", lineHeight: 1.6 }}>
            Controls what makes a task rise to the top in 🔥 Do Now. Higher weight = more influence on score.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.4rem", marginBottom: "1.2rem" }}>
            {[["Urgency", w.urgency], ["Importance", w.importance], ["Quick win", w.effort], ["Low energy", w.energy], ["Pleasure", w.pleasure ?? 0]].map(([l, v]) => (
              <div key={l} style={{ ...glass, borderRadius: "10px", padding: "0.6rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.62rem", color: "#444", fontFamily: "'Syne', sans-serif", marginBottom: "0.2rem" }}>{l}</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#e8ff5a", fontFamily: "'Syne', sans-serif" }}>{pct(v)}%</div>
              </div>
            ))}
          </div>
          <WeightSlider label="Urgency" value={w.urgency} onChange={v => setWField("urgency", v)} description="deadline proximity" />
          <WeightSlider label="Importance" value={w.importance} onChange={v => setWField("importance", v)} description="impact if done" />
          <WeightSlider label="Effort (Quick Win)" value={w.effort} onChange={v => setWField("effort", v)} description="rewards fast tasks" />
          <WeightSlider label="Energy (Low cost)" value={w.energy} onChange={v => setWField("energy", v)} description="rewards easy brain tasks" />
          <WeightSlider label="Pleasure" value={w.pleasure ?? 0} onChange={v => setWField("pleasure", v)} description="rewards tasks you enjoy" />
          <button onClick={() => setW(DEFAULT_WEIGHTS)} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
            color: "#444", fontSize: "0.72rem", cursor: "pointer", padding: "0.4rem 0.8rem",
            fontFamily: "'Syne', sans-serif", marginBottom: "1.2rem", transition: "color 0.15s",
          }}
            onMouseEnter={e => e.target.style.color = "#aaa"} onMouseLeave={e => e.target.style.color = "#444"}>
            Reset to defaults
          </button>
        </div>

        <div style={{ marginBottom: "1.2rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>Weekly review tone</label>
          <p style={{ fontSize: "0.72rem", color: "#333", margin: "0.4rem 0 0.8rem", lineHeight: 1.6 }}>How your weekly recap talks to you. {REVIEW_TONES[tone]?.hint}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem" }}>
            {Object.entries(REVIEW_TONES).map(([key, t]) => {
              const active = tone === key;
              return (
                <button key={key} onClick={() => setTone(key)} style={{
                  ...glass, borderRadius: "10px", padding: "0.6rem", cursor: "pointer", textAlign: "left",
                  border: `1px solid ${active ? "#e8ff5a66" : "rgba(255,255,255,0.06)"}`,
                  background: active ? "rgba(232,255,90,0.08)" : glass.background,
                  color: active ? "#e8ff5a" : "#9a9aa6", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.78rem",
                  transition: "all 0.15s",
                }}>
                  {t.emoji} {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <GlassButton onClick={() => { onSave({ weights: w, reviewTone: tone }); onClose(); }} accent="#e8ff5a" style={{ width: "100%", padding: "0.9rem" }}>Save →</GlassButton>
      </div>
    </div>
  );
}
