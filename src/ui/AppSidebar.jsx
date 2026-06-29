// The app's persistent left rail (desktop) / drawer (mobile). Shared shell chrome —
// the same look as the Focus Mode screen — wired to the app's views & modals via onNav.
import { totalXP } from "../lib/tasks";
import { levelForXp } from "../lib/xp";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const BORDER = "rgba(255,255,255,0.06)";
const GREEN = "#bef24a", TXT = "#ededf0", MUTE = "#83838f", FAINT = "#55555f";

const NAV = [
  { id: "capture", icon: "📥", label: "Capture" },
  { id: "focus", icon: "🎯", label: "Focus Mode" },
  { id: "tasks", icon: "📋", label: "All Tasks" },
  { id: "analytics", icon: "📊", label: "Analytics" },
  { id: "rewards", icon: "🏆", label: "Rewards" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];
const NAV_IDLE = "#b6b6c2"; // clearer than the dim grey for inactive items

export function AppSidebar({ session, tasks = [], active = "tasks", open, onClose, onNav, onAddTask, onSignOut, pendingCaptures = 0 }) {
  const lv = levelForXp(totalXP(tasks));
  const name = session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "You";
  const initial = name[0]?.toUpperCase() || "Y";
  const pick = (id) => { onNav?.(id); onClose?.(); };

  return (
    <>
      {open && <div className="app-backdrop" onClick={onClose} />}
      <aside className={`app-sidebar${open ? " open" : ""}`} style={{ fontFamily: FONT, color: TXT }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0.5rem", marginBottom: "1.6rem" }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: GREEN, display: "grid", placeItems: "center", color: "#0a0a0d", fontWeight: 900, fontSize: "0.9rem" }}>✦</span>
          <span style={{ fontWeight: 800, fontSize: "1.08rem", letterSpacing: "-0.02em" }}>Brain<span style={{ color: GREEN }}>Queue</span></span>
        </div>

        <button onClick={() => { onAddTask?.(); onClose?.(); }} style={{ width: "100%", padding: "0.72rem", borderRadius: 12, border: "none", background: GREEN, color: "#0a0a0d", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", fontFamily: FONT, marginBottom: "1.7rem" }}>+ Add task</button>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map(n => {
            const on = active === n.id;
            return (
              <div key={n.id} onClick={() => pick(n.id)} style={{
                position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0.7rem 0.8rem", borderRadius: 11, cursor: "pointer",
                fontSize: "0.88rem", fontWeight: on ? 700 : 600, color: on ? GREEN : NAV_IDLE, background: on ? GREEN + "1c" : "transparent",
              }}>
                {on && <span style={{ position: "absolute", left: -9, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, borderRadius: 2, background: GREEN }} />}
                <span style={{ fontSize: "1.05rem", width: 20, textAlign: "center" }}>{n.icon}</span>{n.label}
                {n.id === "capture" && pendingCaptures > 0 && (
                  <span style={{ marginLeft: "auto", background: GREEN, color: "#0a0a0d", fontSize: "0.62rem", fontWeight: 800, borderRadius: 99, padding: "1px 7px", lineHeight: 1.4 }}>{pendingCaptures}</span>
                )}
              </div>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 10, padding: "0.85rem 0.5rem 0", borderTop: `1px solid ${BORDER}` }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${GREEN}, #6bffb3)`, display: "grid", placeItems: "center", fontWeight: 800, color: "#0a0a0d", fontSize: "0.95rem", flexShrink: 0 }}>{initial}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.83rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, margin: "4px 0 3px", overflow: "hidden" }}>
              <div style={{ width: `${lv.pct}%`, height: "100%", background: GREEN, borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: "0.62rem", color: FAINT }}>Level {lv.level} · {lv.title}</div>
          </div>
          {onSignOut && (
            <button onClick={onSignOut} title="Sign out" style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "0.35rem 0.5rem", color: MUTE, cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}>⏻</button>
          )}
        </div>
      </aside>
    </>
  );
}
