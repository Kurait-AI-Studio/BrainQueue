# Changelog

All notable changes to BrainQueue are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
`vMAJOR.MINOR.PATCH` — see [docs/RELEASING.md](docs/RELEASING.md) for what counts
as a major vs. mid-level release.

## [Unreleased]
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

[Unreleased]: https://github.com/Kurait-AI-Studio/BrainQueue/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Kurait-AI-Studio/BrainQueue/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Kurait-AI-Studio/BrainQueue/releases/tag/v1.0.0
