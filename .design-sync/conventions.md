# BrainQueue UI — how to build with these components

A dark, glassmorphism React component library. Components are **self-contained and
styled internally with inline styles** — there are no CSS classes to apply and (with
the exception of `GlassButton`'s `className`/`style` passthrough) no styling props.
You compose them and write only your own layout glue with inline `style={{}}`.

## Setup
- **No provider/wrapper is needed** — every component renders standalone.
- **Dark canvas:** components are designed for a near-black background. `styles.css`
  sets `body { background:#060610 }` and loads the fonts; keep designs on a dark
  surface or the glass components look wrong.
- **Fonts:** Syne (display/headings, 700–800) and DM Mono (body/data), loaded by
  `styles.css`. Don't substitute them.

## Styling idiom
- **No utility classes and no theme tokens** — each component carries its own glass
  styling; you do NOT pass classNames to restyle them.
- **Accent is lime `#e8ff5a`**; green/success `#6bffb3`, blue/info `#6b9fff`, on the
  `#060610` background. Surfaces are translucent white ("glass").
- **Style only your own wrappers** with inline styles (flex/grid/gap), matching the
  fonts: `fontFamily: "'Syne', sans-serif"` for labels, `"'DM Mono', monospace"` for body.
- Configure each component through its **props** — read its `<Name>.d.ts`.

## Components (props in each .d.ts / usage in .prompt.md)
- Buttons & inputs: `GlassButton`, `ViewTab`, `GlassSlider`, `WeightSlider`, `Dim`, `InlineCatAdd`
- Task UI: `TaskCard`, `DoneCard`, `TierBadge`, `ScoreRing`
- Gamification & analytics: `XPBar`, `MiniBars`, `Donut`, `StatCard`, `FocusRing`, `SideSection`
- Chrome: `MouseGlow` (fixed ambient glow), `UserChip`, `EmptyState`, `Toast`
- Modals (fixed overlays): `TaskModal`, `SettingsModal`, `AnalyticsModal`, `SessionSetupModal`

## Build snippet
```jsx
import { GlassButton, TaskCard } from "brainqueue";

// dark surface; TaskCard carries the glass styling, you do the layout
<div style={{ background: "#060610", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
  <TaskCard
    task={{ title: "Finish the Q2 report", categories: ["Work"], urgency: 5, importance: 5, effort: 4, energy: 4, est_minutes: 120 }}
    onEdit={() => {}} onMarkDone={() => {}} onDelete={() => {}} onSchedule={() => {}} />
  <GlassButton accent="#e8ff5a" onClick={() => {}}>+ Add task</GlassButton>
</div>
```
