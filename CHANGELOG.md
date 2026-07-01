# Changelog

All notable changes to BrainQueue are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
`vMAJOR.MINOR.PATCH` — see [docs/RELEASING.md](docs/RELEASING.md) for what counts
as a major vs. mid-level release.

## [Unreleased]

## [2.5.0] — 2026-07-01
The Capture screen gets a real design pass, and "previous dumps" finally shows your actual
dump history — not just what's still waiting to be sorted.

### Added
- **Vercel Web Analytics + Speed Insights.** Page views and Core Web Vitals now flow into
  the Vercel dashboard. Also wired `section_click` / `view_tab_click` events at every real
  navigation point (sidebar, header quick actions, the Do Now/Quick Wins/etc. tabs) — a
  lightweight usage view, separate from the Supabase telemetry moat (`task_events`), which
  exists to feed the future learning loop rather than answer "what do people click."
- **Processed-dump history in Capture.** "Previous dumps" used to only ever show the
  pending queue — once a dump was processed it vanished from view entirely. It now shows
  your recent history too, each entry tagged **New** or **Processed**; tapping a processed
  entry reveals when it was captured and processed (not the raw text again — summary only).

### Changed
- **Capture screen redesign.** An editorial header, a "Private by design" badge, and the
  dump textarea now sits in its own clearly-bordered card with a distinct "well" so it's
  obvious where typing lands. Icons (chevron, document, lock, shield) are now inline SVGs
  instead of text/emoji glyphs, which rendered inconsistently — and looked off-center —
  depending on the device's font fallback. The card also gets a lime-green halo and a
  gentle lift on hover.

### Fixed
- **Onboarding no longer replays for already-onboarded users.** Completion was tracked only
  in `localStorage`, which doesn't follow you to a new browser, device, or cleared profile.
  Now falls back to checking for an existing `onboarding_completed` event before replaying.
- **"Previous dumps" is reachable without scrolling.** The toggle used to sit below the
  header, canvas, and save button — easily below the fold on mobile. It now sits right
  after the header, still collapsed by default.

## [2.4.0] — 2026-07-01
Capture inbox ships: "capture now, process later" stops being just the thesis and becomes
a real, usable part of the app.

### Added
- **Capture inbox.** A new "Capture" tab (pending-count badge) decouples getting a thought
  out of your head from processing it into tasks: type or paste, then "Capture & keep"
  (saved, field clears, walk away) or "Capture & process now". Lands right after onboarding.
- **Captures sync across devices** via a new `captures` table (RLS-protected owner CRUD),
  falling back to local-only if the migration hasn't been applied yet.
- **Raw → corrections lineage.** Processing a capture stamps `capture_id` through
  `brain_dump_created` → `parse_requested` → `final_committed`, so the full chain — raw
  note, submitted dump, model output, human-corrected result — is reconstructable.
- **Near-duplicate detection** (warns, never blocks): the Brain Dump preview flags tasks
  resembling existing open ones, and the Capture inbox warns when a new note resembles an
  earlier capture.
- **Batch sort-all.** Sorting is now "Sort all into tasks" — every saved capture is combined
  and processed together in one dump, instead of one at a time.
