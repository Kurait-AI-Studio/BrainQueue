# BrainQueue — working notes for Claude

## What this is
A personal task manager. React + Vite SPA, Supabase (auth + RLS + sync). Headline
feature: **Brain Dump** (paste messy notes → scored, categorized tasks via the
Anthropic API). Also: focus sessions/Pomodoro, XP/levels, analytics, recurrence,
multi-category, "pleasure" rating.

## Project location
Lives at `~/dev/brainqueue` (moved off `~/Desktop` — Desktop is macOS TCC-protected
and kept revoking file access mid-task). Keep it out of Desktop/Documents/Downloads.

## Layout
- `src/App.jsx` — the app: state, Supabase/auth/calendar glue, and the still-inline
  screens (`ScheduleModal`, `BrainDumpModal`, `FocusMode`, `Sidebar`, `LoginScreen`).
- `src/ui/` — the **component library** (presentational, reusable). `index.js`
  re-exports everything: tokens, GlassButton, ViewTab, ScoreRing, GlassSlider,
  TierBadge, TaskCard, DoneCard, widgets (XPBar/MiniBars/Donut/StatCard/SideSection/
  FocusRing/SessionStepper), MouseGlow, misc (Dim/WeightSlider/EmptyState/
  InlineCatAdd/Toast/UserChip), and the modals (Task/Settings/Analytics/SessionSetup).
- `src/lib/tasks.js` — pure task domain logic (categories, scoring, XP/levels,
  analytics, recurrence, classification, date utils).
- `src/brainDumpSpec.js` — Brain Dump prompt + schema (shared with eval harness).

## Commands
- `npm run dev` — Vite dev server (http://localhost:5173).
- `npm run dev:fresh` — dev + a throwaway browser profile (test as a first-time user).
- `npm run build` — production build (must pass before pushing).
- `npm run build:ui` — library build → `dist-ui/` (what `/design-sync` packages).
- `npm run shots` — **screenshot the whole UI gallery** (desktop + iPhone, plus each
  modal on mobile) into `screenshots/`. One command; boots + shuts the server itself.

## ⚠️ UI workflow rule
**After changing any component in `src/ui/` (or app screens), run `npm run shots` and
review `screenshots/`** to visually verify desktop + mobile before considering it done.
This is the visual-QA loop — the gallery (`gallery.html` + `src/preview/`) renders every
component with mock data and **no login**, so the authenticated UI can be checked at
iPhone width without signing in.

## Conventions
- Identity: dark `#060610` + lime `#e8ff5a` accent; glassmorphism via `glass`/
  `glassStrong` from `src/ui/tokens`. Fonts: Syne (display) + DM Mono (body).
- Commit style: conventional prefixes (`feat:`/`fix:`/`chore:`/`refactor:`/`docs:`),
  short body, **no Co-Authored-By line**.
- Supabase schema changes go in `supabase/migrations/` (run them in the SQL editor).
- Internal mockups/exports are gitignored (`design-*.html`, `/*.csv`, roadmap/scripts).

## Roadmap context
`/design-sync` uploads `src/ui` to claude.ai/design so the design agent builds new
screens from the real components. Remaining refactor: extract the 5 infra-coupled
screens after a `src/lib/` infra pass (supabase/auth/calendar/focus).
