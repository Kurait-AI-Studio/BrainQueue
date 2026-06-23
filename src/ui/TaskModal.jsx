import { useState } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";
import { GlassSlider } from "./GlassSlider";
import { TierBadge } from "./TierBadge";
import { taskCats, DEFAULT_FORM, allCategories, CAT_ACCENT, RECURRENCE_LABELS, EFFORT_LABELS, ENERGY_LABELS, PLEASURE_LABELS } from "../lib/tasks";

// Create / edit a task: title, multi-category (+ add custom), recurrence, the
// 1–5 score sliders, and a live tier badge. Calls onSave with the full task.
export function TaskModal({ task, onClose, onSave, customCategories = [], onAddCategory }) {
  const [form, setForm] = useState(() => task ? { recurrence: "none", ...task, categories: taskCats(task) } : DEFAULT_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [newCat, setNewCat] = useState("");
  const toggleCat = (c) => setForm(f => {
    const has = f.categories.includes(c);
    return { ...f, categories: has ? f.categories.filter(x => x !== c) : [...f.categories, c] };
  });
  const addCustom = () => {
    const c = newCat.trim();
    if (!c) return;
    onAddCategory?.(c);
    setForm(f => ({ ...f, categories: f.categories.includes(c) ? f.categories : [...f.categories, c] }));
    setNewCat("");
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "1.2rem", color: "#fff", margin: 0 }}>{task ? "Edit task" : "New task"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Task title…"
          style={{ width: "100%", ...glass, borderRadius: "10px", padding: "0.85rem 1rem", color: "#e8e8e8", fontSize: "0.9rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", marginBottom: "0.7rem", outline: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.2rem" }}>
          <TierBadge task={form} showEst />
          <span style={{ fontSize: "0.66rem", color: "#444" }}>auto-classified from effort & energy</span>
        </div>
        <div style={{ marginBottom: "1.3rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#666", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>Categories <span style={{ textTransform: "none", color: "#444" }}>· pick one or more</span></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {allCategories(customCategories).map(c => {
              const acc = CAT_ACCENT(c); const active = form.categories.includes(c);
              return (
                <button key={c} onClick={() => toggleCat(c)} style={{
                  padding: "0.3rem 0.8rem", borderRadius: "20px",
                  border: `1px solid ${active ? acc + "80" : "rgba(255,255,255,0.08)"}`,
                  background: active ? acc + "18" : "rgba(255,255,255,0.03)",
                  color: active ? acc : "#444", fontSize: "0.75rem", cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600,
                  boxShadow: active ? `0 0 10px ${acc}33` : "none",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
                }}>{active ? "✓ " : ""}{c}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
            <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder="+ new category…" maxLength={20}
              style={{ flex: 1, ...glass, borderRadius: "10px", padding: "0.5rem 0.75rem", color: "#e8e8e8", fontSize: "0.78rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", outline: "none", boxSizing: "border-box" }} />
            <GlassButton onClick={addCustom} style={{ padding: "0.5rem 0.9rem", fontSize: "0.75rem" }}>Add</GlassButton>
          </div>
        </div>
        <div style={{ marginBottom: "1.3rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#666", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>Repeat</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {Object.entries(RECURRENCE_LABELS).map(([k, label]) => {
              const active = (form.recurrence || "none") === k;
              return (
                <button key={k} onClick={() => set("recurrence", k)} style={{
                  padding: "0.3rem 0.8rem", borderRadius: "20px",
                  border: `1px solid ${active ? "rgba(232,255,90,0.6)" : "rgba(255,255,255,0.08)"}`,
                  background: active ? "rgba(232,255,90,0.14)" : "rgba(255,255,255,0.03)",
                  color: active ? "#bef24a" : "#444", fontSize: "0.75rem", cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600, transition: "all 0.15s",
                }}>{label}</button>
              );
            })}
          </div>
        </div>
        <GlassSlider label="Urgency" value={form.urgency} onChange={v => set("urgency", v)} sublabels={{ 1: "Someday", 2: "Eventually", 3: "This month", 4: "This week", 5: "TODAY" }} />
        <GlassSlider label="Importance" value={form.importance} onChange={v => set("importance", v)} sublabels={{ 1: "Nice to have", 2: "Low", 3: "Medium", 4: "High", 5: "Critical" }} />
        <GlassSlider label="Effort" value={form.effort} onChange={v => set("effort", v)} sublabels={EFFORT_LABELS} />
        <GlassSlider label="Energy needed" value={form.energy} onChange={v => set("energy", v)} sublabels={ENERGY_LABELS} />
        <GlassSlider label="Pleasure" value={form.pleasure ?? 3} onChange={v => set("pleasure", v)} sublabels={PLEASURE_LABELS} />
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes…"
          style={{ width: "100%", ...glass, borderRadius: "10px", padding: "0.75rem 1rem", color: "#888", fontSize: "0.82rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", resize: "none", height: "64px", outline: "none", marginBottom: "1.2rem", boxSizing: "border-box" }} />
        <GlassButton onClick={() => { if (form.title.trim() && form.categories.length) onSave({ ...form, category: form.categories[0], id: task?.id || Date.now(), done: task?.done || false, addedAt: task?.addedAt || new Date().toISOString(), doneAt: task?.doneAt || null }); }} accent="#bef24a" style={{ width: "100%", padding: "0.9rem", fontSize: "0.9rem" }}>
          Save task →
        </GlassButton>
      </div>
    </div>
  );
}
