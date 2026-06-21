import { TaskCard } from "brainqueue";

const now = Date.now();
const hrsAgo = (h: number) => new Date(now - h * 3.6e6).toISOString();
const noop = () => {};
const handlers = { onEdit: noop, onMarkDone: noop, onDelete: noop, onSchedule: noop };
const wrap = { padding: "1rem", maxWidth: 560 } as const;

// Variant axis: priority/category — high-stakes work vs. a quick admin win vs. health.
export const Work = () => (
  <div style={wrap}>
    <TaskCard task={{ id: 1, title: "Finish the Q2 report", categories: ["Work"], urgency: 5, importance: 5, effort: 4, energy: 4, pleasure: 2, est_minutes: 120, cognitive_load: 4, multi_step: true, ai_delegatable: true, recurrence: "weekly", addedAt: hrsAgo(48), notes: "Draft → review → ship before Friday." }} {...handlers} />
  </div>
);

export const QuickWin = () => (
  <div style={wrap}>
    <TaskCard task={{ id: 2, title: "Reply to Sophie's email about the launch", categories: ["Admin", "Work"], urgency: 3, importance: 2, effort: 1, energy: 1, pleasure: 3, est_minutes: 5, cognitive_load: 1, addedAt: hrsAgo(6) }} {...handlers} />
  </div>
);

export const Health = () => (
  <div style={wrap}>
    <TaskCard task={{ id: 3, title: "30-minute run", categories: ["Health"], urgency: 4, importance: 4, effort: 2, energy: 3, pleasure: 4, est_minutes: 30, cognitive_load: 2, addedAt: hrsAgo(20) }} {...handlers} />
  </div>
);
