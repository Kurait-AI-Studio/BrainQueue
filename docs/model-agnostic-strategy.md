# BrainQueue · Model-Agnostic Strategy

> The thesis: **the model is a swappable commodity; the moat is the data.** BrainQueue should
> get better every week because its telemetry is captured, curated and fed back so well that a
> small/cheap/open-source model performs like a frontier one on *our* distribution. We never
> want to depend on any single provider to deliver the magic.

Status date: 2026-06-26. Author seed: strategy review of the current app.

---

## 1. Where we are (honest status)

### What is genuinely built and strong
- **Immutable event log** (`task_events`): append-only, RLS allows insert+select only — even the
  owner can't rewrite history. This is the correct moat substrate.
- **Durable, crash-safe delivery** (`src/lib/telemetry.js`): outbox persisted before any network
  call, idempotent upsert on `event_id`, no-drop / no-gap guarantees, unit-tested. Data integrity
  is real, not aspirational.
- **Rich event taxonomy** that already captures the one signal that matters most:
  `task_accepted_unchanged` vs `task_edited` vs `task_deleted` — the **implicit human label** on
  every model output. Plus full session/pomodoro/break/reward/weekly-review events.
- **Retrospective join keys**: every `parse_result` stamps `model_id`, `prompt_version`,
  `tokens_in/out`, `cost_est`. Backed by `prompt_registry` / `model_registry` / `schema_registry`.
  This is exactly what lets us ask, months later, "was prompt v2 better than v1 on model X?"
- **Provider-abstracted serving** (`supabase/functions/brain-dump`): Anthropic + OpenAI normalized
  into one response shape, server-side key, model allowlist. Switching model = one line in
  `src/brainDumpSpec.js`. No train/serve skew: the eval harness imports the same spec that ships.
- **Model-independent prompt**: explicitly written to be provider-neutral, with a worked example to
  pull cheaper/cross-provider models up to Claude's behavior.

**Verdict: the capture and serving foundations for model-agnosticism are ~80% there.** This is
further than almost any pre-launch app. The gap is not capture — it's *feedback*.

### What is missing (the real gaps)
1. **No closed learning loop.** We capture corrections but nothing reads them back to improve future
   output. The landing-page promise "personalization that improves every week" is currently
   **unbacked**. This is the #1 gap.
2. **Scoring is not personalized.** `DEFAULT_WEIGHTS` is a constant; `calcScore(task, w)` takes a
   weights arg but every caller passes the default. We never learn a user's revealed priorities from
   accept/edit/complete behavior.
3. **No golden eval set from real data.** The eval runs on fixture dumps, not on hard, real,
   multilingual edge cases mined from production. So we *cannot yet prove* a cheap/OSS model is
   "good enough" on what our users actually paste.
4. **No OSS/self-host route.** The edge function speaks Anthropic + OpenAI only. No generic
   OpenAI-compatible route to reach Together / Fireworks / Groq / OpenRouter / a local vLLM.
5. **No curation pipeline.** Events sit in Postgres; nothing turns them into datasets, gold sets,
   few-shot banks, or a fine-tune corpus.
6. **No per-task routing.** Every dump hits the same model. We don't yet escalate the hard ones or
   downgrade the trivial ones, even though `multi_step` / `est_minutes` / length signals exist.

---

## 2. The model questions, answered honestly

### Does open source improve margin?
**Not yet, and not for margin reasons.** Brain Dump is a short structured-extraction call
(~1–2k tokens). On hosted small models the per-call cost is already trivial (≈$0.0002–0.0008/dump
on gpt-4o-mini / gpt-4.1-mini). The big margin win — leaving Sonnet 4.6 — is a 30× drop already
available with a one-line change. OSS doesn't beat that at our stage.

Where OSS *does* eventually win is **independence, privacy, latency, and distillation on our own
data** — not the bill. Treat OSS as a sovereignty and speed play, not a cost play.

### Serving options (in the order they make sense)
1. **Serverless OSS APIs** — Together, Fireworks, Groq, DeepInfra, OpenRouter. Pay-per-token OSS
   (Llama 3.3, Qwen2.5, etc.), zero infra, all OpenAI-compatible. **Right first step.** One new route
   in the edge function unlocks all of them. Groq/Cerebras give very high tokens/sec.
2. **Dedicated autoscaling endpoint** — Together/Fireworks dedicated, Modal, Replicate. Scale-to-zero
   on some. Sensible at medium, steady volume.
3. **Self-managed GPU + vLLM/TGI/SGLang** — Runpod, Lambda, Vast.ai, cloud L4/A100. Cheapest per
   token *only at high steady utilization*. Most ops burden. Scale play.
4. **Buying GPUs** — only with predictable 24/7 saturation for >1 year. For a spiky consumer app on a
   call this cheap, **don't.** You'd own power, cooling, drivers, uptime — for a box idle most of the
   day.

### Varying website activity (peak vs near-idle)
This is the decisive factor and it argues *against* owning/reserving GPU early. A GPU costs the same
at 2% load as at 98%; consumer traffic is spiky and timezone-clustered, so average utilization is
low — terrible economics on owned hardware. **Let the provider absorb the variance:** stay on
per-token serverless until there's a steady utilization floor. If/when self-hosting, use
scale-to-zero serverless (Modal/Runpod serverless) and accept a cold-start (5–60s model load) on the
first call after idle.

