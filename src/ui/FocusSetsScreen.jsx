// Full-screen "Focus Mode" — AI-proposed focus sets with per-set XP and the bonus
// reward strip. Driven by real tasks (buildProposals + taskXP) and the canonical XP curve.
// Each proposed set can be CUSTOMIZED (reorder/reverse/remove/add tasks), and a set can be
// built from scratch. Choosing/starting a set hands its ordered task ids to onStart().
import { useState } from "react";
import { buildProposals, taskCats, taskXP, totalXP, CAT_ACCENT, fmtDuration } from "../lib/tasks";
import { levelForXp, BONUSES } from "../lib/xp";

const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const BG = "#09090c", PANEL = "#0e0e12", CARD = "#16161c", BORDER = "rgba(255,255,255,0.06)";
const GREEN = "#bef24a", TXT = "#ededf0", MUTE = "#83838f", FAINT = "#55555f";

const ACCENT = { donow: GREEN, quick: "#f5b13a", deep: "#b388ff", easy: "#6b9fff" };
const CAT_EMOJI = { Health: "💪", Work: "💼", Admin: "🗂", Social: "💬", Finance: "💰", Learning: "📚", Personal: "🌿" };
const NAV = [
  { icon: "🎯", label: "Focus Mode", active: true },
  { icon: "📋", label: "All Tasks" },
  { icon: "📊", label: "Analytics" },
  { icon: "🏆", label: "Rewards" },
  { icon: "⚙️", label: "Settings" },
];
const NAV_IDLE = "#b6b6c2";
const avg = (arr, f) => (arr.length ? Math.round(arr.reduce((s, t) => s + (f(t) || 0), 0) / arr.length) : 0);
// A task → its display row for the set/editor lists.
const rowFor = (t) => { const cat = taskCats(t)[0] || "Personal"; return { id: t.id, title: t.title, sub: cat, min: t.est_minutes || 25, color: CAT_ACCENT(cat), emoji: CAT_EMOJI[cat] || "◆" }; };

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

function SetCard({ set, onChoose, onCustomize }) {
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
      <button onClick={onCustomize} style={{ marginTop: 8, width: "100%", padding: "0.45rem", borderRadius: 10, cursor: "pointer", fontFamily: FONT, fontWeight: 600, fontSize: "0.76rem", border: "none", background: "transparent", color: MUTE }}>✎ Customize this set</button>
    </div>
  );
}

// Inline editor: reorder (▲▼ / reverse), remove, and add tasks; then start the session.
function SetEditor({ draft, setDraft, byId, active, onStart, onCancel }) {
  const ids = draft.ids;
  const rows = ids.map(id => byId[id]).filter(Boolean);
  const remaining = active.filter(t => !ids.includes(t.id));
  const totalMin = rows.reduce((s, t) => s + (t.est_minutes || 25), 0);
  const xp = rows.reduce((s, t) => s + taskXP(t), 0);
  const a = draft.accent || GREEN;
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= ids.length) return; const n = [...ids]; [n[i], n[j]] = [n[j], n[i]]; setDraft({ ...draft, ids: n }); };
  const remove = (id) => setDraft({ ...draft, ids: ids.filter(x => x !== id) });
  const add = (id) => setDraft({ ...draft, ids: [...ids, id] });
  const reverse = () => setDraft({ ...draft, ids: [...ids].reverse() });
  const ctrlBtn = (label, onClick, disabled, color = MUTE) => (
    <button onClick={onClick} disabled={disabled} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 8, width: 26, height: 26, color: disabled ? "#33333a" : color, cursor: disabled ? "default" : "pointer", fontSize: "0.8rem", display: "grid", placeItems: "center", flexShrink: 0 }}>{label}</button>
  );

  return (
    <div style={{ background: CARD, border: `1px solid ${a}40`, borderRadius: 18, padding: "1.4rem 1.5rem", marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Custom set name"
          style={{ flex: 1, minWidth: 180, background: "transparent", border: "none", borderBottom: `1px solid ${BORDER}`, color: TXT, fontFamily: FONT, fontWeight: 700, fontSize: "1.15rem", padding: "0.25rem 0", outline: "none" }} />
        <span style={{ fontSize: "0.75rem", color: MUTE, fontWeight: 600 }}>{rows.length} task{rows.length === 1 ? "" : "s"} · {fmtDuration(totalMin)} · <span style={{ color: a }}>✦ {xp} XP</span></span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "1.1rem 0 0.6rem" }}>
        <span style={{ fontSize: "0.66rem", color: FAINT, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Order — top runs first</span>
        <button onClick={reverse} disabled={rows.length < 2} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "0.3rem 0.7rem", color: rows.length < 2 ? "#33333a" : TXT, cursor: rows.length < 2 ? "default" : "pointer", fontFamily: FONT, fontSize: "0.72rem", fontWeight: 600 }}>⇅ Reverse</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "1.1rem" }}>
        {rows.length === 0 && <p style={{ fontSize: "0.8rem", color: FAINT, padding: "0.6rem 0" }}>No tasks yet — add some below.</p>}
        {rows.map((t, i) => { const r = rowFor(t); return (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.5rem 0.6rem" }}>
            <span style={{ fontSize: "0.66rem", color: FAINT, width: 16, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
            <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: r.color + "22", fontSize: "0.85rem", flexShrink: 0 }}>{r.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.82rem", color: TXT, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
              <div style={{ fontSize: "0.64rem", color: FAINT }}>{r.sub} · {r.min} min</div>
            </div>
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              {ctrlBtn("▲", () => move(i, -1), i === 0)}
              {ctrlBtn("▼", () => move(i, 1), i === rows.length - 1)}
              {ctrlBtn("✕", () => remove(t.id), false, "#ff6b6b")}
            </div>
          </div>
        ); })}
      </div>

      {remaining.length > 0 && (
        <>
          <div style={{ fontSize: "0.66rem", color: FAINT, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Add a task</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.2rem", maxHeight: 240, overflow: "auto" }}>
            {remaining.map(t => { const r = rowFor(t); return (
              <button key={t.id} onClick={() => add(t.id)} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.5rem 0.6rem", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
                <span style={{ color: GREEN, fontWeight: 800, width: 16, textAlign: "center", flexShrink: 0 }}>＋</span>
                <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: r.color + "22", fontSize: "0.8rem", flexShrink: 0 }}>{r.emoji}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: "0.8rem", color: TXT, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
                <span style={{ fontSize: "0.66rem", color: FAINT, flexShrink: 0 }}>{r.min} min</span>
              </button>
            ); })}
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: "0.7rem" }}>
        <button onClick={onCancel} style={{ flex: "0 0 auto", padding: "0.8rem 1.2rem", borderRadius: 13, border: `1px solid ${BORDER}`, background: "transparent", color: MUTE, cursor: "pointer", fontFamily: FONT, fontWeight: 600, fontSize: "0.84rem" }}>Cancel</button>
        <button onClick={() => rows.length && onStart?.({ taskIds: ids, work: 25, brk: 5 })} disabled={rows.length === 0}
          style={{ flex: 1, padding: "0.8rem", borderRadius: 13, border: "none", background: rows.length ? a : a + "22", color: rows.length ? "#0a0a0d" : a + "88", cursor: rows.length ? "pointer" : "default", fontFamily: FONT, fontWeight: 700, fontSize: "0.86rem" }}>
          Start focus →
        </button>
      </div>
    </div>
  );
}

