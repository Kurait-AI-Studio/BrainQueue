import { useState } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";
import { WeightSlider } from "./misc";
import { DEFAULT_WEIGHTS } from "../lib/tasks";
import { REVIEW_TONES, DEFAULT_REVIEW_TONE } from "../lib/weeklyReview";
import { CONSENT_LEVELS } from "../lib/consent";
import { getConsentState, updateConsent } from "../lib/client";

// Settings: score-weight sliders + the weekly-review tone. (Brain Dump runs through a
// server-side edge function now, so there's no user-facing API key.)
export function SettingsModal({ weights, reviewTone, onSave, onClose }) {
  const [w, setW] = useState({ ...DEFAULT_WEIGHTS, ...(weights || {}) });
  const [tone, setTone] = useState(reviewTone || DEFAULT_REVIEW_TONE);
  const [consent, setConsent] = useState(getConsentState());
  const setWField = (k, v) => setW(prev => ({ ...prev, [k]: v }));
  const total = w.urgency + w.importance + w.effort + w.energy + (w.pleasure ?? 0);
  const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "1.2rem", color: "#fff", margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
            <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>Score Weights</label>
            <span style={{ fontSize: "0.68rem", color: total === 100 ? "#6bffb3" : "#ffb347" }}>
              total: {total} {total !== 100 ? "(normalised)" : ""}
            </span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#333", marginBottom: "1.2rem", lineHeight: 1.6 }}>
            Controls what makes a task rise to the top in 🔥 Do Now. Higher weight = more influence on score.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(56px, 1fr))", gap: "0.4rem", marginBottom: "1.2rem" }}>
            {[["Urgency", w.urgency], ["Importance", w.importance], ["Quick win", w.effort], ["Low energy", w.energy], ["Pleasure", w.pleasure ?? 0]].map(([l, v]) => (
              <div key={l} style={{ ...glass, borderRadius: "10px", padding: "0.6rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.62rem", color: "#444", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", marginBottom: "0.2rem" }}>{l}</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#bef24a", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>{pct(v)}%</div>
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
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", marginBottom: "1.2rem", transition: "color 0.15s",
          }}
            onMouseEnter={e => e.target.style.color = "#aaa"} onMouseLeave={e => e.target.style.color = "#444"}>
            Reset to defaults
          </button>
        </div>

        <div style={{ marginBottom: "1.2rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>Weekly review tone</label>
          <p style={{ fontSize: "0.72rem", color: "#333", margin: "0.4rem 0 0.8rem", lineHeight: 1.6 }}>How your weekly recap talks to you. {REVIEW_TONES[tone]?.hint}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem" }}>
            {Object.entries(REVIEW_TONES).map(([key, t]) => {
              const active = tone === key;
              return (
                <button key={key} onClick={() => setTone(key)} style={{
                  ...glass, borderRadius: "10px", padding: "0.6rem", cursor: "pointer", textAlign: "left",
                  border: `1px solid ${active ? "#bef24a66" : "rgba(255,255,255,0.06)"}`,
                  background: active ? "rgba(232,255,90,0.08)" : glass.background,
                  color: active ? "#bef24a" : "#9a9aa6", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: "0.78rem",
                  transition: "all 0.15s",
                }}>
                  {t.emoji} {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: "1.2rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>Data &amp; privacy</label>
          <p style={{ fontSize: "0.72rem", color: "#333", margin: "0.4rem 0 0.8rem", lineHeight: 1.6 }}>
            Optional, and separate from your account. BrainQueue works fully at every level, and you can change this anytime. See our Privacy Policy for details.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {CONSENT_LEVELS.map((lvl) => {
              const active = consent === lvl.id;
              return (
                <button key={lvl.id} onClick={() => { setConsent(lvl.id); updateConsent(lvl.id); }} style={{
                  ...glass, borderRadius: "10px", padding: "0.7rem 0.85rem", cursor: "pointer", textAlign: "left",
                  border: `1px solid ${active ? "#bef24a66" : "rgba(255,255,255,0.06)"}`,
                  background: active ? "rgba(232,255,90,0.08)" : glass.background, transition: "all 0.15s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: "0.8rem", color: active ? "#bef24a" : "#cfcfd6" }}>
                    {lvl.label}
                    {lvl.train && <span style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", color: "#0a0a0d", background: "#bef24a", borderRadius: "5px", padding: "1px 5px", textTransform: "uppercase" }}>improves AI</span>}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "#666", lineHeight: 1.5, marginTop: "0.2rem" }}>{lvl.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>

        <GlassButton onClick={() => { onSave({ weights: w, reviewTone: tone }); onClose(); }} accent="#bef24a" style={{ width: "100%", padding: "0.9rem" }}>Save →</GlassButton>
      </div>
    </div>
  );
}
