// ─── Design tokens ───────────────────────────────────────────────────────────
// The glass surfaces that define BrainQueue's look. Spread into a component's
// style (`...glass`) for the standard frosted panel, `glassStrong` for modals.

export const glass = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
};

export const glassStrong = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(40px) saturate(200%)",
  WebkitBackdropFilter: "blur(40px) saturate(200%)",
  border: "1px solid rgba(255,255,255,0.13)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
};
