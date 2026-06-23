# Changelog

All notable changes to BrainQueue are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
`vMAJOR.MINOR.PATCH` — see [docs/RELEASING.md](docs/RELEASING.md) for what counts
as a major vs. mid-level release.

## [Unreleased]

### Changed
- **Unified the design language.** The app had drifted into two themes — a lime `#e8ff5a`
  accent with Syne + DM Mono on the older modals/list, and a green `#bef24a` with Plus Jakarta
  Sans on the v2 Focus Mode screens. Consolidated onto one accent and one font, now defined as
  tokens in `src/ui/tokens.js` (`accent`, `bg`, `font`). The app loads a single font.

## [2.2.1] — 2026-06-23
Faster first load, and a test net under the telemetry moat.

### Changed
- **Faster first load via code-splitting.** The app shipped as one ~527 kB JS bundle, so the
  login screen parsed code it didn't need. The heavy on-demand screens (Analytics, Settings,
  task add/detail, the Focus Mode picker) are now lazy-loaded, and React + Supabase are split
  into vendor chunks. Entry JS drops to ~80 kB and ~29 kB of screen code loads only when
  opened. Lighthouse (mobile): performance **85 → 90**, total blocking time **130 ms → 0**,
  time-to-interactive ~0.5 s faster.

### Internal
- Telemetry delivery extracted to `src/lib/telemetry.js` with an `npm test` suite (Node's
  built-in runner) pinning the durable-delivery guarantees: no silent drop, retry on failure,
  no sequence gaps. A CI workflow runs the tests + a production build on every push and PR.

## [2.2.0] — 2026-06-23
Tell Focus Mode how much time you actually have, and trust the event log: a max-work-time
ceiling reshapes the proposed sets, and telemetry now delivers durably and records the full
shape of every focus set.

### Added
- **Max work time in Focus Mode.** A slider (15 min – 3h) sets how long you're willing to
  work. It's a **ceiling, not a target**: each set fills up to it, so giving it more time only
  adds a task when one actually fits — sets whose tasks are all short (Quick Wins) often stay
  put while a set of long tasks (Deep Work) grows. The chosen ceiling is recorded as
  `max_work_minutes` on `session_started`.
- **Set composition is now in the event log.** `session_started` records the original
  proposal (`base_set_ids`) and the set you actually run (`final_ids`); `session_completed`
  records `completed_ids` + `planned_ids`. The full lifecycle of a focus set is reconstructable
  from two immutable events alone — independent of the mutable sessions row.
- **Add animation.** A task that newly joins a set — via the slider or the editor's **＋ Add** —
  animates in with a brief highlight ring. Respects `prefers-reduced-motion`.

### Fixed
- **Durable telemetry delivery.** Events are no longer fire-and-forget: each is written to a
  localStorage outbox and retried (next event / reconnect / reload) instead of being silently
  dropped on a transient failure. Retries are idempotent via a unique `event_id` (migration
  0008), so the immutable log never loses an event, leaves a sequence gap, or double-writes.

## [2.1.0] — 2026-06-23
Make focus sets yours: customize and reorder proposed sets, build custom sets, open a rich
task detail view, and queue tasks into a session — all captured as set-origin telemetry.

### Added
- **Task detail view + session tray.** Clicking a task in **All Tasks** now opens a wide
  detail view — every dimension (urgency/importance/effort/energy/pleasure) as a labeled bar,
  the classification (est, cognitive load, recurrence, multi-step, AI-delegatable), notes and
  dates. From the detail view (or the new **＋** on any card) you can **add tasks to a focus
  session**: a tray shows the queue and opens the focus-set editor pre-seeded, or **Focus on
  this now** starts a single-task session.
- **Set-origin telemetry.** `session_started` now records how the set was assembled
  (`proposed` / `customized` / `custom` / `tray` / `single`), whether it was **reordered**, and
  how many tasks were **added/removed** vs the proposal — signal for the future learning loop.
  New `session_task_queued` event when a task is added to a session from the list.
- **Customizable focus sets.** Any proposed set in Focus Mode now has a **Customize** action
  that opens an inline editor: **reorder** tasks (▲▼ per task or **⇅ Reverse** to invert the
  whole order — the top task runs first), **remove** tasks, **add** tasks from the rest of your
  list, and rename the set. Plus **Build a custom set from scratch**. Starting the editor's set
  enters a focus session with exactly that order.

## [2.0.0] — 2026-06-21
The redesign release: a full Focus Mode, a gamification system (XP curve, levels,
bonuses, celebrations), a persistent sidebar shell, a cleaner visual identity, and the
weekly review — built on the telemetry foundation laid in 1.x.

### Added
- **Focus Mode redesign — "Focus Sets Proposed for You."** A full-screen, sidebar-led
  view that presents the top 3 proposed task sets as rich cards (per-set XP badge, four
  metric tiles, task list, Choose button), driven by the real `buildProposals` + per-task
  XP. Replaces the old session-setup modal; choosing a set starts a focus session.
- **XP curve & levels (`src/lib/xp.js`).** A geometric progression where quick early
  levels give onboarding wins and Level 10 ("Transformed", ~22.5k XP) represents months
  of consistent focus. Visualized in `docs/xp-curve.html`. Single source of truth for
  level/title (re-exported from `lib/tasks`).
