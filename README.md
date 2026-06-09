# BrainQueue

A personal task system. React + Vite SPA, Supabase for sync. The headline
feature is **Brain Dump**: paste any messy note and an LLM turns it into scored,
categorized tasks.

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

```bash
npm install
npm run dev      # vite dev server
npm run build    # production build
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` for sync
(the app runs local-only without them).
