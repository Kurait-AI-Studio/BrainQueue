import { TaskDetailModal } from "brainqueue";

const now = Date.now();
const hrsAgo = (h: number) => new Date(now - h * 3.6e6).toISOString();
const noop = () => {};

const task = {
  id: 1,
  title: "Finish the Q2 report",
  categories: ["Work"],
  urgency: 5,
  importance: 5,
  effort: 4,
  energy: 4,
  pleasure: 2,
  est_minutes: 120,
  cognitive_load: 4,
  multi_step: true,
  ai_delegatable: true,
  recurrence: "weekly",
  addedAt: hrsAgo(48),
  notes: "Draft → review → ship before Friday.",
};

// The detail view renders position:fixed (z-index 250); un-fix its root so it flows
// into the capture card instead of escaping it.
export const Detail = () => (
  <div style={{ minHeight: "100vh", background: "#09090c", display: "flex" }}>
    <style>{`[style*="z-index: 250"]{position:relative!important;inset:auto!important;min-height:100vh;width:100%}`}</style>
    <TaskDetailModal task={task} weights={undefined} inSession={false} onClose={noop} onEdit={noop} onMarkDone={noop} onDelete={noop} onSchedule={noop} onAddToSession={noop} onFocusNow={noop} />
  </div>
);
