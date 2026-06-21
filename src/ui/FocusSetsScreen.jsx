// Full-screen "Focus Mode" — AI-proposed focus sets with per-set XP and the bonus
// reward strip. Presentational: driven by real tasks (buildProposals + taskXP) and the
// canonical XP curve. Choosing a set hands its task ids to onStart() to enter a session.
import { buildProposals, taskCats, taskXP, totalXP, CAT_ACCENT, fmtDuration } from "../lib/tasks";
import { levelForXp, BONUSES } from "../lib/xp";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const BG = "#09090c", PANEL = "#0e0e12", CARD = "#16161c", BORDER = "rgba(255,255,255,0.06)";
const GREEN = "#bef24a", TXT = "#ededf0", MUTE = "#83838f", FAINT = "#55555f";

// proposal id → accent theme
const ACCENT = { donow: GREEN, quick: "#f5b13a", deep: "#b388ff", easy: "#6b9fff" };
const CAT_EMOJI = { Health: "💪", Work: "💼", Admin: "🗂", Social: "💬", Finance: "💰", Learning: "📚", Personal: "🌿" };
const NAV = [
  { icon: "◎", label: "Focus Mode", active: true },
  { icon: "≡", label: "All Tasks" },
  { icon: "◔", label: "Analytics" },
  { icon: "♦", label: "Rewards" },
  { icon: "⚙", label: "Settings" },
];
const avg = (arr, f) => (arr.length ? Math.round(arr.reduce((s, t) => s + (f(t) || 0), 0) / arr.length) : 0);

function Bars({ value, color }) {
  return (
    <div style={{ display: "flex", gap: 2.5, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ width: 4, height: 9, borderRadius: 1.5, background: i <= value ? color : "rgba(255,255,255,0.09)" }} />
      ))}
    </div>
  );
}
function Tile({ icon, label, value, color, text }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.55rem 0.5rem", textAlign: "center" }}>
      <div style={{ fontSize: "0.8rem", marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: "0.56rem", color: FAINT, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 5, whiteSpace: "nowrap" }}>{label}</div>
      {text ? <div style={{ fontSize: "0.7rem", fontWeight: 700, color: TXT }}>{text}</div> : <Bars value={value} color={color} />}
    </div>
  );
}

function SetCard({ set, onChoose }) {
  const a = set.accent;
  return (
    <div style={{
      borderRadius: 22, padding: "1.5rem 1.35rem", display: "flex", flexDirection: "column", flex: 1, minWidth: 0,
      background: `linear-gradient(180deg, ${a}12 0%, ${CARD} 38%, ${CARD} 100%)`,
      border: `1px solid ${set.featured ? a + "55" : BORDER}`,
      boxShadow: set.featured ? `0 0 34px ${a}1a` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <h3 style={{ fontSize: "1.18rem", fontWeight: 700, color: TXT, margin: 0, letterSpacing: "-0.015em" }}>{set.icon} {set.name}</h3>
        <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, padding: "0.32rem 0.6rem", borderRadius: 999, background: a + "1c", border: `1px solid ${a}40`, color: a, fontWeight: 800, fontSize: "0.72rem", whiteSpace: "nowrap" }}>✦ {set.xp} XP</span>
      </div>
      <p style={{ fontSize: "0.81rem", color: MUTE, margin: "0.5rem 0 1.25rem", lineHeight: 1.5, minHeight: 36 }}>{set.desc}</p>

      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem" }}>
        <Tile icon="🔥" label="Urgency" value={set.urgency} color="#ff6b6b" />
        <Tile icon="💗" label="Pleasure" value={set.pleasure} color="#ff8fd0" />
        <Tile icon="⏱" label="Duration" text={set.duration} />
        <Tile icon="🧠" label="Energy" value={set.energy} color="#c47bff" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.4rem", flex: 1 }}>
        {set.tasks.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.7rem", background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}`, borderRadius: 13, padding: "0.6rem 0.7rem" }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, display: "grid", placeItems: "center", background: t.color + "22", fontSize: "0.9rem", flexShrink: 0 }}>{t.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.83rem", color: TXT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</div>
              <div style={{ fontSize: "0.66rem", color: FAINT, marginTop: 1 }}>{t.sub}</div>
            </div>
            <span style={{ fontSize: "0.72rem", color: MUTE, fontWeight: 700, flexShrink: 0 }}>{t.min} min</span>
          </div>
        ))}
      </div>

      <button onClick={onChoose} style={{
        width: "100%", padding: "0.82rem", borderRadius: 13, cursor: "pointer", fontFamily: FONT, fontWeight: 700, fontSize: "0.86rem",
        border: set.featured ? "none" : `1px solid ${a}55`, background: set.featured ? a : a + "14", color: set.featured ? "#0a0a0d" : a,
      }}>Choose This Set</button>
    </div>
  );
}

