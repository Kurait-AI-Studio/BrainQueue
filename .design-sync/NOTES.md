# design-sync notes — BrainQueue UI

## Setup facts
- **JS repo, no TypeScript / no `.d.ts`.** The converter runs in src-matched mode via
  `componentSrcMap` (a full enumeration of all 29 components → their `src/ui/*.jsx`).
  Prop contracts are *synthesized* and therefore weak — adding real TS types later
  would improve them.
- **Entry:** `dist-ui/brainqueue-ui.es.js` from `buildCmd: npm run build:ui`.
- **Styling:** components use inline styles only (no CSS classes). `cssEntry`
  = `src/ui/preview.css`, which loads the brand fonts (Syne, DM Mono, **Plus Jakarta
  Sans**) and the dark canvas. `[FONT_REMOTE]` for the Google Fonts `@import` is expected.
- **node_modules:** repo root (`./node_modules`) — react resolves there.

## Known render warns
- None outstanding.
- Dim / SideSection / ViewTab were authored early because their floor cards rendered near-empty.
- **The 4 app-shell/overlay components are `position:fixed`** — their authored previews
  (`.design-sync/previews/{FocusSetsScreen,AppSidebar,SetCelebration,XpBurst}.tsx`) wrap the
  component and inject CSS to **un-fix the root** (e.g. `[style*="z-index: 200"]{position:relative!important;inset:auto!important}`)
  or, for AppSidebar, re-create the `.app-sidebar` layout CSS (it lives in the host app, not
  the package). Without that they render BLANK in the capture cell. `FocusSetsScreen` +
  `SetCelebration` also carry `cfg.overrides.<Name> = {cardMode:single, viewport}`.
- `TaskCard` / `DoneCard` ship the **floor card** (no authored preview): their crash-prevention
  render throws `Cannot read properties of undefined (reading 'urgency'/'category')` because
  they need a real `task` prop — expected, `fallbackCard:true`, not a failure.

## Re-sync risks (what to watch)
- **New components won't sync** unless added to `componentSrcMap` in config.json.
- **~13 components ship the floor card** (unauthored previews) — author
  `.design-sync/previews/<Name>.tsx` to enrich them on a future re-sync.
- **`conventions.md` is now dual-idiom** (legacy glass + Syne/DM Mono/`#e8ff5a`; new clean
  flat + Plus Jakarta/`#bef24a`). Keep it accurate as more components migrate to the clean look.
- Re-sync: rebuild (`npm run build:ui`), fetch the project `_ds_sync.json` →
  `.design-sync/.cache/remote-sync.json`, run `.ds-sync/resync.mjs`.
