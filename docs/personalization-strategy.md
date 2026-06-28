# BrainQueue — Adaptation Strategy (real personalization, not a false promise)

> "Adaptation" is a better frame than "learning loop" — softer, accurate, and it sets the
> right expectation (the product *adjusts to you*, it doesn't claim a brain transplant).
> This doc lays out the options from cheapest to most expensive, what each *feels* like to a
> user, where it shows up in the app, and **what it costs** — so you can pick with a clear
> view of value vs margin.

## The headline answer to your three questions

- **"Constantly evolving per-user context?"** → **Yes — this is the right architecture.** A
  rolling, per-user profile + retrieved examples from their own event log, injected into the
  model and the scoring. Cheap, strong, and genuinely "remembers you."
- **"Fine-tuned model per user?"** → **No. Don't.** Bad economics, bad quality (too little
  per-user data → overfit), operational nightmare (thousands of model variants to host).
  Per-user *context* gives ~90% of the feel at ~1% of the cost.
- **"Where can personalization appear?"** → Almost every surface (table in §3). The cheapest
  layer (learned weights) already personalizes the core ranking with **zero LLM cost**.

## 1. The spectrum — four levels, cheapest first

| Level | What it is | Feels like | Cost / engaged user / mo* | Verdict |
|---|---|---|---|---|
| **0 — Learned signals** | Your own code over the event log: learned scoring `weights`, real task durations (their actual vs estimated), energy-by-time-of-day, avoidance detection, category bias | "Do Now reorders the way *I* actually work"; "your 'quick' tasks really take ~20 min" | **~$0** (no LLM) | **Build first. Highest ROI.** |
| **1 — Evolving per-user context** | A rolling ~300-token "profile" summarizing patterns + a few retrieved examples, injected into the brain-dump prompt and proposals | "It remembers I do deep work in the morning and hate admin; dumps come back more *me*" | **~$0.02–0.05** | **The core of "Memory." Build next.** |
| **1.5 — Few-shot from own corrections** | Inject a handful of this user's (dump → corrected) pairs into the prompt | Extraction matches their style/wording without being told | **+~$0.01** | Cheap multiplier on Level 1 |
| **2 — Cohort fine-tune / distillation** | One small model fine-tuned on *aggregate* (consented, de-identified) corrections — better baseline for everyone | Everyone's extraction gets sharper; cheaper inference | one-time **~$100–500** + cheaper inference; per-user negligible | Scale play (1k+ users) |
| **3 — Per-user fine-tune** | A model trained per individual | Marginally more tailored than Level 1 | **impractical** — a train job + a hosted model *per user* | **Never** |

*On `gpt-4.1-mini`. Numbers from `docs/model-agnostic-strategy.md`.

**The arc:** Level 0 now → Level 1 (+1.5) with your first cohort → Level 2 at scale. Skip 3 forever.

## 2. Why "evolving context" wins over "per-user model"

- **Data reality:** one user produces little data — far too little to fine-tune a good model, plenty to *summarize into a profile + retrieve examples*. Context uses small data well; fine-tuning needs lots.
- **Cost reality:** context = a few hundred tokens per call (~cents/month). Per-user fine-tune = recurring compute + storage/serving per user (dollars, and ops hell).
- **Update reality:** context updates **instantly** as behavior changes (rewrite the profile). A fine-tune is stale until the next expensive retrain.
- **Privacy reality:** context built from *de-identified* events, gated by `isTrainingEligible`, is far easier to govern (and to *forget* on withdrawal) than a model with a user baked in.
- **It's the same pattern the whole industry uses** (assistant "memory" = retrieved context, not a model per person).

So: **per-user adaptation = memory/RAG over their own event log + learned weights. Model fine-tuning, if ever, is per-*cohort* to lift the shared baseline.**

## 3. Where adaptation shows up (map to features)

| Surface | Generic today | Adapted (Level 0/1) | Cheapest level that does it |
|---|---|---|---|
| Brain-dump scoring | fixed rubric | scores weighted to *your* revealed priorities | 0 |
| Do Now / proposal order | `DEFAULT_WEIGHTS` | learned per-user weights | 0 |
| Task durations | estimate from effort | *your* actual completion times | 0 |
| Focus-set sizing | generic time/energy | sized to your real capacity + rhythm | 0 |
| Energy matching | none | heavy tasks → your high-energy windows | 0 |
| Avoidance handling | none | detect chronically-postponed → resurface / break down | 0 |
| Extraction style/wording | model default | matches your phrasing & categories | 1 / 1.5 |
| Weekly review insights | templated stats | patterns specific to you | 0 (deepen with 1) |
| Reminder timing | fixed | when *you* actually act | 0 |

Note how much is **Level 0** — real, visible personalization at **zero LLM cost**. That's what backs the "adapts to you" promise without a false note, and without touching margin.

## 4. Margin impact — clear numbers

At **$9.99/mo** (net ~$9.40 after Stripe), per engaged user:

| Stack | AI cost / mo | Gross margin |
|---|---|---|
| Today (base brain dump, gpt-4.1-mini) | ~$0.04 | ~99.5% |
| + Level 0 (learned signals) | +$0.00 | ~99.5% |
| + Level 1 + 1.5 (context + few-shot) | +~$0.03–0.06 | ~99% |
| Power user, full stack | ~$0.15–0.25 | ~97–98% |

**Adaptation does not threaten margin** — *as long as it's context, not per-user models.* Even the full Level 0+1+1.5 stack stays under ~$0.10/user for a typical user. The only way to wreck the margin is per-user fine-tuning (Level 3), which is exactly why you don't do it.

## 5. What to build, in order

1. **Level 0 — learned weights + real durations** (no LLM). The fastest path to *visible* "it adapts to me," backs the Memory promise honestly, and is free. Reads the event log you already capture; writes a per-user signal profile.
2. **Level 1 — rolling per-user profile** injected into the brain-dump prompt + proposals. A cheap periodic summarization call + a few hundred tokens per dump.
3. **Level 1.5 — few-shot from the user's own corrections** (you already capture `final_committed.final_tasks` — the labeled pairs are sitting there).
4. **(Scale) Level 2 — cohort fine-tune/distillation** once you have enough consented, de-identified data.

Every level reads only `isTrainingEligible` + de-identified data (see `docs/telemetry-change-checklist.md`), so adaptation and privacy stay aligned.

## 6. The honest-promise test

Before shipping a personalization claim, ask: *can a user notice it within their first week?* Level 0 passes (re-ordering, real durations are visible fast). A vague "it learns" that only pays off in months fails. **Ship the visible, cheap adaptation first** — that's what turns "Memory" from a promise into a felt experience.
