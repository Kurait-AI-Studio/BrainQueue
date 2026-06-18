import { glass } from "./tokens";
import { useHover } from "./useHover";
import { ScoreRing } from "./ScoreRing";
import { TierBadge } from "./TierBadge";
import { calcScore, CAT_ACCENT, CAT_GLOW, taskCats, RECURRENCE_LABELS, getUrgencyLabel, EFFORT_LABELS, ENERGY_LABELS, PLEASURE_LABELS, formatDate } from "../lib/tasks";

// An active task: title + priority ring, category/tier/recurrence/effort chips,
// notes, and the row of actions (done / calendar / edit / delete).
export function TaskCard({ task, onEdit, onMarkDone, onDelete, onSchedule, weights }) {
  const [hov, hovProps] = useHover();
  const score = calcScore(task, weights);
  const accent = CAT_ACCENT(task.category);
  const glowRgb = CAT_GLOW(taskCats(task)[0] || task.category);

  return (
    <div {...hovProps} style={{
      ...glass,
      borderRadius: "16px",
      padding: "1rem 1.2rem",
      borderLeft: `2px solid ${accent}88`,
      boxShadow: hov
        ? `0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(${glowRgb},0.12), inset 0 1px 0 rgba(255,255,255,0.1)`
        : glass.boxShadow,
      transform: hov ? "translateY(-2px)" : "translateY(0)",
      transition: "transform 0.25s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.25s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ color: "#e8e8e8", fontSize: "0.9rem", fontWeight: 600, lineHeight: 1.4 }}>{task.title}</span>
            <ScoreRing score={score} />
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            {taskCats(task).map(c => { const a = CAT_ACCENT(c); return (
              <span key={c} style={{ fontSize: "0.67rem", padding: "2px 8px", borderRadius: "20px", background: a + "18", color: a, border: `1px solid ${a}30`, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{c}</span>
            ); })}
            {task.recurrence && task.recurrence !== "none" && <span style={{ fontSize: "0.6rem", color: "#888" }} title={RECURRENCE_LABELS[task.recurrence]}>🔁</span>}
            <TierBadge task={task} showEst />
            <span style={{ fontSize: "0.67rem", color: "#555" }}>{getUrgencyLabel(task.urgency)}</span>
            <span style={{ fontSize: "0.67rem", color: "#444" }}>⚡ {EFFORT_LABELS[task.effort]}</span>
            <span style={{ fontSize: "0.67rem", color: "#444" }}>🧠 {ENERGY_LABELS[task.energy]}</span>
            {task.pleasure && <span style={{ fontSize: "0.67rem", color: "#444" }} title={`Pleasure: ${PLEASURE_LABELS[task.pleasure]}`}>{PLEASURE_LABELS[task.pleasure].split(" ")[0]}</span>}
          </div>
          {task.notes && <p style={{ fontSize: "0.74rem", color: "#4a4a4a", margin: "0.4rem 0 0", lineHeight: 1.5 }}>{task.notes}</p>}
          <p style={{ fontSize: "0.65rem", color: "#2e2e2e", margin: "0.5rem 0 0", fontFamily: "'DM Mono', monospace" }}>Added {formatDate(task.addedAt)}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flexShrink: 0 }}>
          <button onClick={() => onMarkDone(task.id)} title="Mark done"
            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: "1rem", transition: "color 0.15s, transform 0.15s" }}
            onMouseEnter={e => { e.target.style.color="#6bffb3"; e.target.style.transform="scale(1.2)"; }}
            onMouseLeave={e => { e.target.style.color="#3a3a3a"; e.target.style.transform="scale(1)"; }}>✓</button>
          <button onClick={() => onSchedule(task)} title="Add to calendar"
            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s, transform 0.15s" }}
            onMouseEnter={e => { e.target.style.color="#6b9fff"; e.target.style.transform="scale(1.2)"; }}
            onMouseLeave={e => { e.target.style.color="#3a3a3a"; e.target.style.transform="scale(1)"; }}>📅</button>
          <button onClick={() => onEdit(task)} title="Edit"
            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#aaa"} onMouseLeave={e => e.target.style.color="#3a3a3a"}>✏️</button>
          <button onClick={() => onDelete(task.id)} title="Delete"
            style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ef4444"} onMouseLeave={e => e.target.style.color="#2a2a2a"}>🗑</button>
        </div>
      </div>
    </div>
  );
}
