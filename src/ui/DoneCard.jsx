import { glass } from "./tokens";
import { useHover } from "./useHover";
import { CAT_ACCENT, formatDate } from "../lib/tasks";

// A completed task: dimmed, struck-through, with restore / delete-forever actions.
export function DoneCard({ task, onDelete, onRestore }) {
  const [hov, hovProps] = useHover();
  const accent = CAT_ACCENT(task.category);
  return (
    <div {...hovProps} style={{
      ...glass, borderRadius: "16px", padding: "0.9rem 1.2rem",
      opacity: hov ? 0.9 : 0.55,
      borderLeft: `2px solid ${accent}33`,
      transition: "opacity 0.2s ease, transform 0.2s ease",
      transform: hov ? "translateY(-1px)" : "translateY(0)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ color: "#555", fontSize: "0.88rem", fontWeight: 600, textDecoration: "line-through", lineHeight: 1.4 }}>{task.title}</span>
            <span style={{ fontSize: "0.67rem", padding: "2px 8px", borderRadius: "20px", background: accent + "10", color: accent + "99", border: `1px solid ${accent}20`, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{task.category}</span>
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <p style={{ fontSize: "0.64rem", color: "#2e2e2e", fontFamily: "'DM Mono', monospace" }}>Added {formatDate(task.addedAt)}</p>
            <p style={{ fontSize: "0.64rem", color: "#3a3a3a", fontFamily: "'DM Mono', monospace" }}>✓ Done {formatDate(task.doneAt)}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flexShrink: 0 }}>
          <button onClick={() => onRestore(task.id)} title="Restore"
            style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ffb347"} onMouseLeave={e => e.target.style.color="#2a2a2a"}>↩</button>
          <button onClick={() => onDelete(task.id)} title="Delete forever"
            style={{ background: "none", border: "none", color: "#1e1e1e", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ef4444"} onMouseLeave={e => e.target.style.color="#1e1e1e"}>🗑</button>
        </div>
      </div>
    </div>
  );
}
