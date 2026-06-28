import { useState } from "react";
import {
  glass, GlassButton, ViewTab, ScoreRing, GlassSlider, TierBadge, TaskCard, DoneCard,
  XPBar, MiniBars, Donut, StatCard, FocusRing, SessionStepper,
  MouseGlow, Dim, WeightSlider, EmptyState, InlineCatAdd, Toast, UserChip,
  TaskModal, SettingsModal, AnalyticsModal, SessionSetupModal,
} from "../ui";
import { doneSeries } from "../lib/tasks";
import { FocusSetsScreen, AppSidebar, TaskDetailModal } from "../ui";
import { FocusMode } from "../ui/FocusMode";
import { BrainDumpModal } from "../ui/BrainDumpModal";
import { Onboarding } from "../ui/Onboarding";

// Richer active set so the proposed focus sets fill out (the focus route only).
const hrsAgoG = (h) => new Date(Date.now() - h * 3.6e6).toISOString();
const focusMock = [
  { id: 1, title: "Finish the Q2 report", categories: ["Work"], urgency: 5, importance: 5, effort: 4, energy: 4, pleasure: 2, est_minutes: 120, cognitive_load: 4, multi_step: true, ai_delegatable: true, addedAt: hrsAgoG(48), done: false },
  { id: 2, title: "Reply to Sophie's email", categories: ["Admin"], urgency: 3, importance: 2, effort: 1, energy: 1, pleasure: 3, est_minutes: 5, cognitive_load: 1, addedAt: hrsAgoG(6), done: false },
  { id: 3, title: "30-minute run", categories: ["Health"], urgency: 4, importance: 4, effort: 2, energy: 3, pleasure: 4, est_minutes: 30, cognitive_load: 2, addedAt: hrsAgoG(20), done: false },
  { id: 7, title: "Refactor the auth module", categories: ["Work"], urgency: 4, importance: 5, effort: 4, energy: 4, pleasure: 3, est_minutes: 180, cognitive_load: 5, multi_step: true, addedAt: hrsAgoG(30), done: false },
  { id: 8, title: "Water the plants", categories: ["Personal"], urgency: 2, importance: 2, effort: 1, energy: 1, pleasure: 3, est_minutes: 5, cognitive_load: 1, addedAt: hrsAgoG(8), done: false },
  { id: 9, title: "Book the dentist", categories: ["Admin"], urgency: 3, importance: 3, effort: 1, energy: 2, pleasure: 2, est_minutes: 10, cognitive_load: 2, addedAt: hrsAgoG(12), done: false },
  { id: 10, title: "Read 10 pages", categories: ["Learning"], urgency: 2, importance: 3, effort: 2, energy: 2, pleasure: 5, est_minutes: 12, cognitive_load: 2, addedAt: hrsAgoG(16), done: false },
  { id: 11, title: "Practice guitar", categories: ["Personal"], urgency: 2, importance: 2, effort: 2, energy: 2, pleasure: 5, est_minutes: 15, cognitive_load: 2, addedAt: hrsAgoG(5), done: false },
  // a few done so the level/XP bar isn't empty
  { id: 12, title: "Pay the bill", categories: ["Finance"], urgency: 5, importance: 4, effort: 1, energy: 1, est_minutes: 10, addedAt: hrsAgoG(70), doneAt: hrsAgoG(40), done: true },
  { id: 13, title: "Stand-up notes", categories: ["Work"], urgency: 4, importance: 2, effort: 1, energy: 1, est_minutes: 10, addedAt: hrsAgoG(120), doneAt: hrsAgoG(70), done: true },
];

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
      <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "0.8rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b6b76", marginBottom: "0.9rem" }}>{title}</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", alignItems: "flex-start", ...(pad ? {} : {}) }}>{children}</div>
    </section>
  );
}