export function FocusSetsScreen({ tasks = [], session, onStart, onExit }) {
  const active = tasks.filter(t => !t.done);
  const proposals = buildProposals(active).slice(0, 3).map((p, i) => {
    const a = ACCENT[p.id] || GREEN;
    return {
      ...p, accent: a, featured: i === 0,
      urgency: avg(p.items, t => t.urgency),
      pleasure: avg(p.items, t => t.pleasure ?? 3),
      energy: avg(p.items, t => t.cognitive_load ?? t.energy ?? 3),
      duration: fmtDuration(p.items.reduce((s, t) => s + (t.est_minutes || 25), 0)),
      xp: p.items.reduce((s, t) => s + taskXP(t), 0),
      tasks: p.items.map(t => {
        const cat = taskCats(t)[0] || "Personal";
        return { id: t.id, title: t.title, sub: cat, min: t.est_minutes || 25, color: CAT_ACCENT(cat), emoji: CAT_EMOJI[cat] || "◆" };
      }),
    };
  });

  const lv = levelForXp(totalXP(tasks));
  const name = session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "You";
  const initial = name[0]?.toUpperCase() || "Y";
  const go = (label) => { if (label !== "Focus Mode" && label !== "Rewards") onExit?.(); };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", background: BG, color: TXT, fontFamily: FONT, overflow: "hidden" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @media (max-width: 760px) {
          .fss-aside { display: none !important; }
          .fss-main { padding: 1.3rem 1.05rem !important; }
          .fss-title { font-size: 1.4rem !important; }
          .fss-cards { flex-direction: column !important; }
          .fss-bonus { flex-wrap: wrap !important; }
          .fss-bonus > * { flex: 1 1 44% !important; }
        }`}</style>

      {/* Sidebar */}
      <aside className="fss-aside" style={{ width: 234, background: PANEL, borderRight: `1px solid ${BORDER}`, padding: "1.5rem 0.9rem", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 0.5rem", marginBottom: "1.6rem" }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: GREEN, display: "grid", placeItems: "center", color: "#0a0a0d", fontWeight: 900, fontSize: "0.9rem" }}>✦</span>
          <span style={{ fontWeight: 800, fontSize: "1.08rem", letterSpacing: "-0.02em" }}>Brain<span style={{ color: GREEN }}>Queue</span></span>
        </div>
        <button onClick={onExit} style={{ width: "100%", padding: "0.72rem", borderRadius: 12, border: "none", background: GREEN, color: "#0a0a0d", fontWeight: 800, fontSize: "0.85rem", cursor: "pointer", fontFamily: FONT, marginBottom: "1.7rem" }}>+ Add task</button>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV.map(n => (
            <div key={n.label} onClick={() => go(n.label)} style={{
              position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0.66rem 0.8rem", borderRadius: 11, cursor: "pointer",
              fontSize: "0.86rem", fontWeight: n.active ? 700 : 500, color: n.active ? GREEN : MUTE, background: n.active ? GREEN + "14" : "transparent",
            }}>
              {n.active && <span style={{ position: "absolute", left: -9, top: "50%", transform: "translateY(-50%)", width: 3, height: 18, borderRadius: 2, background: GREEN }} />}
              <span style={{ fontSize: "1rem", width: 18, textAlign: "center", opacity: n.active ? 1 : 0.8 }}>{n.icon}</span>{n.label}
            </div>
          ))}
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
        </div>
      </aside>

      {/* Main */}
      <main className="fss-main" style={{ flex: 1, padding: "2.3rem 2.5rem", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2.1rem", gap: "1.5rem" }}>
          <div>
            <h1 className="fss-title" style={{ fontSize: "1.85rem", fontWeight: 800, letterSpacing: "-0.025em", margin: 0, display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ color: GREEN }}>✦</span> Focus Sets Proposed for You
            </h1>
            <p style={{ fontSize: "0.9rem", color: MUTE, margin: "0.65rem 0 0", maxWidth: 580, lineHeight: 1.55 }}>
              Optimized focus sets built from your tasks — balanced on urgency, pleasure, duration, and your current energy.
            </p>
          </div>
          <button onClick={onExit} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.55rem 0.9rem", color: MUTE, cursor: "pointer", fontFamily: FONT, fontSize: "0.8rem", fontWeight: 600, flexShrink: 0 }}>✕ Close</button>
        </div>

        {proposals.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "3rem", textAlign: "center", color: MUTE }}>
            No active tasks to build a set from yet — add a few, then come back to focus.
          </div>
        ) : (
          <div className="fss-cards" style={{ display: "flex", gap: "1.2rem", alignItems: "stretch", marginBottom: "1.5rem" }}>
            {proposals.map(s => <SetCard key={s.id} set={s} onChoose={() => onStart?.({ taskIds: s.tasks.map(t => t.id), work: 25, brk: 5 })} />)}
          </div>
        )}

        {/* Bonus XP strip */}
        <div style={{ background: PANEL, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "1.3rem 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1.1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: GREEN + "18", display: "grid", placeItems: "center", fontSize: "1.15rem" }}>⚡</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.01em" }}>Bonus XP — stack them up</div>
                <div style={{ fontSize: "0.74rem", color: FAINT, marginTop: 1 }}>Extra rewards on top of each set. Chain them for the big spikes.</div>
              </div>
            </div>
            <div style={{ textAlign: "right", minWidth: 160 }}>
              <div style={{ fontSize: "0.7rem", color: FAINT, marginBottom: 4 }}>
                {lv.max ? <span style={{ color: GREEN, fontWeight: 700 }}>Max level — Transformed</span> : <>Level {lv.level} → {lv.level + 1} · <span style={{ color: GREEN, fontWeight: 700 }}>{lv.toNext.toLocaleString()} XP to go</span></>}
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${lv.pct}%`, height: "100%", background: `linear-gradient(90deg, ${GREEN}, #6bffb3)`, borderRadius: 3 }} />
              </div>
            </div>
          </div>
          <div className="fss-bonus" style={{ display: "flex", gap: "0.8rem" }}>
            {BONUSES.map(b => (
              <div key={b.id} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "0.7rem", background: `linear-gradient(180deg, ${b.color}10, rgba(255,255,255,0.02))`, border: `1px solid ${b.color}2e`, borderRadius: 13, padding: "0.75rem 0.85rem" }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: b.color + "1f", display: "grid", placeItems: "center", fontSize: "1rem", flexShrink: 0 }}>{b.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: TXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, color: b.color, flexShrink: 0 }}>+{b.xp}</span>
                  </div>
                  <div style={{ fontSize: "0.66rem", color: FAINT, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
