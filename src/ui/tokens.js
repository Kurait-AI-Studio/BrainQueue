// ─── Design tokens ───────────────────────────────────────────────────────────
// The single source of truth for BrainQueue's look. Import these instead of
// hardcoding hex/fonts so the whole app stays coherent (one accent, one font).

// Brand
export const accent = "#bef24a";          // canonical green
export const accentSoft = "rgba(190,242,74,0.12)";
export const bg = "#0a0a0d";              // app background base
export const font = "'Plus Jakarta Sans', system-ui, sans-serif";  // one font, everywhere
// The only font the app loads now.
export const FONT_IMPORT = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap";

// The glass surfaces. Spread into a component's style (`...glass`) for the standard
// frosted panel, `glassStrong` for modals.

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
