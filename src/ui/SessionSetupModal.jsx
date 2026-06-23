import { useState } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";
import { SessionStepper } from "./widgets";
import { TierBadge } from "./TierBadge";
import { buildProposals, taskCats, CAT_ACCENT, fmtDuration } from "../lib/tasks";

// Start a focus session: pick a ready-made task set, tweak it (search +
// category filter), set focus/break minutes, then onStart({ taskIds, work, brk }).
export function SessionSetupModal({ tasks, onStart, onClose }) {
  const proposals = buildProposals(tasks);
  const [mode, setMode] = useState("sets");           // sets | edit
  const [picked, setPicked] = useState(() => proposals[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState(() => new Set((proposals[0]?.items || []).map(t => t.id)));
  const [work, setWork] = useState(25);
  const [brk, setBrk] = useState(5);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const selectProposal = (p) => { setPicked(p.id); setSelectedIds(new Set(p.items.map(t => t.id))); };
  const toggle = (id) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedTasks = tasks.filter(t => selectedIds.has(t.id));
  const totalMin = selectedTasks.reduce((s, t) => s + (t.est_minutes || 25), 0);
  const cats = ["All", ...new Set(tasks.flatMap(taskCats))];
  const visible = tasks.filter(t =>
    (catFilter === "All" || taskCats(t).includes(catFilter)) &&
    (!search.trim() || t.title.toLowerCase().includes(search.toLowerCase())));
  const start = () => { const ids = [...selectedIds]; if (ids.length) onStart({ taskIds: ids, work, brk }); };

  const taskRow = (t) => {
    const on = selectedIds.has(t.id);
    return (
      <button key={t.id} onClick={() => toggle(t.id)} style={{
        ...glass, borderRadius: "10px", padding: "0.6rem 0.8rem", display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", textAlign: "left", width: "100%",
        border: `1px solid ${on ? "rgba(232,255,90,0.5)" : "rgba(255,255,255,0.07)"}`, background: on ? "rgba(232,255,90,0.1)" : "rgba(255,255,255,0.03)",
      }}>
        <span style={{ color: on ? "#bef24a" : "#444", fontSize: "0.95rem" }}>{on ? "✓" : "○"}</span>
        <span style={{ flex: 1, minWidth: 0, color: "#ddd", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
        <TierBadge task={t} showEst />
      </button>
    );
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem", backdropFilter: "blur(8px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ ...glassStrong, borderRadius: "24px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflow: "auto", padding: "2.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "1.5rem", color: "#fff", margin: 0 }}>▶ Start a focus session</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.6rem", cursor: "pointer" }}>×</button>
        </div>

        {tasks.length === 0 ? (
          <p style={{ color: "#666", fontSize: "0.9rem", padding: "2rem 0", textAlign: "center" }}>No active tasks yet — add some first.</p>
        ) : mode === "sets" ? (
          <>
            <p style={{ color: "#777", fontSize: "0.86rem", margin: "0.3rem 0 1.4rem" }}>Pick a set and go — tweak it only if you want to.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.7rem", marginBottom: "1.6rem" }}>
              {proposals.map(p => {
                const on = picked === p.id;
                const mins = p.items.reduce((s, t) => s + (t.est_minutes || 25), 0);
                return (
                  <button key={p.id} onClick={() => selectProposal(p)} style={{
                    ...glass, borderRadius: "16px", padding: "1rem 1.1rem", cursor: "pointer", textAlign: "left",
                    border: `1px solid ${on ? "rgba(232,255,90,0.55)" : "rgba(255,255,255,0.08)"}`,
                    background: on ? "rgba(232,255,90,0.09)" : "rgba(255,255,255,0.03)",
                    boxShadow: on ? "0 0 22px rgba(232,255,90,0.12)" : "none", transition: "all 0.18s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "1.05rem", color: on ? "#bef24a" : "#eee" }}>{p.icon} {p.name}</span>
                      {on && <span style={{ color: "#bef24a", fontSize: "0.9rem" }}>✓</span>}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#888", marginTop: "0.25rem" }}>{p.desc}</div>
                    <div style={{ fontSize: "0.68rem", color: "#555", marginTop: "0.6rem" }}>{p.items.length} task{p.items.length === 1 ? "" : "s"} · ~{fmtDuration(mins)}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "0.74rem", color: "#888", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                {selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"} selected · ~{fmtDuration(totalMin)}
              </span>
              <button onClick={() => setMode("edit")} style={{ ...glass, borderRadius: "20px", padding: "0.35rem 0.9rem", color: "#6b9fff", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, fontSize: "0.74rem", border: "1px solid rgba(107,159,255,0.3)" }}>✎ Modify set</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.5rem", maxHeight: "180px", overflow: "auto" }}>
              {selectedTasks.length === 0 ? <p style={{ color: "#555", fontSize: "0.8rem" }}>Nothing selected — pick a set or modify.</p> : selectedTasks.map(taskRow)}
            </div>

            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem" }}>
              <SessionStepper label="Focus" value={work} set={setWork} min={5} max={90} />
              <SessionStepper label="Break" value={brk} set={setBrk} min={5} max={30} />
            </div>
            <GlassButton onClick={start} disabled={!selectedTasks.length} accent="#bef24a" style={{ width: "100%", padding: "1rem", fontSize: "0.95rem" }}>Enter focus →</GlassButton>
          </>
        ) : (
          <>
            <p style={{ color: "#777", fontSize: "0.86rem", margin: "0.3rem 0 1rem" }}>Search or filter by category, then tap tasks to add or remove.</p>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…" autoFocus
              style={{ width: "100%", ...glass, borderRadius: "12px", padding: "0.8rem 1rem", color: "#e8e8e8", fontSize: "0.88rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", outline: "none", boxSizing: "border-box", marginBottom: "0.8rem" }} />
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {cats.map(c => {
                const acc = c === "All" ? "#bef24a" : CAT_ACCENT(c); const on = catFilter === c;
                return (
                  <button key={c} onClick={() => setCatFilter(c)} style={{
                    padding: "0.28rem 0.75rem", borderRadius: "20px", cursor: "pointer", fontSize: "0.72rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600,
                    border: `1px solid ${on ? acc + "70" : "rgba(255,255,255,0.07)"}`, background: on ? acc + "16" : "transparent", color: on ? acc : "#555",
                  }}>{c}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.3rem", maxHeight: "300px", overflow: "auto" }}>
              {visible.length === 0 ? <p style={{ color: "#555", fontSize: "0.8rem" }}>No matching tasks.</p> : visible.map(taskRow)}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <span style={{ flex: 1, fontSize: "0.74rem", color: "#888", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>{selectedTasks.length} selected · ~{fmtDuration(totalMin)}</span>
              <GlassButton onClick={() => { setPicked(null); setMode("sets"); }} accent="#bef24a" style={{ padding: "0.7rem 1.6rem" }}>Done →</GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
