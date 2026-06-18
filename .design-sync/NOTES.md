# design-sync notes — BrainQueue UI

## Setup facts
- **JS repo, no TypeScript / no `.d.ts`.** The converter runs in src-matched mode via
  `componentSrcMap` (a full enumeration of all 25 components → their `src/ui/*.jsx`).
  Prop contracts are *synthesized* and therefore weak — adding real TS types later
  would improve them.
- **Entry:** `dist-ui/brainqueue-ui.es.js` from `buildCmd: npm run build:ui`.
- **Styling:** components use inline styles only (no CSS classes). `cssEntry`
  = `src/ui/preview.css`, which loads the brand fonts and the dark `#060610` canvas
  the glass components require. `[FONT_REMOTE]` for Syne/DM Mono is expected (Google
  Fonts `@import`).
- **node_modules:** repo root (`./node_modules`) — react resolves there.

## Known render warns
- None outstanding. Dim / SideSection / ViewTab were authored (`.design-sync/previews/`)
  because their floor cards rendered near-empty.

## Re-sync risks (what to watch)
- **New components won't sync** unless added to `componentSrcMap` in config.json.
- **13 components ship the floor card** (unauthored previews) — author
  `.design-sync/previews/<Name>.tsx` to enrich them on a future re-sync.
- `conventions.md` asserts "no className styling, dark canvas, Syne+DM Mono" — keep it
  true if the components change, or the design agent will be misled.
- Re-sync: rebuild (`npm run build:ui`), fetch the project `_ds_sync.json` →
  `.design-sync/.cache/remote-sync.json`, run `.ds-sync/resync.mjs`.
