import { TIER, taskTier, fmtDuration } from "../lib/tasks";

// A pill showing a task's reflex/standard/heavy tier (and optionally its estimate).
export function TierBadge({ task, showEst = false }) {
  const { label, icon, color } = TIER[taskTier(task)];
  const est = task.est_minutes;
  return (
    <span title={`${label} task${est ? ` · ~${fmtDuration(est)}` : ""}${task.ai_delegatable ? " · AI can help" : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6rem", padding: "2px 7px", borderRadius: "20px",
        background: color + "18", color, border: `1px solid ${color}30`, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700 }}>
      {icon} {label}{showEst && est ? ` · ${fmtDuration(est)}` : ""}{task.ai_delegatable ? " · 🤖" : ""}
    </span>
  );
}
