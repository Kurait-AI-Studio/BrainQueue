import { useState } from "react";
import {
  glass, GlassButton, ViewTab, ScoreRing, GlassSlider, TierBadge, TaskCard, DoneCard,
  XPBar, MiniBars, Donut, StatCard, SideSection, FocusRing, SessionStepper,
  MouseGlow, Dim, WeightSlider, EmptyState, InlineCatAdd, Toast, UserChip,
  TaskModal, SettingsModal, AnalyticsModal, SessionSetupModal,
} from "../ui";
import { doneSeries } from "../lib/tasks";

// ─── Mock data ───────────────────────────────────────────────────────────────
const hrsAgo = (h) => new Date(Date.now() - h * 3.6e6).toISOString();
const mockTasks = [
  { id: 1, title: "Finish the Q2 report", categories: ["Work"], urgency: 5, importance: 5, effort: 4, energy: 4, pleasure: 2, est_minutes: 120, cognitive_load: 4, multi_step: true, ai_delegatable: true, recurrence: "weekly", addedAt: hrsAgo(48), done: false, notes: "Draft → review → ship before Friday." },
  { id: 2, title: "Reply to Sarah's email about the launch", categories: ["Admin", "Work"], urgency: 3, importance: 2, effort: 1, energy: 1, pleasure: 3, est_minutes: 5, cognitive_load: 1, addedAt: hrsAgo(6), done: false },
  { id: 3, title: "30-minute run", categories: ["Health"], urgency: 4, importance: 4, effort: 2, energy: 3, pleasure: 4, est_minutes: 30, cognitive_load: 2, addedAt: hrsAgo(20), done: false },
  // some completed, spread across this week for the chart
  { id: 4, title: "Pay the electricity bill", categories: ["Finance"], urgency: 5, importance: 4, effort: 1, energy: 1, pleasure: 1, est_minutes: 10, addedAt: hrsAgo(70), doneAt: hrsAgo(22), done: true },
  { id: 5, title: "Read one chapter", categories: ["Learning"], urgency: 2, importance: 3, effort: 2, energy: 2, pleasure: 5, est_minutes: 25, addedAt: hrsAgo(90), doneAt: hrsAgo(46), done: true },
  { id: 6, title: "Stand-up notes", categories: ["Work"], urgency: 4, importance: 2, effort: 1, energy: 1, pleasure: 3, est_minutes: 10, addedAt: hrsAgo(120), doneAt: hrsAgo(70), done: true },
];
const mockSession = { user: { email: "you@example.com", user_metadata: { full_name: "Husseine K." } } };
const noop = () => {};

function Block({ title, children, pad = true }) {
  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b6b76", marginBottom: "0.9rem" }}>{title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", alignItems: "flex-start", ...(pad ? {} : {}) }}>{children}</div>
    </section>
  );
}

