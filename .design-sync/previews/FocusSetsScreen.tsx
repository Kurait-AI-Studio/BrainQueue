import { FocusSetsScreen } from "brainqueue";

const now = Date.now();
const hrsAgo = (h: number) => new Date(now - h * 3.6e6).toISOString();
const tasks = [
  { id: 1, title: "Finish the Q2 report", categories: ["Work"], urgency: 5, importance: 5, effort: 4, energy: 4, pleasure: 2, est_minutes: 120, cognitive_load: 4, multi_step: true, addedAt: hrsAgo(48), done: false },
  { id: 2, title: "Reply to Sophie's email", categories: ["Admin"], urgency: 3, importance: 2, effort: 1, energy: 1, pleasure: 3, est_minutes: 5, cognitive_load: 1, addedAt: hrsAgo(6), done: false },
  { id: 3, title: "30-minute run", categories: ["Health"], urgency: 4, importance: 4, effort: 2, energy: 3, pleasure: 4, est_minutes: 30, cognitive_load: 2, addedAt: hrsAgo(20), done: false },
  { id: 4, title: "Refactor the auth module", categories: ["Work"], urgency: 4, importance: 5, effort: 4, energy: 4, pleasure: 3, est_minutes: 180, cognitive_load: 5, multi_step: true, addedAt: hrsAgo(30), done: false },
  { id: 5, title: "Water the plants", categories: ["Personal"], urgency: 2, importance: 2, effort: 1, energy: 1, pleasure: 3, est_minutes: 5, cognitive_load: 1, addedAt: hrsAgo(8), done: false },
  { id: 6, title: "Read 10 pages", categories: ["Learning"], urgency: 2, importance: 3, effort: 2, energy: 2, pleasure: 5, est_minutes: 12, cognitive_load: 2, addedAt: hrsAgo(16), done: false },
  { id: 7, title: "Pay the bill", categories: ["Finance"], urgency: 5, importance: 4, effort: 1, energy: 1, est_minutes: 10, addedAt: hrsAgo(70), doneAt: hrsAgo(40), done: true },
];
const session = { user: { user_metadata: { full_name: "Husseine K." } } };

export const FocusSets = () => (
  <FocusSetsScreen tasks={tasks} session={session} onStart={() => {}} onExit={() => {}} />
);