- **Bonus XP rewards + earn animation.** Stackable bonuses (full set, combo ×3, 7-day
  streak, early bird) shown under the sets, and an `XpBurst` "+N XP" pop that fires on
  task completion — the dopamine layer.
- **Big set-clear celebration.** A full-screen confetti celebration that fires only when
  a whole focus set is cleared, a 3-set combo lands, or a streak is hit (`src/lib/rewards.js`
  tracks daily set count + streak; bonuses logged as `bonus_earned`).
- **Persistent app sidebar.** The Focus Mode sidebar is now the whole app's shell — a
  fixed rail on desktop, a drawer on mobile (`AppSidebar`), wired to Focus / All Tasks /
  Analytics / Rewards / Settings. Replaces the old drawer sidebar; Plus Jakarta Sans
  loaded globally.

### Fixed
- **Focus Mode on mobile.** The full-screen Focus Sets view was desktop-only — the 234px
  sidebar crushed the three cards into unreadable slivers on phones. It's now responsive:
  the overlay sidebar hides (the header's ✕ Close exits), cards stack vertically, and the
  bonus tiles wrap.
- **Settings weight pills on mobile** no longer clip the last pill — the rigid 5-column
  grid now wraps (`auto-fit`).

### Changed (cont.)
- **Clearer sidebar nav** — recognizable icons (🎯 📋 📊 🏆 ⚙️) and brighter inactive
  labels in `AppSidebar` and the Focus Mode rail.
- **Removed the CSV export** button from the header.

### Changed
- **Task cards restyled** (`TaskCard`, `DoneCard`) to the new clean look — flat dark
  cards, category accent bar, Plus Jakarta Sans — so the whole app is visually
  consistent with the new sidebar and Focus Mode.
- **design-sync:** registered `FocusSetsScreen`, `AppSidebar`, `SetCelebration`, and
  `XpBurst` in the component map with authored preview fixtures; `preview.css` now loads
  Plus Jakarta Sans. Run `/design-sync` to push.
- **Weekly review.** A narrative recap that reads your behaviour back to you —
  completion count (vs last week), how much of what you captured you finished,
  focused-effort time, a per-category breakdown, your strongest day, and your biggest
  win. Stats are computed exactly; the wording varies week to week so it reads like a
  thoughtful AI note. Opens from the sidebar and logs a `weekly_review_viewed` event.
  The first feature that *reads* the telemetry moat.
- **Selectable review tone.** Choose how the weekly recap talks to you in Settings —
  Kind, Motivational, Direct, or Tough love. Each tone has its own phrasing bank over
  the same exact stats; the chosen tone is stamped on the `weekly_review_viewed` event.

## [1.1.0] — 2026-06-20
Mid-level release: Brain Dump can now run on a second model provider.

### Added
- **Multi-provider Brain Dump.** The `brain-dump` edge function is now provider-aware:
  it routes to Anthropic *or* OpenAI behind the same JSON schema and rewraps OpenAI's
  response into the Anthropic shape, so the app parses every reply identically.
- **Model registry in the spec** (`BRAIN_DUMP_MODELS`): provider + per-million pricing
  for each supported model. Switching the active model is a one-line change, and the
  provider/pricing/route follow automatically.
- New OpenAI models registered for telemetry pricing joins: `gpt-4o-mini`,
  `gpt-4.1-mini`, `gpt-4o` (plus `claude-haiku-4-5`).

### Changed
- **Brain Dump prompt → `braindump-v2`:** provider-neutral wording so Anthropic and
  OpenAI produce the same tasks, tighter split/dedup and category tie-break rules, and
  a worked micro-example so cheaper models match Claude's quality.
- Cost estimates in telemetry are now priced per chosen model from the registry, instead
  of a hardcoded Sonnet rate.
- `parse_requested` / `parse_result` events now stamp the `provider`.

## [1.0.0] — 2026-06-20
First tagged release. The core product: capture, prioritize, and focus.

### Added
- **Brain Dump.** Paste freeform notes in any format or language; the model extracts,
  deduplicates, scores (urgency/importance/effort/energy), and classifies tasks via
  structured outputs. Runs server-side through a Supabase edge function so the model API
  key never reaches the browser.
- **Task scoring & prioritization** with adjustable weights, plus task tiers and
  effort/cognitive-load classification.
- **Focus Mode + Pomodoro sessions:** full-screen distraction-free focus, work/break
  cycles, and manual breaks.
- **Telemetry capture v2:** an append-only, immutable event log with a full event
  envelope (session, sequence, schema/app version, surface, consent, tz), a Brain Dump
  "correction goldmine" (raw input, raw model output, per-field edits), and version
  registries for prompts/models/schemas.
- **Supabase backend:** OAuth + magic-link auth, row-level security, realtime sync, and
  per-user localStorage caching.
- **Design system:** components extracted to `src/ui`, synced to Claude Design, with a
  no-auth preview gallery and Playwright screenshot automation.

[Unreleased]: https://github.com/Kurait-AI-Studio/BrainQueue/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Kurait-AI-Studio/BrainQueue/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Kurait-AI-Studio/BrainQueue/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/Kurait-AI-Studio/BrainQueue/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Kurait-AI-Studio/BrainQueue/releases/tag/v1.0.0