export function Gallery() {
  // ?modal=task|settings|analytics|session|toast opens one directly (for screenshots).
  const [modal, setModal] = useState(() => new URLSearchParams(window.location.search).get("modal"));
  const active = mockTasks.filter(t => !t.done);
  const done = mockTasks.filter(t => t.done);
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#060610;color:#e0e0e0;font-family:'DM Mono',monospace}
        input[type=range]{-webkit-appearance:none;width:100%;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#e8ff5a;box-shadow:0 0 8px #e8ff5a88;cursor:pointer}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <MouseGlow />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "760px", margin: "0 auto", padding: "2.5rem 1.25rem 6rem" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.6rem", marginBottom: "0.3rem" }}>
          <span style={{ color: "#e8e8e8" }}>Brain</span><span style={{ color: "#e8ff5a", textShadow: "0 0 20px rgba(232,255,90,0.4)" }}>Queue</span>
          <span style={{ color: "#555", fontSize: "0.9rem", marginLeft: "0.6rem" }}>UI gallery</span>
        </h1>
        <p style={{ color: "#555", fontSize: "0.78rem", marginBottom: "2.5rem" }}>Every extracted component with mock data — no login. Screenshot at any width to check layout.</p>

        <Block title="Buttons">
          <GlassButton onClick={noop}>Default</GlassButton>
          <GlassButton onClick={noop} accent="#e8ff5a">+ Add</GlassButton>
          <GlassButton onClick={noop} accent="#6bffb3">▶ Focus</GlassButton>
          <ViewTab label="🔥 Do Now" active onClick={noop} />
          <ViewTab label="⚡ Quick Wins" active={false} onClick={noop} />
        </Block>

        <Block title="Tiers & score">
          {active.map(t => <TierBadge key={t.id} task={t} showEst />)}
          <ScoreRing score={94} /><ScoreRing score={68} /><ScoreRing score={34} />
        </Block>

        <Block title="Task cards" pad={false}>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {active.map(t => <TaskCard key={t.id} task={t} weights={undefined} onEdit={noop} onMarkDone={noop} onDelete={noop} onSchedule={noop} />)}
            {done.slice(0, 1).map(t => <DoneCard key={t.id} task={t} onDelete={noop} onRestore={noop} />)}
          </div>
        </Block>

        <Block title="Gamification & analytics" pad={false}>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <div style={{ maxWidth: "264px" }}><XPBar tasks={mockTasks} /></div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <StatCard label="Active" value={active.length} accent="#e8ff5a" />
              <StatCard label="Done" value={done.length} accent="#6bffb3" />
              <StatCard label="Avg pleasure" value="🙂" accent="#ff8fd0" />
            </div>
            <div style={{ display: "flex", gap: "1.4rem", alignItems: "center", flexWrap: "wrap" }}>
              <Donut donePct={Math.round(done.length / mockTasks.length * 100)} />
              <FocusRing pct={62} color="#e8ff5a" big="14:32" sub="⬣ Heavy · ~2h" />
            </div>
            <div style={{ ...glass, borderRadius: "14px", padding: "0.9rem 1rem" }}>
              <MiniBars data={doneSeries(mockTasks, "week")} height={96} />
            </div>
          </div>
        </Block>

        <Block title="Inputs">
          <div style={{ width: "260px" }}><GlassSlider label="Urgency" value={4} onChange={noop} sublabels={{ 1: "Someday", 2: "Eventually", 3: "This month", 4: "This week", 5: "TODAY" }} /></div>
          <div style={{ width: "260px" }}><WeightSlider label="Urgency" value={30} onChange={noop} description="deadline proximity" /></div>
          <Dim label="U" value={4} onChange={noop} />
          <InlineCatAdd onAdd={noop} />
          <div style={{ display: "flex", gap: "0.6rem", width: "260px" }}><SessionStepper label="Focus" value={25} set={noop} min={5} max={90} /><SessionStepper label="Break" value={5} set={noop} min={5} max={30} /></div>
        </Block>

        <Block title="States & chrome">
          <UserChip session={mockSession} />
          <div style={{ width: "100%", ...glass, borderRadius: "16px" }}><EmptyState view={1} filterCat="All" onAdd={noop} onDump={noop} /></div>
        </Block>

        <Block title="Modals (click to open)">
          <GlassButton onClick={() => setModal("task")}>Task modal</GlassButton>
          <GlassButton onClick={() => setModal("settings")}>Settings</GlassButton>
          <GlassButton onClick={() => setModal("analytics")}>Analytics</GlassButton>
          <GlassButton onClick={() => setModal("session")}>Session setup</GlassButton>
          <GlassButton onClick={() => setModal("toast")}>Show toast</GlassButton>
        </Block>
      </div>

      {modal === "task" && <TaskModal task={active[0]} onClose={() => setModal(null)} onSave={() => setModal(null)} customCategories={["Side project"]} onAddCategory={noop} />}
      {modal === "settings" && <SettingsModal weights={undefined} reviewTone="kind" onSave={noop} onClose={() => setModal(null)} />}
      {modal === "analytics" && <AnalyticsModal tasks={mockTasks} customCategories={[]} onClose={() => setModal(null)} />}
      {modal === "session" && <SessionSetupModal tasks={active} onStart={() => setModal(null)} onClose={() => setModal(null)} />}
      {modal === "toast" && <Toast toast={{ type: "success", msg: "Added to your calendar ✓" }} onDone={() => setModal(null)} />}
    </>
  );
}
