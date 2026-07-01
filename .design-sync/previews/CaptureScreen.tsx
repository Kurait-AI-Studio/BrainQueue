import { CaptureScreen } from "brainqueue";

// CaptureScreen renders position:fixed (three stacked fixed layers: the ambient glow,
// the "Private by design" + close row, and the inset:0 root itself). Un-fix each by its
// literal inline z-index — same technique as AppSidebar/FocusSetsScreen — so the whole
// screen flows into the capture card instead of escaping to the viewport.
const UNFIX = `
  [style*="z-index: 120"]{position:relative!important;inset:auto!important;min-height:100vh}
  [style*="z-index: 2"]{position:relative!important;top:auto!important;right:auto!important}
  [style*="z-index: 0"]{position:relative!important;top:auto!important;left:auto!important;transform:none!important;margin:0 auto}
`;

const now = Date.now();
const hoursAgo = (h: number) => new Date(now - h * 3.6e6).toISOString();

const pendingCaptures = [
  { id: "c1", text: "call the dentist about the filling, also need to reschedule the team sync to thursday and buy a birthday gift for mom", createdAt: hoursAgo(0.2) },
  { id: "c2", text: "idea: add a weekly email digest. research competitors pricing. finish the Q3 report draft before friday", createdAt: hoursAgo(3) },
];
const processedCaptures = [
  { id: "p1", text: "plan goals for next quarter, sort out the budget spreadsheet, deep work ideas for the new feature", createdAt: hoursAgo(26), processedAt: hoursAgo(25) },
  { id: "p2", text: "new business idea, send the pitch deck to Sarah, follow up with the supplier", createdAt: hoursAgo(50), processedAt: hoursAgo(49) },
  { id: "p3", text: "book flight for the conference, project notes to review, buy supplements", createdAt: hoursAgo(74), processedAt: hoursAgo(70) },
];

const noop = () => {};

// The first-run state: a clean, empty canvas with nothing captured yet.
export const Empty = () => (
  <div style={{ minHeight: "100vh", background: "#09090c" }}>
    <style>{UNFIX}</style>
    <CaptureScreen captures={[]} processedCaptures={[]} onCapture={noop} onProcessAll={noop} onDelete={noop} onClose={noop} />
  </div>
);

// The hero state for the launch video: previous dumps expanded, showing the New /
// Processed history badges together.
export const WithHistory = () => (
  <div style={{ minHeight: "100vh", background: "#09090c" }}>
    <style>{UNFIX}</style>
    <CaptureScreen captures={pendingCaptures} processedCaptures={processedCaptures}
      onCapture={noop} onProcessAll={noop} onDelete={noop} onClose={noop} defaultShowSaved />
  </div>
);