- **Stale-capture reminder.** A calm, non-guilt nudge ("You captured something N days
  ago...") once a capture has sat unprocessed for 3+ days; dismiss snoozes it a day.
- **XP resistance bonus.** A heavy (effort ≥ 3), dreaded (pleasure ≤ 2) task now earns bonus
  XP scaled to how avoided and how long it was — rewarding the grind on exactly the tasks
  ADHD makes easiest to avoid.
- **Settings → Replay onboarding**, so anyone who skipped it can re-see the flow without
  the console.

### Changed
- **Onboarding's Memory step is select-then-confirm.** Tapping a card highlights it; a
  separate "Turn on Memory" / "Continue without Memory" button confirms the choice — a more
  deliberate consent moment.
- **Capture screen redesigned**, twice this cycle: first calmer and more reassuring (soft
  glow, "What's on your mind?", low-pressure copy, "Save it" as the easy default), then a
  golden-ratio layout (Fibonacci spacing, golden-rectangle canvas) with saved captures
  hidden by default behind a discreet "Saved · N ▸" toggle so the inbox never overwhelms.
- **Cross-dump category consistency now runs for everyone**, not only with Memory on. It
  uses only your own data to serve your own dump (providing the service, not training), so
  it doesn't require the training opt-in. Memory still gates behavioral learning (Level 0)
  and model training.

### Fixed
- **Crash on every login.** A temporal-dead-zone bug (`captures` read before its destructure
  in a new `useMemo`) threw on every mount with no error boundary, blanking the app after
  any sign-in method.
- **Captcha failures now show their real reason** instead of one generic message — the
  actual provider code (`invalid-input-response`, `timeout-or-duplicate`, etc.) is
  surfaced, and Cloudflare Turnstile's own client-side error code (e.g. domain-not-allowed)
  is now logged and shown instead of discarded.
- **Magic-link double-submit.** Enter + a button tap, or a fast double-tap, could fire two
  requests with the same single-use captcha token — the second always failed with
  `timeout-or-duplicate`, even on a valid first attempt. Guarded, then hardened with a
  `useRef` lock to close a residual race on genuinely synchronous double-dispatch (e.g. iOS
  Safari's touchend + click).
- **Captcha-timeout errors no longer read as user error.** A `timeout-or-duplicate` response
  is almost always Supabase's own call to the captcha provider not completing in time
  (confirmed against a live status.supabase.com capacity incident) — the message now says
  plainly it isn't the user's fault.

### Internal
- `app_version` in telemetry is now injected from `package.json` at build time, so it can
  never drift from the released version again (it had drifted to `0.0.0`).

## [2.3.0] — 2026-06-28
The release that turns the telemetry foundation into a real, consent-based product:
privacy-respecting personalization, a first-run experience, a hardened security posture,
and a much cheaper, smarter Brain Dump.

> Requires applying Supabase migrations **0009** (daily Brain Dump quota) and **0010**
> (`due_date` column + braindump-v3 prompt) in the SQL editor.

### Added
- **Memory (opt-in personalization).** An optional, versioned data-use consent with three
  levels (Personalized / Standard / Minimal), mapped to the telemetry `consent_state`.
  Memory on = BrainQueue learns from you; off = it stays generic. Reversible in Settings,
  with a gentle in-app nudge.
- **First-run onboarding.** Welcome → a demo brain dump → a simulated focus session with an
  XP win → the Memory ask (two honest contrast cards), so new users see the value and make
  an informed, free choice.
- **Level 0 adaptation.** With Memory on, Do Now re-ranks toward the tasks you actually
  complete (learned scoring weights), shown with a "Tuned to you" marker.
- **Cross-dump memory.** Consecutive brain dumps build on each other — the model reuses your
  existing categories and avoids recreating tasks you already have.
- **Security.** Full HTTP security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer /
  Permissions-Policy) on the app and landing; CAPTCHA (Cloudflare Turnstile) on magic-link
  login; a server-authoritative daily Brain Dump cap; an edge-function CORS allowlist; CI
  dependency scanning (Dependabot + `npm audit`).
- **Telemetry capture.** `final_committed` now carries the committed result + a `_pid → task
  id` map (a self-contained training pair); every event is tagged with its data `source`
  (user vs provider); consent changes are recorded as immutable events. Plus a
  de-identification helper, the no-Google-data-in-training rule, and a telemetry-change
  checklist so capture and disclosure never drift.
- **Blind model duel** (`eval/duel.*`) to compare extraction quality head-to-head, and legal
  drafts (privacy policy with model-training consent, terms, CGV, mentions légales, cookie
  notice) plus a branded magic-link email + SMTP guide.

### Changed
- **Brain Dump v3.** Categories are now *inferred* (gym → "Sports", a project → its name)
  instead of a fixed list of 7; deadlines are extracted into a real `due_date`; surrounding
  context is rewritten into clean task details. The preview shows labeled, color-coded,
  editable features ("This week", "15 min") instead of cryptic "U4".
- **Brain Dump model → GPT-4.1-mini** — about 11× cheaper than Sonnet 4.6 at near-identical
  extraction quality.
- **User-facing errors are humanized** — no raw SQL/DB text reaches the UI, and email-delivery
  problems no longer masquerade as captcha errors.
- **Telemetry `app_version`** is now stamped correctly (was `0.0.0`).

### Fixed
- Landing-page navigation was unreachable on mobile (no menu) — added a hamburger sheet.

## [2.2.2] — 2026-06-23
A coherent look and a much faster first load, on top of a big internal cleanup.

### Changed
- **Unified the design language.** The app had drifted into two themes — a lime `#e8ff5a`
  accent with Syne + DM Mono on the older modals/list, and a green `#bef24a` with Plus Jakarta
  Sans on the v2 Focus Mode screens. Consolidated onto one accent and one font, now defined as
  tokens in `src/ui/tokens.js` (`accent`, `bg`, `font`). The app loads a single font.
- **Much faster first load.** The signed-out page now downloads only React + Supabase + a tiny
  (~6 kB gzip) login entry; the entire authed app is lazy-loaded on sign-in. Lighthouse (mobile)
  improved from **90 → 98** across the release, with largest-contentful-paint and
  time-to-interactive each ~1 s faster.

### Internal
- Broke the 1,800-line `App.jsx` into focused modules — `src/lib/client.js` (Supabase +
  telemetry runtime), `src/lib/calendar.js`, and `src/ui/{LoginScreen,FocusMode,BrainDumpModal,
  WeeklyReviewModal,ScheduleModal}.jsx`, plus `src/MainApp.jsx`. `App.jsx` is now a ~30-line root.

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
