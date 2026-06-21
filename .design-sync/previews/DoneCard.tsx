import { DoneCard } from "brainqueue";

const now = Date.now();
const hrsAgo = (h: number) => new Date(now - h * 3.6e6).toISOString();
const noop = () => {};
const wrap = { padding: "1rem", maxWidth: 560 } as const;

// A completed task: dimmed + struck through, with the category chip and done/added stamps.
export const Done = () => (
  <div style={wrap}>
    <DoneCard task={{ id: 1, title: "Pay the electricity bill", category: "Finance", categories: ["Finance"], urgency: 5, importance: 4, effort: 1, addedAt: hrsAgo(70), doneAt: hrsAgo(22) }} onDelete={noop} onRestore={noop} />
  </div>
);

export const Learning = () => (
  <div style={wrap}>
    <DoneCard task={{ id: 2, title: "Read one chapter", category: "Learning", categories: ["Learning"], addedAt: hrsAgo(90), doneAt: hrsAgo(46) }} onDelete={noop} onRestore={noop} />
  </div>
);