// Preview of the propagated app shell: persistent AppSidebar + the existing task list.
function ShellPreview() {
  const [section, setSection] = useState("tasks");
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#09090c" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .app-sidebar{position:relative!important;transform:none!important;height:auto;min-height:100vh}`}</style>
      <AppSidebar session={mockSession} tasks={focusMock} active={section} open={false} onClose={noop} onNav={setSection} onAddTask={noop} onSignOut={noop} />
      <main style={{ flex: 1, padding: "2.3rem 2.5rem", color: "#ededf0", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>All Tasks</h1>
        <p style={{ color: "#83838f", margin: "0.5rem 0 1.6rem", fontSize: "0.9rem" }}>The existing task list now sits to the right of the persistent sidebar.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 720 }}>
          {focusMock.filter(t => !t.done).slice(0, 5).map(t => (
            <TaskCard key={t.id} task={t} weights={undefined} onEdit={noop} onMarkDone={noop} onDelete={noop} onSchedule={noop} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function Gallery() {
  // ?modal=task|settings|analytics|session|toast opens one directly (for screenshots).
  const [modal, setModal] = useState(() => new URLSearchParams(window.location.search).get("modal"));
  const _view = new URLSearchParams(window.location.search).get("view");
  if (_view === "focus") return <FocusSetsScreen tasks={focusMock} session={mockSession} onStart={noop} onExit={noop} />;
  if (_view === "shell") return <ShellPreview />;
  if (_view === "detail") return <TaskDetailModal task={mockTasks[0]} weights={undefined} inSession={false} onClose={noop} onEdit={noop} onMarkDone={noop} onDelete={noop} onSchedule={noop} onAddToSession={noop} onFocusNow={noop} />;
  if (_view === "session2") return <FocusMode session={mockSession} tasks={focusMock.filter(t => !t.done).slice(0, 3)} onMarkDone={noop} onExit={noop} />;
  if (_view === "braindump") return <BrainDumpModal onClose={noop} onTasksAdded={noop} weights={undefined} initialParsed={[
    { _pid: "d:0", title: "Pay the EDF electricity bill", category: "Finance", urgency: 5, importance: 4, effort: 1, energy: 1, pleasure: 1, notes: "Due before the 15th to avoid a late fee.", due_date: "2026-07-15", est_minutes: 5, cognitive_load: 1, ai_delegatable: false, multi_step: false },
    { _pid: "d:1", title: "Leg day at the gym", category: "Sports", urgency: 3, importance: 3, effort: 2, energy: 4, pleasure: 4, notes: "", due_date: "", est_minutes: 60, cognitive_load: 1, ai_delegatable: false, multi_step: false },
    { _pid: "d:2", title: "Draft the BrainQueue landing copy", category: "BrainQueue", urgency: 4, importance: 5, effort: 3, energy: 4, pleasure: 3, notes: "Lead with the ADHD angle and the Memory feature.", due_date: "2026-07-04", est_minutes: 90, cognitive_load: 4, ai_delegatable: true, multi_step: true },
  ]} />;
  if (_view === "onboarding") return <Onboarding onComplete={noop} />;
  const active = mockTasks.filter(t => !t.done);
  const done = mockTasks.filter(t => t.done);
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a0a0d;color:#e0e0e0;font-family:'DM Mono',monospace}
        input[type=range]{-webkit-appearance:none;width:100%;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;outline:none}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#bef24a;box-shadow:0 0 8px #bef24a88;cursor:pointer}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <MouseGlow />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "760px", margin: "0 auto", padding: "2.5rem 1.25rem 6rem" }}>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "1.6rem", marginBottom: "0.3rem" }}>
          <span style={{ color: "#e8e8e8" }}>Brain</span><span style={{ color: "#bef24a", textShadow: "0 0 20px rgba(232,255,90,0.4)" }}>Queue</span>
          <span style={{ color: "#555", fontSize: "0.9rem", marginLeft: "0.6rem" }}>UI gallery</span>
        </h1>
        <p style={{ color: "#555", fontSize: "0.78rem", marginBottom: "2.5rem" }}>Every extracted component with mock data — no login. Screenshot at any width to check layout.</p>

        <Block title="Buttons">
          <GlassButton onClick={noop}>Default</GlassButton>
          <GlassButton onClick={noop} accent="#bef24a">+ Add</GlassButton>
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
              <StatCard label="Active" value={active.length} accent="#bef24a" />
              <StatCard label="Done" value={done.length} accent="#6bffb3" />
              <StatCard label="Avg pleasure" value="🙂" accent="#ff8fd0" />
            </div>
            <div style={{ display: "flex", gap: "1.4rem", alignItems: "center", flexWrap: "wrap" }}>
              <Donut donePct={Math.round(done.length / mockTasks.length * 100)} />
              <FocusRing pct={62} color="#bef24a" big="14:32" sub="⬣ Heavy · ~2h" />
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
