import { useState, useEffect } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";

// ─── Small shared components ──────────────────────────────────────────────────

// Compact −/value/+ stepper for a 1–5 dimension (used in the Brain Dump preview).
export function Dim({ label, value, onChange }) {
  const step = (d) => onChange(Math.min(5, Math.max(1, value + d)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.62rem", color: "#555", fontFamily: "'Syne', sans-serif", width: "14px" }}>{label}</span>
      <button onClick={() => step(-1)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: "0 2px" }}>−</button>
      <span style={{ fontSize: "0.7rem", color: "#aaa", width: "10px", textAlign: "center" }}>{value}</span>
      <button onClick={() => step(1)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: "0 2px" }}>+</button>
    </div>
  );
}

// A 0–100 weight slider (settings) with a label, description, and live value.
export function WeightSlider({ label, value, onChange, description }) {
  return (
    <div style={{ marginBottom: "1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <div>
          <span style={{ fontSize: "0.78rem", color: "#aaa", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: "0.68rem", color: "#444", marginLeft: "0.5rem" }}>{description}</span>
        </div>
        <span style={{ fontSize: "0.8rem", color: "#e8ff5a", fontWeight: 700, fontFamily: "'Syne', sans-serif", minWidth: "32px", textAlign: "right" }}>{value}</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: "100%" }} />
    </div>
  );
}

// An empty view: directive copy per view + a CTA, so it invites action.
export function EmptyState({ view, filterCat, onAdd, onDump }) {
  const c = [
    { icon: "🔥", title: "Nothing urgent right now", sub: "Capture what's on your mind, or paste a messy note and let Brain Dump sort it into scored tasks." },
    { icon: "⚡", title: "No quick wins queued", sub: "Short, high-impact tasks land here. Add a couple to build momentum." },
    { icon: "🧠", title: "No low-energy tasks", sub: "Tasks you can do on empty show up here — add one for your tired hours." },
    { icon: "🗂", title: filterCat === "All" ? "No active tasks" : `Nothing in ${filterCat}`, sub: "Add a task or capture a brain dump to fill this up." },
    { icon: "🏆", title: "No finished tasks yet", sub: "Complete a task and it'll show up here — with the XP you earned." },
  ][view] || { icon: "∅", title: "Nothing here yet", sub: "" };
  return (
    <div style={{ textAlign: "center", padding: "4.5rem 1rem", maxWidth: "400px", margin: "0 auto" }}>
      <div style={{ fontSize: "2.2rem", marginBottom: "1rem" }}>{c.icon}</div>
      <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#d8d8e0", margin: 0 }}>{c.title}</h3>
      {c.sub && <p style={{ color: "#555", fontSize: "0.82rem", lineHeight: 1.65, marginTop: "0.6rem" }}>{c.sub}</p>}
      {view !== 4 && (
        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <GlassButton onClick={onAdd} accent="#e8ff5a" style={{ padding: "0.6rem 1.1rem" }}>+ Add task</GlassButton>
          <GlassButton onClick={onDump} style={{ padding: "0.6rem 1.1rem" }}>✨ Brain Dump</GlassButton>
        </div>
      )}
    </div>
  );
}

// Inline "+ category" pill for the main category bar (Enter or + to add).
export function InlineCatAdd({ onAdd }) {
  const [v, setV] = useState("");
  const add = () => { const c = v.trim(); if (c) { onAdd(c); setV(""); } };
  return (
    <span style={{ display: "inline-flex", gap: "0.25rem", alignItems: "center" }}>
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }}
        placeholder="+ new category" maxLength={20}
        style={{ ...glass, borderRadius: "20px", padding: "0.26rem 0.7rem", color: "#e8e8e8", fontSize: "0.72rem", fontFamily: "'DM Mono', monospace", outline: "none", width: "130px", boxSizing: "border-box" }} />
      {v.trim() && <button onClick={add} style={{ ...glass, borderRadius: "20px", padding: "0.26rem 0.6rem", color: "#e8ff5a", cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.72rem", border: "1px solid rgba(232,255,90,0.3)" }}>Add</button>}
    </span>
  );
}

// Auto-dismissing notice (success/error) anchored to the bottom of the screen.
export function Toast({ toast, onDone }) {
  useEffect(() => { const id = setTimeout(onDone, 4500); return () => clearTimeout(id); }, [toast, onDone]);
  const ok = toast.type === "success";
  return (
    <div onClick={onDone} style={{
      position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 200,
      ...glassStrong, borderRadius: "14px", padding: "0.85rem 1.2rem", maxWidth: "90vw", cursor: "pointer",
      border: `1px solid ${ok ? "rgba(107,255,179,0.4)" : "rgba(255,107,107,0.4)"}`,
      display: "flex", alignItems: "center", gap: "0.6rem",
      animation: "fadeUp 0.3s cubic-bezier(0.34,1.2,0.64,1) both",
    }}>
      <span style={{ fontSize: "1rem" }}>{ok ? "✓" : "⚠️"}</span>
      <span style={{ fontSize: "0.8rem", color: ok ? "#cfe" : "#fcc", fontFamily: "'DM Mono', monospace" }}>{toast.msg}</span>
    </div>
  );
}

// The signed-in user's avatar + name chip (reads the Supabase session's metadata).
export function UserChip({ session }) {
  const u = session.user;
  const avatar = u.user_metadata?.avatar_url || u.user_metadata?.picture;
  const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email || "Account";
  return (
    <div title={u.email || name} style={{
      ...glass, display: "flex", alignItems: "center", gap: "0.4rem",
      borderRadius: "20px", padding: "0.25rem 0.7rem 0.25rem 0.3rem", maxWidth: "180px",
    }}>
      {avatar
        ? <img src={avatar} alt="" referrerPolicy="no-referrer" style={{ width: "22px", height: "22px", borderRadius: "50%" }} />
        : <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(232,255,90,0.18)", color: "#e8ff5a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>{(name[0] || "?").toUpperCase()}</span>}
      <span style={{ fontSize: "0.72rem", color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </div>
  );
}
