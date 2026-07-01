# BrainQueue — orientation for a new session

Read this first, then jump to the linked docs for depth. Goal: understand *what we're
building, why, and where things live* in two minutes.

## The thesis (why this exists)
BrainQueue is a personal task manager whose **moat is behavioral telemetry**. The product
(capture → focus → complete) is the surface; the durable asset is an **append-only event
log of how a person actually plans, prioritizes, focuses, and finishes**. The long game is
a **learning loop** that turns that log into better proposals. The first rung is built:
**Level 0 adaptation** (Do Now re-ranks toward the tasks you actually complete, `src/lib/adapt.js`)
and **cross-dump memory** (new dumps reuse your categories and avoid duplicates). The deeper
loop (per-user profiles, distillation) is still ahead — and needs real users producing real data.

Headline feature: **Brain Dump** — paste messy notes, an LLM returns scored tasks with
**inferred categories** (gym → "Sports"), **due dates**, and clean rewritten details. Plus
focus sets + Pomodoro, XP/levels, weekly review, analytics, **first-run onboarding**, and
**Memory** (opt-in personalization + model-training consent).

## Stack & shape
- **React + Vite SPA.** The authed app's state + logic lives in `src/MainApp.jsx`; `src/App.jsx`
  is the auth/session shell. `src/lib/` holds the pure domain logic (tasks, adapt, consent, etc.).
- **Supabase** — auth (OAuth + magic link, CAPTCHA on magic link), Row-Level Security, task
  sync + realtime, telemetry tables, and the brain-dump edge function. Migrations
  `supabase/migrations/` (0001–0010).
- **Brain Dump is provider-aware** (OpenAI / Anthropic) behind one shared prompt + JSON schema
  (`src/brainDumpSpec.js`, also used by `eval/`), called via a server-side edge function so keys
  never reach the browser. Default model: **`gpt-4.1-mini`** (~11× cheaper than Sonnet 4.6).

## Where things live
- `src/App.jsx` — the auth/session shell only (39 lines): Supabase session state, the
  signed-out `LoginScreen`, and mounting `<Analytics/>`/`<SpeedInsights/>`. Lazy-loads
  `MainApp` once a session exists.
- `src/MainApp.jsx` — the authed app's state + logic: Supabase task/capture sync, telemetry
  (`logEvent` + the durable outbox, via `src/lib/client.js`), calendar glue, and the screens
  that are still inline here rather than extracted (the header/shell chrome, modals wiring).
  `FocusMode`, `BrainDumpModal`, `CaptureScreen`, and `LoginScreen` are already extracted
  into `src/ui/` — don't assume they're inline.
- `src/ui/` — presentational component library; `index.js` re-exports everything. Includes
  `FocusSetsScreen` (the focus-set picker/editor), `CaptureScreen` (the Capture inbox),
  `BrainDumpModal`, `FocusMode`, `LoginScreen`, and `AppSidebar`.
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
  `app_version` (injected from package.json), `surface`, `consent_state`, `tz`, `ts_local`,
  `event_at`, `event_type`, `task_id`, and a jsonb `context` (which also carries `source` —
  `"user"` vs `"google"`/`"microsoft"` — so training only ever uses user-authored data).
  **Delivery is durable**, not fire-and-forget: `logEvent`
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
`_result`/`_failed`, `final_committed`, `braindump_added`, `weekly_review_viewed`,
`consent_updated`, `training_data_deletion_requested`, `onboarding_completed`.
- `parse_requested`/`_result` carry `prompt_version` (currently `braindump-v3`), `model_id`,
  tokens/cost, and `dump_context` (counts of cross-dump categories/tasks injected).
- `final_committed` carries `final_tasks[]` + a `_pid → task id` map — a self-contained
  training pair (model v1 → the human-corrected result), plus the per-field edit deltas.

Brain-dump categories are now **inferred** (free text), not a fixed enum; tasks carry a
`due_date`. **Consent / Memory:** `consent_state` is `full | product-only | none`; only `full`
permits model training, and training data must pass `consent.isTrainingEligible` + be
de-identified (`src/lib/deidentify.js`). See [`docs/telemetry-change-checklist.md`].

Migrations apply via the Supabase SQL editor or `supabase db push`. If push wants to re-run
old migrations, the remote history is out of sync — `supabase migration repair --status
applied <versions>` first. (0008 = `event_id` unique index; 0009 = daily dump quota;
0010 = `due_date` + braindump-v3.)

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
- [`docs/data-flow-map.md`](docs/data-flow-map.md) — every user route, what data each captures, and where to add an AI layer (with a diagram).
- [`docs/legal/`](docs/legal/) — privacy policy (incl. §4 training consent), terms, CGV, mentions légales, cookie notice (drafts).
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — the product end-to-end, screen by screen (`docs/workflow/*.png`).
- [`docs/RELEASING.md`](docs/RELEASING.md) — versioning + release process (tag-triggered).
- [`docs/deploy-checklist.md`](docs/deploy-checklist.md) — env vars, migrations, secrets, smoke tests, OWASP table.
- [`docs/model-agnostic-strategy.md`](docs/model-agnostic-strategy.md) · [`docs/personalization-strategy.md`](docs/personalization-strategy.md) · [`docs/distribution-strategy.md`](docs/distribution-strategy.md) — strategy.
- [`README.md`](README.md) — Brain Dump deep dive (prompt, schema, model choice).
- [`CHANGELOG.md`](CHANGELOG.md) — what has shipped. **Current: v2.5.0.**

## Current state (v2.5.0)
Built: capture inbox ("capture now, process later", with a processed-dump history and
New/Processed badges) + sync, Brain Dump **v3** (inferred categories + due dates + clean
notes, `gpt-4.1-mini`, cross-dump memory), focus sets with a max-work-time ceiling, Pomodoro,
XP + celebrations, weekly review, analytics, durable telemetry, **first-run onboarding**,
**Memory** (opt-in consent + the nudge), **Level 0 adaptation** (learned weights), and a
hardened security posture (CSP/HSTS headers, Turnstile captcha, daily dump cap, CORS
allowlist, CI audit).
**The deeper learning loop** (per-user profiles / Level 1–2, distillation) is the next frontier
and needs real users. Remaining refactor: extract the infra-coupled inline screens from
`MainApp.jsx`.