export function FocusSetsScreen({ tasks = [], session, onStart, onExit }) {
  const active = tasks.filter(t => !t.done);
  const byId = Object.fromEntries(active.map(t => [t.id, t]));
  const [draft, setDraft] = useState(null); // { title, accent, ids: [...] } while editing/creating

  const proposals = buildProposals(active).slice(0, 3).map((p, i) => {
    const a = ACCENT[p.id] || GREEN;
    return {
      ...p, accent: a, featured: i === 0,
      urgency: avg(p.items, t => t.urgency),
      pleasure: avg(p.items, t => t.pleasure ?? 3),
      energy: avg(p.items, t => t.cognitive_load ?? t.energy ?? 3),
      duration: fmtDuration(p.items.reduce((s, t) => s + (t.est_minutes || 25), 0)),
      xp: p.items.reduce((s, t) => s + taskXP(t), 0),
      tasks: p.items.map(rowFor),
    };
  });

  const lv = levelForXp(totalXP(tasks));
  const name = session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "You";
  const initial = name[0]?.toUpperCase() || "Y";
  const go = (label) => { if (label !== "Focus Mode" && label !== "Rewards") onExit?.(); };
  const editSet = (s) => setDraft({ title: `${s.name} — my version`, accent: s.accent, ids: s.tasks.map(t => t.id) });
  const newSet = () => setDraft({ title: "Custom set", accent: GREEN, ids: [] });

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
              position: "relative", display: "flex", alignItems: "center", gap: 12, padding: "0.7rem 0.8rem", borderRadius: 11, cursor: "pointer",
              fontSize: "0.88rem", fontWeight: n.active ? 700 : 600, color: n.active ? GREEN : NAV_IDLE, background: n.active ? GREEN + "1c" : "transparent",
            }}>
              {n.active && <span style={{ position: "absolute", left: -9, top: "50%", transform: "translateY(-50%)", width: 3, height: 20, borderRadius: 2, background: GREEN }} />}
              <span style={{ fontSize: "1.05rem", width: 20, textAlign: "center" }}>{n.icon}</span>{n.label}
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
              <span style={{ color: GREEN }}>✦</span> {draft ? "Customize your set" : "Focus Sets Proposed for You"}
            </h1>
            <p style={{ fontSize: "0.9rem", color: MUTE, margin: "0.65rem 0 0", maxWidth: 580, lineHeight: 1.55 }}>
              {draft ? "Reorder, remove, or add tasks — the top task runs first. Then start your session." : "Optimized focus sets built from your tasks. Customize any set, or build your own."}
            </p>
          </div>
          <button onClick={onExit} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "0.55rem 0.9rem", color: MUTE, cursor: "pointer", fontFamily: FONT, fontSize: "0.8rem", fontWeight: 600, flexShrink: 0 }}>✕ Close</button>
        </div>

        {draft ? (
          <SetEditor draft={draft} setDraft={setDraft} byId={byId} active={active} onStart={onStart} onCancel={() => setDraft(null)} />
        ) : proposals.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "3rem", textAlign: "center", color: MUTE }}>
            No active tasks to build a set from yet — add a few, then come back to focus.
          </div>
        ) : (
          <>
            <div className="fss-cards" style={{ display: "flex", gap: "1.2rem", alignItems: "stretch", marginBottom: "1rem" }}>
              {proposals.map(s => <SetCard key={s.id} set={s} onChoose={() => onStart?.({ taskIds: s.tasks.map(t => t.id), work: 25, brk: 5 })} onCustomize={() => editSet(s)} />)}
            </div>
            <button onClick={newSet} style={{ width: "100%", padding: "0.85rem", borderRadius: 14, border: `1px dashed ${BORDER}`, background: "transparent", color: MUTE, cursor: "pointer", fontFamily: FONT, fontWeight: 600, fontSize: "0.84rem", marginBottom: "1.5rem" }}>
              ＋ Build a custom set from scratch
            </button>
          </>
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
