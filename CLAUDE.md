# BrainQueue — orientation for a new session

Read this first, then jump to the linked docs for depth. Goal: understand *what we're
building, why, and where things live* in two minutes.

## The thesis (why this exists)
BrainQueue is a personal task manager whose **moat is behavioral telemetry**. The product
(capture → focus → complete) is the surface; the durable asset is an **append-only event
log of how a person actually plans, prioritizes, focuses, and finishes**. The long game is
a **learning loop** that turns that log into better proposals (which tasks, in what order,
for how long). Foundations are built; **the learning loop is not built yet** — events are
captured but nothing consumes them. Needs real users producing real data.

Headline feature today: **Brain Dump** — paste messy notes, an LLM returns scored,
categorized tasks. Plus focus sets + Pomodoro, XP/levels, weekly review, analytics.

## Stack & shape
- **React + Vite SPA.** Most app logic and state lives in `src/App.jsx` (large on purpose).
- **Supabase** — auth (OAuth + magic link), Row-Level Security, task sync + realtime, and
  the telemetry tables. Schema lives in `supabase/migrations/` (0001–0008).
- **Anthropic API** for Brain Dump via structured outputs; the spec (prompt + JSON schema)
  is `src/brainDumpSpec.js`, shared with the eval harness in `eval/`.

## Where things live
- `src/App.jsx` — app state, Supabase/auth/calendar glue, telemetry (`logEvent` + the
  durable outbox), and the still-inline screens (`FocusMode` timer, Brain Dump, login).
- `src/ui/` — presentational component library; `index.js` re-exports everything. Includes
  `FocusSetsScreen` (the focus-set picker/editor) and `AppSidebar`.
- `src/lib/` — pure domain logic: `tasks.js` (scoring, XP, classification, `buildProposals`),
  `xp.js`, `rewards.js`, `weeklyReview.js`.
- `src/preview/` + `gallery.html` — **auth-free** gallery that renders every component with
  mock data (`?view=focus`, `?modal=…`). This is how UI is verified without signing in.
- `supabase/migrations/` — DDL. `supabase/functions/` — edge functions. `eval/` — Brain
  Dump eval harness. `scripts/` — `shots.mjs` (gallery screenshots), `dev-fresh.mjs`.

## The data / telemetry model (the part that matters most)
Three tables + registries (see [`docs/telemetry-capture-spec.md`](docs/telemetry-capture-spec.md)):
- **`tasks`** — synced task rows (RLS-scoped per user).
- **`task_events`** — the **immutable, append-only moat**. Insert/select only, never
  update/delete. Each row carries an envelope: `event_id` (unique → idempotent retries),
  `user_id`, `session_id`, `sequence_number` (per-user, localStorage), `schema_version`,
  `app_version`, `surface`, `consent_state`, `tz`, `ts_local`, `event_at`, `event_type`,
  `task_id`, and a jsonb `context`. **Delivery is durable**, not fire-and-forget: `logEvent`
  writes to a localStorage **outbox**, then `flushOutbox` upserts on `event_id` and retries
  on next event / reconnect / reload — so nothing is silently lost or double-written.
- **`sessions`** — focus-session rows (planned/completed task ids, focus_seconds). *Mutable
  and best-effort* — the authoritative set lifecycle is also in `task_events`:
  `session_started` carries `base_set_ids` (original proposal) + `final_ids` (set actually
  run) + `max_work_minutes`; `session_completed` carries `completed_ids` + `planned_ids`.
- **Registries** (`prompt_registry`, `model_registry`, `schema_registry`) — retrospective
  join keys so old events stay interpretable.

Main event types: `task_created`, `task_features`, `task_completed`/`_late`, `task_edited`/
`_deleted`/`_restored`, `session_started`/`_completed`, `session_task_queued`, `bonus_earned`,
`pomodoro_completed`, `break_started`/`_ended`, `brain_dump_created`, `parse_requested`/
`_result`/`_failed`, `final_committed`, `braindump_added`, `weekly_review_viewed`.

Migrations apply via the Supabase SQL editor or `supabase db push`. If push wants to re-run
old migrations, the remote history is out of sync — `supabase migration repair --status
applied <versions>` first. (0008 added the `event_id` unique index for idempotent delivery.)

## Commands
- `npm run dev` — dev server (http://localhost:5173). `dev:fresh` — throwaway profile (first-time UX).
- `npm run build` — production build; **must pass before pushing**. `npm run lint`.
- `npm run build:ui` — library build → `dist-ui/` (what `/design-sync` packages).
- `npm run shots` — screenshot the whole gallery (desktop + iPhone) into `screenshots/`.
- `npm run eval` / `npm run rate` — Brain Dump eval harness.

## Working rules
- **After changing anything in `src/ui/` or an app screen, run `npm run shots` and review
  `screenshots/`** (desktop + mobile) before calling it done.
- **Never break the telemetry invariants:** `task_events` stays append-only; delivery stays
  durable (outbox + idempotent upsert); new envelope fields are reconstructable, not retrofitted.
- **Changing telemetry = privacy/legal review.** Any new event type, `context` field, or
  captured data must follow [`docs/telemetry-change-checklist.md`](docs/telemetry-change-checklist.md):
  stamp the right `source`, keep `isTrainingEligible` + de-identification (`src/lib/deidentify.js`)
  correct, **never let Google/Microsoft data into training**, and update the privacy policy.
  Capture and disclosure must not drift apart.
- **Commits:** Conventional Commits (`feat`/`fix`/`chore`/`refactor`/`docs`), short body,
  **no Co-Authored-By line**. Releases are tag-driven — see [`docs/RELEASING.md`](docs/RELEASING.md)
  (a `feat:` → MINOR; only `feat!:`/`BREAKING CHANGE:` → MAJOR).
- **Location:** `~/dev/brainqueue`. Keep it off `~/Desktop` (macOS TCC revokes file access there).
- Loose root files (`design-*.html`, `*.csv`, `brainqueue-feature-roadmap.md`, video scripts)
  are intentionally **gitignored local artifacts** — not part of the tracked repo.

## Docs index
- [`docs/telemetry-capture-spec.md`](docs/telemetry-capture-spec.md) — the capture principles (the moat spec).
- [`docs/telemetry-change-checklist.md`](docs/telemetry-change-checklist.md) — pre-merge checklist when capture changes (consent, source, de-id, Google policy).
- [`docs/legal/`](docs/legal/) — privacy policy (incl. §4 training consent), terms, CGV, mentions légales, cookie notice (drafts).
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — the product end-to-end, screen by screen (`docs/workflow/*.png`).
- [`docs/RELEASING.md`](docs/RELEASING.md) — versioning + release process (tag-triggered).
- [`README.md`](README.md) — Brain Dump deep dive (prompt, schema, model choice).
- [`CHANGELOG.md`](CHANGELOG.md) — what has shipped. **Current: v2.2.0.**

## Current state (v2.2.0)
Built: capture/sync, Brain Dump, focus sets with a max-work-time ceiling, Pomodoro, XP +
bonuses + celebrations, weekly review, analytics, durable telemetry with full set-composition
capture. **Not built: the learning loop** (events are collected; nothing learns from them yet).
Remaining refactor: extract the infra-coupled inline screens from `App.jsx` after a `src/lib/`
infra pass (supabase/auth/calendar/focus).
