# design-sync notes — BrainQueue UI

## Setup facts
- **JS repo, no TypeScript / no `.d.ts`.** The converter runs in src-matched mode via
  `componentSrcMap` (a full enumeration of all 30 components → their `src/ui/*.jsx`).
  Prop contracts are *synthesized* and therefore weak — adding real TS types later
  would improve them.
- **Entry:** `dist-ui/brainqueue-ui.es.js` from `buildCmd: npm run build:ui`. It's built
  from `src/ui/index.js`'s export list — a component isn't in the bundle at all until it's
  re-exported there, independent of `componentSrcMap` (which only controls whether the
  *sync* picks it up once it IS exported).
- **Styling:** components use inline styles only (no CSS classes). `cssEntry`
  = `src/ui/preview.css`. **Its `@import` still requests Syne + DM Mono alongside Plus
  Jakarta Sans, but nothing in `src/ui/*.jsx` uses Syne or DM Mono anymore** (checked via
  grep across every component on 2026-07-01) — dead weight, not wrong per se (harmless
  extra font load), but worth trimming from `preview.css` next time someone's in there.
  `[FONT_REMOTE]` for the Google Fonts `@import` is expected.
- **node_modules:** repo root (`./node_modules`) — react resolves there.

## Known render warns
- None outstanding.
- Dim / SideSection / ViewTab were authored early because their floor cards rendered near-empty.
- **App-shell/overlay components are `position:fixed`** — their authored previews
  (`.design-sync/previews/{FocusSetsScreen,AppSidebar,SetCelebration,XpBurst,CaptureScreen}.tsx`)
  wrap the component and inject CSS to **un-fix the root** (e.g.
  `[style*="z-index: 200"]{position:relative!important;inset:auto!important}`) or, for
  AppSidebar, re-create the `.app-sidebar` layout CSS (it lives in the host app, not the
  package). Without that they render BLANK in the capture cell. `CaptureScreen` needed
  THREE separate un-fix rules (its root at z-index 120, a decorative ambient-glow layer at
  z-index 0, and a "Private by design"/close row at z-index 2) since it stacks three fixed
  elements, not one — matched by their literal inline z-index values, same technique.
  `FocusSetsScreen`, `SetCelebration`, `CaptureScreen` also carry
  `cfg.overrides.<Name> = {cardMode:single, viewport}`.
- `TaskCard` / `DoneCard` ship the **floor card** (no authored preview): their crash-prevention
  render throws `Cannot read properties of undefined (reading 'urgency'/'category')` because
  they need a real `task` prop — expected, `fallbackCard:true`, not a failure.
- **`XpBurst` needed `cfg.overrides.XpBurst = {cardMode:"single", primaryStory:"Burst"}`**
  (added 2026-07-01) — its `Burst` story is a fixed/portal element that positioned outside
  the grid cell (`[GRID_OVERFLOW]`); `single` mode exempts it from that check.

## Re-sync risks (what to watch)
- **New components need TWO additions, not one**: (1) `export { X } from "./X"` in
  `src/ui/index.js` — without this the component isn't in the bundle at all, and the
  converter won't find it no matter what `componentSrcMap` says; (2) an entry in
  `cfg.componentSrcMap` — without this a component that IS in the bundle still won't sync.
  `CaptureScreen` was missing BOTH until 2026-07-01 (it existed in `src/ui/` the whole time
  but was never wired into the library's public surface).
- **~11 components still ship the floor card** (AnalyticsModal, GlassSlider, MiniBars,
  MouseGlow, SessionSetupModal, SettingsModal, TaskModal, TierBadge, Toast, UserChip,
  XPBar) — author `.design-sync/previews/<Name>.tsx` to enrich them on a future re-sync.
- **`conventions.md`'s "two idioms" framing was stale and has been corrected (2026-07-01).**
  It previously claimed a legacy glass idiom on Syne/DM Mono/`#e8ff5a` vs. a new clean
  idiom on Plus Jakarta/`#bef24a` — but `src/ui/tokens.js` itself says "one accent, one
  font... the only font the app loads now," and a repo-wide grep found zero remaining uses
  of Syne, DM Mono, or `#e8ff5a` in any component source. The migration this doc described
  as "mid-way" had already finished. Corrected to: one accent/font, two *surface*
  treatments (frosted glass vs. flat cards) — that split is still real. If re-validating
  a future sync and something here stops matching the build again, re-check with the same
  grep sweep before trusting inherited framing.
- Re-sync: rebuild (`npm run build:ui`), fetch the project `_ds_sync.json` →
  `.design-sync/.cache/remote-sync.json`, run `.ds-sync/resync.mjs`.
