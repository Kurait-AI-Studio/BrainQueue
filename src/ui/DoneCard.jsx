import { useHover } from "./useHover";
import { CAT_ACCENT, formatDate } from "../lib/tasks";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

// A completed task: dimmed, struck-through, with restore / delete-forever actions.
export function DoneCard({ task, onDelete, onRestore }) {
  const [hov, hovProps] = useHover();
  const accent = CAT_ACCENT(task.category);
  return (
    <div {...hovProps} style={{
      background: "#101015", border: "1px solid rgba(255,255,255,0.05)", borderLeft: `3px solid ${accent}44`,
      borderRadius: 16, padding: "0.9rem 1.2rem", fontFamily: FONT,
      opacity: hov ? 0.95 : 0.6, transition: "opacity 0.2s ease, transform 0.2s ease",
      transform: hov ? "translateY(-1px)" : "translateY(0)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ color: "#6a6a74", fontSize: "0.88rem", fontWeight: 600, textDecoration: "line-through", lineHeight: 1.4 }}>{task.title}</span>
            <span style={{ fontSize: "0.66rem", padding: "3px 9px", borderRadius: 999, background: accent + "12", color: accent + "99", border: `1px solid ${accent}22`, fontWeight: 700 }}>{task.category}</span>
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <p style={{ fontSize: "0.64rem", color: "#44444c" }}>Added {formatDate(task.addedAt)}</p>
            <p style={{ fontSize: "0.64rem", color: "#55555f" }}>✓ Done {formatDate(task.doneAt)}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", flexShrink: 0 }}>
          <button onClick={() => onRestore(task.id)} title="Restore"
            style={{ background: "none", border: "none", color: "#44444c", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color = "#ffb347"} onMouseLeave={e => e.target.style.color = "#44444c"}>↩</button>
          <button onClick={() => onDelete(task.id)} title="Delete forever"
            style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color = "#ef4444"} onMouseLeave={e => e.target.style.color = "#333"}>🗑</button>
        </div>
      </div>
    </div>
  );
}
