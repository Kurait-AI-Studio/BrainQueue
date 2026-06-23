# BrainQueue

A personal task manager built around one idea: **the data is the moat**. The product —
capture, focus, complete — sits on top of an append-only event log of how you actually
plan, prioritize, and finish, so the system can get better at proposing *what to do next*.
(That learning loop is the goal; the capture foundation is what's built today.)

The headline feature is **Brain Dump**: paste any messy note and an LLM turns it into
scored, categorized tasks.

## What's inside
- **Brain Dump** — messy notes → scored, categorized tasks via Anthropic structured outputs.
- **Focus sets + Pomodoro** — proposed task sets (Do Now / Quick Wins / Deep Work / Low
  Energy) with a **max-work-time ceiling**, an inline editor to customize/reorder, and a
  focus timer.
- **Gamification** — XP curve, levels, set/streak bonuses, celebrations.
- **Weekly review & analytics** — completions over time, capture rate, focus minutes.
- **Behavioral telemetry** — an immutable, append-only `task_events` log with **durable
  delivery** that records the full lifecycle of every task and focus set. This is the moat.

## Stack
React + Vite SPA · Supabase (auth + RLS + sync + realtime) · Anthropic API (Brain Dump).
App state and glue live in [`src/App.jsx`](src/App.jsx); reusable UI in `src/ui/`; pure
domain logic in `src/lib/`; database schema in `supabase/migrations/`.

## Docs
- [`CLAUDE.md`](CLAUDE.md) — fast orientation: architecture, the data/telemetry model, conventions.
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — the product end to end, screen by screen.
- [`docs/telemetry-capture-spec.md`](docs/telemetry-capture-spec.md) — the telemetry capture spec (the moat).
- [`docs/RELEASING.md`](docs/RELEASING.md) — versioning + the tag-triggered release process.
- [`CHANGELOG.md`](CHANGELOG.md) — what has shipped (current: **v2.2.0**).

## Brain Dump — how it works

Source of truth for the feature lives in [`src/brainDumpSpec.js`](src/brainDumpSpec.js):
the system prompt, the JSON schema, the model id, and a `sanitizeTask` clamp.
The UI is `BrainDumpModal` in [`src/App.jsx`](src/App.jsx).

Flow:

1. User pastes a brain dump (any format/language) and hits **Parse & classify**
   (or ⌘/Ctrl+Enter).
2. The browser calls the Anthropic Messages API with the user's own key (from
   Settings, stored in `localStorage`), using **structured outputs**
   (`output_config.format` + a strict JSON schema) — so the response is
   guaranteed-valid JSON, no regex scraping, no truncation surprises.
3. Each task comes back with `category`, `urgency`, `importance`, `effort`,
   `energy`, `notes`. `sanitizeTask` clamps anything out of range so a bad value
   can't crash the UI.
4. The preview is **editable** — fix a title, change the category, nudge any
   score, or drop a task — then **Add**. Scores are recomputed locally by
   `calcScore` with the user's weight settings.

To change the model, edit `BRAIN_DUMP_MODEL` in `src/brainDumpSpec.js`.

## Choosing a model (cheap / old / open-source)

Brain Dump is a single cheap classification call — a great candidate for a small
or open-source model. Don't guess; measure:

```bash
ANTHROPIC_API_KEY=sk-ant-... node eval/run-eval.mjs
```

This runs every fixture in [`brain-dump-samples/`](brain-dump-samples) (dozens of
real-world formats: numbered lists, prose, checkboxes, Notion tables/CSV, voice
transcripts, multilingual, Trello/Slack exports, noise) through every model in
[`eval/models.config.json`](eval/models.config.json), and writes a report with
**cost per 1,000 dumps**, latency, failure rate, and each model's full output.
See [`eval/README.md`](eval/README.md). It can benchmark Claude (Opus/Sonnet/Haiku)
and any OpenAI-compatible endpoint (OpenRouter, Groq, Together, local Ollama) in
one run.

### If you pick an open-source model

The app currently calls Anthropic directly from the browser. Anthropic supports
direct browser calls; most OSS providers don't (CORS), and you'd be exposing a
shared key. To ship a non-Claude or near-free model, add a small serverless
proxy (e.g. a Vercel Function at `api/braindump`) that holds the provider key and
forwards the same prompt/schema. The eval harness already speaks that
OpenAI-compatible shape, so the prompt/schema carry over unchanged.

## Dev

### Run the app locally (do this before pushing)

```bash
npm install            # first time only
npm run dev            # starts Vite at http://localhost:5173
npm run dev:fresh      # same, but opens a brand-new browser profile (see below)
```

Open **http://localhost:5173** in your browser. Hot-reload is on, so saved edits
appear instantly.

**Testing as a first-time user.** Your Supabase session and cached tasks live in
the browser's `localStorage`, so a normal reload keeps you logged in. To simulate
a brand-new user every time, run **`npm run dev:fresh`** — it starts Vite and
opens the app in a throwaway browser profile (empty storage = no session, no
cached tasks). Just close that window when done; the temp profile is discarded.
Stop everything with Ctrl+C.

Sanity-check a production build too before pushing:

```bash
npm run build          # must succeed before you push
npm run preview        # optional: serve the built bundle to verify it
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` for sync and
login (without them the login screen shows a "Supabase isn't configured" notice).
Make sure `http://localhost:5173` is in your Supabase **Authentication → URL
Configuration → Redirect URLs**, or the OAuth round-trip is rejected.

### Logging in

Auth is handled by Supabase in the browser, so logging in is a UI action, not a
terminal command. On the login screen:

- **Continue with Google / GitHub** — one click, redirects to the provider and back.
- **Magic link** — type your email, click *Send magic link*, then open the link
  on this device.

### Logging out

- Click the **⏻** button in the top-right header — that calls `supabase.auth.signOut()`.
- To fully reset the local session while testing (e.g. to switch accounts), run
  this in the browser DevTools console, then reload:

  ```js
  localStorage.clear(); location.reload();
  ```
