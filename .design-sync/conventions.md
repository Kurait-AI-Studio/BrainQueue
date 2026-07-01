# BrainQueue UI — how to build with these components

A dark React component library. Components are **self-contained and styled internally
with inline styles** — there are no CSS classes to apply and (except `GlassButton`'s
`className`/`style` passthrough) no styling props. You compose them and write only your
own layout glue with inline `style={{}}`.

## One accent, one font — two surface treatments
The library has fully migrated to a single brand: font **Plus Jakarta Sans** everywhere,
accent green-lime **`#bef24a`** everywhere. There is no second color/font idiom to avoid
mixing — every component uses these. What still varies is the **surface treatment**:
- **Frosted "glass"** — translucent blurred panels (`backdrop-filter: blur(...)`) on a
  near-black canvas. Used by `GlassButton`, `ViewTab`, sliders, the modals
  (`TaskModal`/`SettingsModal`/`AnalyticsModal`/`SessionSetupModal`), and the
  gamification/analytics widgets.
- **Flat solid-dark cards** — opaque bordered cards, no blur. Used by the app-shell
  screens: `FocusSetsScreen`, `AppSidebar`, `SetCelebration`, `XpBurst`, `CaptureScreen`,
  `TaskCard`, `DoneCard`.

Both render on a near-black canvas (`#060610`–`#09090c`). When composing a new screen,
match the surface of the components you use — don't mix a glass modal onto a flat-clean
page without intent.

## Setup
- **No provider/wrapper is needed** — every component renders standalone.
- **Dark canvas:** keep designs on a near-black background (`#060610`–`#09090c`).
  `styles.css` sets the dark `body` and loads the font.
- **Font:** Plus Jakarta Sans, loaded by `styles.css`. Don't substitute.

## Styling idiom
- **No utility classes and no theme tokens** — each component carries its own styling; you
  do NOT pass classNames to restyle them. Configure each through its **props** (read its `.d.ts`).
- **Accent:** green-lime `#bef24a`; success `#6bffb3`, info `#6b9fff`, plus per-category
  colors. Style only your **own** wrappers (flex/grid/gap) with inline styles, matching
  the font above.

## Components (props in each .d.ts / usage in .prompt.md)
- Buttons & inputs: `GlassButton`, `ViewTab`, `GlassSlider`, `WeightSlider`, `Dim`, `InlineCatAdd`
- Task UI: `TaskCard`, `DoneCard`, `TierBadge`, `ScoreRing`
- Gamification & analytics: `XPBar`, `MiniBars`, `Donut`, `StatCard`, `FocusRing`, `SideSection`
- Chrome: `MouseGlow` (fixed ambient glow), `UserChip`, `EmptyState`, `Toast`
- Modals (fixed overlays): `TaskModal`, `SettingsModal`, `AnalyticsModal`, `SessionSetupModal`
- Full-screen app shells (`position:fixed`, props drive real data): `FocusSetsScreen`
  (proposed focus sets), `AppSidebar` (persistent nav rail), `CaptureScreen` (the capture
  inbox — dump canvas + a merged New/Processed dump history)
- Reward overlays (`position:fixed`, transient): `SetCelebration` (set/combo/streak
  celebration), `XpBurst` (per-task "+N XP" pop)

## Build snippet
```jsx
import { TaskCard, GlassButton } from "brainqueue";

// dark surface; TaskCard carries its own (flat, Plus Jakarta) styling, you do the layout
<div style={{ background: "#09090c", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
  <TaskCard
    task={{ title: "Finish the Q2 report", categories: ["Work"], urgency: 5, importance: 5, effort: 4, energy: 4, est_minutes: 120 }}
    onEdit={() => {}} onMarkDone={() => {}} onDelete={() => {}} onSchedule={() => {}} />
  <GlassButton accent="#bef24a" onClick={() => {}}>+ Add task</GlassButton>
</div>
```