### Does it change tokens/sec (latency)?
Yes, often **in your favor.** Groq/Cerebras run OSS at 500–1000+ tok/s; a quantized 8B on an L4 is
fast; vLLM-batched throughput is high. Brain Dump output is ~300–800 tokens, so a fast small model
is frequently *quicker* than Sonnet. The risk is quality-at-speed (a fast 8B may mis-split a messy
multilingual dump) — which is exactly what the golden eval must measure before any swap.

### Buy cheap GPUs vs rent?
**Rent.** A used 3090/4090 ($700–1600) can run a quantized 7–13B, but for our workload and traffic
shape, owned hardware sits idle and ties up capital + ops. Rent per-token now; rent reserved
capacity later if utilization justifies it; buy only at large, predictable scale (probably never for
this specific call).

### "Sometimes I'll need a more expensive model" — the edge cases
Correct, and the architecture should make this automatic, not a guess. **Per-task routing:** send the
trivial/short dumps to the cheapest model, escalate the hard ones (very long, multilingual,
low-confidence, `multi_step` heavy) to a frontier model. Route on signals we already produce. The
golden eval tells us *which* inputs need escalation, so the routing threshold is data-driven.

---

## 3. The lever: data closes the model-quality gap

Your instinct is right. The same cheap model performs very differently depending on what we wrap
around it. Ranked by leverage:

1. **Few-shot bank mined from real corrections.** Inject a handful of (dump → corrected output)
   examples, chosen per-user or per-cluster. This is the single biggest quality lift for a small
   model — often closing most of the gap to a frontier model, at near-zero added cost.
2. **Personalized scoring from behavior.** Learn each user's revealed `weights` from what they
   accept, reorder, complete, and avoid. The *score* becomes personal regardless of which model did
   the extraction. (Today: `DEFAULT_WEIGHTS`, never adapted.)
3. **Golden eval set from production.** Curate real, hard, labeled dumps. This is what turns "is OSS
   good enough?" from a feeling into a passing/failing number — and it's the gate every model swap
   must clear.
4. **Distillation.** Once enough gold (dump → good output) pairs exist, fine-tune a small OSS model
   on *our* distribution. This is how we truly stop depending on frontier providers — the model
   becomes ours, cheap, fast, and private.

The data is the booster. The model is the interchangeable part.

---

## 4. How to be model-agnostic from the start (architecture)

We already are, structurally. To finish it:

- **A1 — Generic OpenAI-compatible route.** Add one branch to the edge function (`provider:
  "compatible"` with a configurable base URL) → reach Together/Fireworks/Groq/OpenRouter/local vLLM.
  Keep the server-side allowlist.
- **A2 — Eval gate.** No model becomes `BRAIN_DUMP_MODEL` without passing the golden set at a quality
  threshold *and* a cost+latency budget. Swapping a model becomes a data-driven release, not a guess.
- **A3 — Per-task routing.** A cheap default with rule-based escalation on the hard inputs. Log the
  routing decision so we can tune the threshold from outcomes.
- **A4 — Confidence + correction capture as first-class.** Persist the model's per-task output next
  to the user's correction so every parse yields a training pair automatically.

---

## 5. Next steps (sequenced)

> **Status update (v2.3.0):** items 1, 2, and 4 below are **shipped**; a blind model duel
> (`eval/duel.*`) stands in for part of the golden set. Remaining: the golden-set gate, the
> few-shot bank, and the scale/OSS work.

**Now (pre-traction, no GPU, no OSS yet):**
1. ✅ **Done** — `BRAIN_DUMP_MODEL` is `gpt-4.1-mini` (~11× cheaper), with a server-authoritative
   per-day dump cap (migration 0009).
2. ✅ **Done** — the **correction-capture pair** ships: `final_committed.final_tasks` + `task_id_map`
   store `{dump → model_output → user_final}` per parse, the raw material for everything in §3.
3. Start the **golden set**: hand-label 30–50 real dumps (you have `brain-dump-samples/` + the duel
   outputs), including multilingual and messy ones, with known-good outputs.

**Next (first users, first loop):**
4. ✅ **Done (Level 0)** — **personalized scoring** learns `weights` from completions and re-ranks
   Do Now (`src/lib/adapt.js`), gated on Memory. The first visible "it learns me" feature.
5. Build the **few-shot bank** from corrections; inject per-user. Re-run the duel/eval to quantify
   the lift on small models.
6. Add the **eval gate** (A2) to CI so no regression ships.

**Later (scale / sovereignty):**
7. Add the **generic OSS route** (A1) and benchmark Llama/Qwen on the golden set for quality, cost,
   tokens/sec.
8. Add **per-task routing** (A3): cheap-by-default, escalate hard inputs.
9. If steady volume justifies it, evaluate a **reserved/scale-to-zero OSS endpoint**; consider
   **distillation** once gold pairs are plentiful.

**The line that ties it together:** capture the correction pairs *now*, build the golden set and the
feedback loop *with your first users*, and treat every model swap as an eval-gated decision. Do that
and the model is never your dependency — your data is your advantage.
