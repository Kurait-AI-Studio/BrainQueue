import { AppSidebar } from "brainqueue";

// AppSidebar's positioning (.app-sidebar) lives in the host app's CSS; inject it here
// so the rail renders in the preview the way it does in the app.
const session = { user: { user_metadata: { full_name: "Husseine K." } } };
const tasks = [
  { id: 1, title: "A", urgency: 5, importance: 5, effort: 4, energy: 4, done: true, addedAt: "2026-06-01", doneAt: "2026-06-02" },
  { id: 2, title: "B", urgency: 3, importance: 3, effort: 2, energy: 2, done: true, addedAt: "2026-06-01", doneAt: "2026-06-03" },
  { id: 3, title: "C", urgency: 4, importance: 4, effort: 2, energy: 3, done: false, addedAt: "2026-06-04" },
];

export const Sidebar = () => (
  <div style={{ display: "flex", minHeight: "100vh", background: "#09090c" }}>
    <style>{`.app-sidebar{position:relative!important;transform:none!important;width:234px;height:auto;min-height:100vh;background:#0e0e12;border-right:1px solid rgba(255,255,255,0.06);padding:1.5rem 0.9rem;display:flex;flex-direction:column;overflow-y:auto}`}</style>
    <AppSidebar session={session} tasks={tasks} active="focus" open={false} onClose={() => {}} onNav={() => {}} onAddTask={() => {}} onSignOut={() => {}} />
    <div style={{ flex: 1 }} />
  </div>
);
