import { ScoreRing } from "./ScoreRing";
import { TierBadge } from "./TierBadge";
import { calcScore, CAT_ACCENT, taskCats, RECURRENCE_LABELS, getUrgencyLabel, EFFORT_LABELS, ENERGY_LABELS, PLEASURE_LABELS, formatDate } from "../lib/tasks";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const PANEL = "#14141a", BORDER = "rgba(255,255,255,0.07)", TXT = "#ededf0", MUTE = "#83838f", FAINT = "#55555f", GREEN = "#bef24a";

function DimRow({ icon, label, value, color, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
      <span style={{ width: 92, flexShrink: 0, fontSize: "0.72rem", color: MUTE, fontWeight: 600 }}>{icon} {label}</span>
      <div style={{ display: "flex", gap: 3, flex: 1 }}>
        {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ flex: 1, height: 7, borderRadius: 2, background: i <= value ? color : "rgba(255,255,255,0.07)" }} />)}
      </div>
      <span style={{ width: 96, flexShrink: 0, textAlign: "right", fontSize: "0.72rem", color: TXT, fontWeight: 600 }}>{text}</span>
    </div>
  );
}
function Pill({ children }) {
  return <span style={{ fontSize: "0.72rem", color: MUTE, fontWeight: 600, padding: "0.32rem 0.7rem", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>{children}</span>;
}

// A wide, read-first detail panel for one task — every dimension, the classification,
// notes and dates, plus actions including adding it to the focus session.
export function TaskDetailModal({ task, weights, inSession, onClose, onEdit, onMarkDone, onDelete, onSchedule, onAddToSession, onFocusNow }) {
  if (!task) return null;
  const score = calcScore(task, weights);
  const cats = taskCats(task);
  const action = (label, onClick, color = TXT, bg = "rgba(255,255,255,0.04)", border = BORDER) => (
    <button onClick={onClick} style={{ flex: "1 1 auto", padding: "0.7rem 0.9rem", borderRadius: 12, border: `1px solid ${border}`, background: bg, color, cursor: "pointer", fontFamily: FONT, fontWeight: 700, fontSize: "0.82rem", whiteSpace: "nowrap" }}>{label}</button>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(4,4,8,0.66)", backdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: "1rem", fontFamily: FONT }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');`}</style>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 660, maxHeight: "88vh", overflow: "auto", background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "1.6rem 1.7rem", color: TXT, boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            {cats.map(c => { const a = CAT_ACCENT(c); return <span key={c} style={{ fontSize: "0.68rem", padding: "3px 10px", borderRadius: 999, background: a + "1c", color: a, border: `1px solid ${a}33`, fontWeight: 700 }}>{c}</span>; })}
            <TierBadge task={task} showEst />
          </div>
          <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: MUTE, cursor: "pointer", fontSize: "1.2rem", flexShrink: 0, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.4rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.25 }}>{task.title}</h2>
          <div style={{ flexShrink: 0, transform: "scale(1.35)", transformOrigin: "top right", marginTop: 4 }}><ScoreRing score={score} /></div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.3rem" }}>
          <DimRow icon="🔥" label="Urgency" value={task.urgency} color="#ff6b6b" text={getUrgencyLabel(task.urgency)} />
          <DimRow icon="🎯" label="Importance" value={task.importance} color={GREEN} text={`${task.importance ?? "—"}/5`} />
          <DimRow icon="⚡" label="Effort" value={task.effort} color="#f5b13a" text={EFFORT_LABELS[task.effort] || "—"} />
          <DimRow icon="🧠" label="Energy" value={task.energy} color="#c47bff" text={ENERGY_LABELS[task.energy] || "—"} />
          {task.pleasure ? <DimRow icon="💗" label="Pleasure" value={task.pleasure} color="#ff8fd0" text={PLEASURE_LABELS[task.pleasure] || "—"} /> : null}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: task.notes ? "1.3rem" : "1.4rem" }}>
          {task.est_minutes ? <Pill>⏱ {task.est_minutes} min</Pill> : null}
          {task.cognitive_load ? <Pill>🧩 Load {task.cognitive_load}/5</Pill> : null}
          {task.recurrence && task.recurrence !== "none" ? <Pill>🔁 {RECURRENCE_LABELS[task.recurrence] || task.recurrence}</Pill> : null}
          {task.multi_step ? <Pill>🪜 Multi-step</Pill> : null}
          {task.ai_delegatable ? <Pill>🤖 AI-delegatable</Pill> : null}
        </div>

        {task.notes ? (
          <div style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}`, borderRadius: 13, padding: "0.85rem 1rem", marginBottom: "1.4rem" }}>
            <div style={{ fontSize: "0.64rem", color: FAINT, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Notes</div>
            <p style={{ margin: 0, fontSize: "0.86rem", color: "#c8c8d0", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{task.notes}</p>
          </div>
        ) : null}

        <p style={{ fontSize: "0.68rem", color: FAINT, margin: "0 0 1.3rem" }}>Added {formatDate(task.addedAt)}{task.scheduledAt ? ` · Scheduled ${formatDate(task.scheduledAt)}` : ""}</p>

        {/* Session / focus actions */}
        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
          {onAddToSession && action(inSession ? "✓ In your session" : "＋ Add to session", () => onAddToSession(task), inSession ? "#0a0a0d" : GREEN, inSession ? GREEN : GREEN + "1a", GREEN + "55")}
          {onFocusNow && action("▶ Focus on this now", () => onFocusNow(task), "#0a0a0d", "#6bffb3", "#6bffb3")}
        </div>
        {/* Task actions */}
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          {onMarkDone && action("✓ Mark done", () => onMarkDone(task.id))}
          {onEdit && action("✎ Edit", () => onEdit(task))}
          {onSchedule && action("📅 Schedule", () => onSchedule(task))}
          {onDelete && action("🗑 Delete", () => onDelete(task.id), "#ff6b6b", "rgba(255,107,107,0.08)", "rgba(255,107,107,0.25)")}
        </div>
      </div>
    </div>
  );
}
