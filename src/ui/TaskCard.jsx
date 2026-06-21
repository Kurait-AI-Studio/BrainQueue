import { useHover } from "./useHover";
import { ScoreRing } from "./ScoreRing";
import { TierBadge } from "./TierBadge";
import { calcScore, CAT_ACCENT, taskCats, RECURRENCE_LABELS, getUrgencyLabel, EFFORT_LABELS, ENERGY_LABELS, PLEASURE_LABELS, formatDate } from "../lib/tasks";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

// An active task: title + priority ring, category/tier/recurrence/effort chips,
// notes, and the row of actions (done / calendar / edit / delete). Restyled to the
// app's new clean look — flat dark card, category accent bar, Plus Jakarta Sans.
export function TaskCard({ task, onEdit, onMarkDone, onDelete, onSchedule, weights }) {
  const [hov, hovProps] = useHover();
  const score = calcScore(task, weights);
  const accent = CAT_ACCENT(task.category);

  return (
    <div {...hovProps} style={{
      background: "#16161c", border: `1px solid ${hov ? accent + "44" : "rgba(255,255,255,0.06)"}`,
      borderLeft: `3px solid ${accent}`, borderRadius: 16, padding: "1rem 1.2rem", fontFamily: FONT, color: "#ededf0",
      boxShadow: hov ? "0 10px 30px rgba(0,0,0,0.45)" : "none",
      transform: hov ? "translateY(-2px)" : "translateY(0)",
      transition: "transform 0.25s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.25s ease, border-color 0.25s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ color: "#ededf0", fontSize: "0.92rem", fontWeight: 600, lineHeight: 1.4 }}>{task.title}</span>
            <ScoreRing score={score} />
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.65rem", flexWrap: "wrap", alignItems: "center" }}>
            {taskCats(task).map(c => { const a = CAT_ACCENT(c); return (
              <span key={c} style={{ fontSize: "0.66rem", padding: "3px 9px", borderRadius: 999, background: a + "1c", color: a, border: `1px solid ${a}33`, fontWeight: 700 }}>{c}</span>
            ); })}
            {task.recurrence && task.recurrence !== "none" && <span style={{ fontSize: "0.62rem", color: "#83838f" }} title={RECURRENCE_LABELS[task.recurrence]}>🔁</span>}
            <TierBadge task={task} showEst />
            <span style={{ fontSize: "0.66rem", color: "#6a6a74" }}>{getUrgencyLabel(task.urgency)}</span>
            <span style={{ fontSize: "0.66rem", color: "#55555f" }}>⚡ {EFFORT_LABELS[task.effort]}</span>
            <span style={{ fontSize: "0.66rem", color: "#55555f" }}>🧠 {ENERGY_LABELS[task.energy]}</span>
            {task.pleasure && <span style={{ fontSize: "0.66rem", color: "#55555f" }} title={`Pleasure: ${PLEASURE_LABELS[task.pleasure]}`}>{PLEASURE_LABELS[task.pleasure].split(" ")[0]}</span>}
          </div>
          {task.notes && <p style={{ fontSize: "0.76rem", color: "#83838f", margin: "0.5rem 0 0", lineHeight: 1.5 }}>{task.notes}</p>}
          <p style={{ fontSize: "0.64rem", color: "#44444c", margin: "0.5rem 0 0" }}>Added {formatDate(task.addedAt)}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flexShrink: 0 }}>
          <button onClick={() => onMarkDone(task.id)} title="Mark done"
            style={{ background: "none", border: "none", color: "#55555f", cursor: "pointer", fontSize: "1rem", transition: "color 0.15s, transform 0.15s" }}
            onMouseEnter={e => { e.target.style.color = "#6bffb3"; e.target.style.transform = "scale(1.2)"; }}
            onMouseLeave={e => { e.target.style.color = "#55555f"; e.target.style.transform = "scale(1)"; }}>✓</button>
          <button onClick={() => onSchedule(task)} title="Add to calendar"
            style={{ background: "none", border: "none", color: "#55555f", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s, transform 0.15s" }}
            onMouseEnter={e => { e.target.style.color = "#6b9fff"; e.target.style.transform = "scale(1.2)"; }}
            onMouseLeave={e => { e.target.style.color = "#55555f"; e.target.style.transform = "scale(1)"; }}>📅</button>
          <button onClick={() => onEdit(task)} title="Edit"
            style={{ background: "none", border: "none", color: "#55555f", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color = "#aaa"} onMouseLeave={e => e.target.style.color = "#55555f"}>✏️</button>
          <button onClick={() => onDelete(task.id)} title="Delete"
            style={{ background: "none", border: "none", color: "#44444c", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color = "#ef4444"} onMouseLeave={e => e.target.style.color = "#44444c"}>🗑</button>
        </div>
      </div>
    </div>
  );
}
