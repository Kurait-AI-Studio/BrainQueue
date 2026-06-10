# Brain Dump model benchmark

Decide which model should power BrainQueue's Brain Dump by running every sample
in [`../brain-dump-samples`](../brain-dump-samples) through every model you want
to compare — using the **exact** system prompt and JSON schema the app ships
(`../src/brainDumpSpec.js`). The point: find out whether a cheap, old, or
open-source model is good enough, so you only pay Vercel/Supabase.

No dependencies. Node 18+ (uses global `fetch`).

## Run it

```bash
# Claude models only (uses your Anthropic key — your own key, billed to you)
ANTHROPIC_API_KEY=sk-ant-... node eval/run-eval.mjs

# A subset of models or samples
node eval/run-eval.mjs --only haiku-4-5,sonnet-4-6
node eval/run-eval.mjs --samples 01,13,26

# Add open-source models: enable them in models.config.json (enabled:true),
# then provide the key for their provider
OPENROUTER_API_KEY=sk-or-... node eval/run-eval.mjs
```

## Configure models

Edit [`models.config.json`](./models.config.json). Three Claude models are
enabled by default; several open-source ones are present but `enabled:false`.

Each model entry:

| Field | Meaning |
| --- | --- |
| `provider` | `"anthropic"` (native Messages API) or `"openai"` (any OpenAI-compatible `/chat/completions`) |
| `baseUrl` | For `openai` provider — OpenRouter, Groq, Together, Fireworks, or `http://localhost:11434/v1` for Ollama |
| `apiKeyEnv` | Env var name to read the key from |
| `model` | The provider's model id |
| `jsonSchema` | `true` → request strict `json_schema` output; `false` → `json_object` + tolerant parsing (for models without schema support) |
| `price` | `{ in, out }` USD per 1M tokens — used to project cost. **Confirm against your provider.** |
| `enabled` | Whether this run includes it |

### Where to get nearly-free open-source inference

- **OpenRouter** (`https://openrouter.ai/api/v1`) — one key, dozens of models, pay per token. Easiest for comparison.
- **Groq** (`https://api.groq.com/openai/v1`) — very fast, generous free tier.
- **Together / Fireworks** — cheap hosted Llama/Qwen/Mistral.
- **Ollama** (`http://localhost:11434/v1`) — fully free, runs locally; `ollama pull llama3.1:8b` first, set `OLLAMA_API_KEY=ollama`.

All of these speak the OpenAI-compatible API, so they use the `openai` provider
here — just change `baseUrl`, `model`, and `apiKeyEnv`.

## Output

Each run writes to `eval/results/<timestamp>/` (gitignored):

- `report.md` — summary table (failures, total tasks, avg latency, **cost per 1,000 dumps**) + a per-sample task-count matrix.
- `<model-id>.json` — that model's full output for every sample (titles, categories, scores) so you can read actual quality, not just counts.
- `cells.json` — every result, raw.

## Blind rating UI (the real decision-maker)

Objective numbers (cost, latency, failures) only get you so far — quality is a
judgment call, and you don't want to be biased by the model's name. The rating
tool shows you each model's output **anonymized** so you score quality blind,
then reveals the mapping and ranks everything.

```bash
node eval/rate-server.mjs        # → http://localhost:4321   (or: npm run rate)
```

Workflow:

1. Pick the eval run to rate.
2. For each sample you see the original dump, then every model's output as
   **Model A / B / C…** — stable labels, but shuffled position per sample, and
   the real names are never sent to the browser until you finish.
3. Score each output 1–5 on four metrics, optionally add a note, and star the
   best output for that sample. Everything **auto-saves** as you go.
4. **Finish & reveal** → the mapping is unblinded and you get a ranking table:
   each metric's average, an overall **Quality** score, how many times each
   model was picked best, plus **latency** and **$/1k** pulled from the eval run.

The four metrics (defined in `rate-server.mjs` → `METRICS`, edit to taste):

| Metric | What you're judging |
| --- | --- |
| **Coverage** | Caught every real task — nothing important missed |
| **Precision** | No junk — dropped headers/dates/done items/noise; invented nothing |
| **Titles** | Clean imperative wording, translated to English, deduped, markers stripped |
| **Attributes** | Category + urgency/importance/effort/energy are sensible |

Every finished rating is written to `eval/ratings/<timestamp>__<runId>.json`
(full record: mapping, per-output scores, notes, aggregates). Rate the same run
as many times as you like — each finish is its own timestamped file, so you can
compare your own judgments over time or average several passes.

## Growing the benchmark (you will)

Designed to extend without touching code:

- **New model** → add an entry to `models.config.json` (any Anthropic or
  OpenAI-compatible endpoint), re-run `node eval/run-eval.mjs`. The new model
  shows up automatically in the next rating session.
- **New user case** → drop a `.txt` / `.md` / `.csv` file into
  `../brain-dump-samples/` (e.g. a tricky dump a user sends you), re-run the
  eval. The rater discovers samples and models straight from the run's
  `cells.json`, so nothing else changes.
- **New metric** → edit the `METRICS` array in `rate-server.mjs`.

## How to judge "good enough"

1. **Failures** — any model that errors or returns unparseable output can't hold the format. Disqualify.
2. **Quality** (from blind rating) — the headline number. This is bias-free because you scored it without knowing the model.
3. **Cost / 1k dumps** — your affordability number. Haiku and the cheap OpenAI/OSS tiers land in fractions of a cent.
4. **Latency** — matters for the in-app "Classifying…" wait.

Then set the winner in `../src/brainDumpSpec.js` → `BRAIN_DUMP_MODEL` (if it's a
Claude model). If the winner is open-source or OpenAI, you'll need a serverless
proxy (the app currently calls Anthropic directly from the browser) — see the
note in the project README.
