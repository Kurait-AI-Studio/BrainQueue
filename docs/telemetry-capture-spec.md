# BrainQueue — Telemetry Capture Spec (append-only)

> **Why this doc exists and why it's *not* over-engineering:** capture is the one thing you cannot retrofit. Reprocessing is retrospective and cheap; an event you never logged is gone forever. So this spec is deliberately comprehensive on *what to record*. It says nothing about *how to use it* — the learning loop, evals, and recency-weighting are all reprocessing decisions you make later, against this same data. Nail capture now; defer everything else until you have users.

---

## The 7 principles (these matter more than the field list)

1. **Log raw, derive later.** Store the full model output and the raw input. Anything aggregated or derived is recomputable; the raw is not.
2. **Version everything that generates.** `prompt_version` + `model_id` + params on every AI output. This is what makes "was prompt v4 better than v3?" answerable retrospectively. It's the #1 thing people forget.
3. **Snapshot the decision at decision-time.** Record the tier/classification the system assigned *then*, even though you could recompute it — eval needs the real historical decision, not a re-derived one.
4. **Capture local time + context, not just UTC.** A deadline pushed at 11pm ≠ at 9am. Queue state at the moment of action can't be reconstructed afterward.
5. **Immutable, ordered, schema-versioned.** `event_id`, `sequence_number`, `schema_version` on every event, so you can evolve the schema without breaking old data.
6. **Tag consent state per event.** So future reprocessing/training only ever touches consented data.
7. **Acceptance is data too.** Log what was *not* changed (positive labels), not just edits.

---

## The event envelope (every event carries these)

| Field | Type | Why |
|---|---|---|
| `event_id` | uuid | idempotency, dedup |
| `user_id` | pseudonymous id | never raw PII as the key |
| `session_id` | uuid (nullable) | groups events within one app-open / focus session |
| `event_type` | enum | see catalog below |
| `ts_utc` | timestamp | canonical ordering |
| `ts_local` + `tz` | timestamp + string | behavioral patterns are local-time bound |
| `sequence_number` | monotonic int per user | reliable ordering even at equal timestamps |
| `schema_version` | int | evolve safely |
| `app_version` | string | attribute behavior to a build |
| `surface` | enum (web/ios/desktop + screen) | where it happened |
| `consent_state` | enum (full / product-only / none) | filter for lawful reuse |
| `source` | enum (user / google / microsoft / provider) | data provenance — training keeps only `user` |
| `payload` / `context` | json | event-specific fields (below); also carries `source` |

---

## 1. Capture & correction events — the preference goldmine

This is your highest-value data: the gap between what the AI proposed and what the user kept *is* your preference dataset.

| event_type | Key payload | What it enables later |
|---|---|---|
| `brain_dump_created` | `raw_text`, `input_method` (typed/voice/dictation), `char_count`, `lang` | input distribution; voice vs typed quality |
| `parse_requested` | `dump_id`, `prompt_version`, `model_id`, `params` | attribute every output to its generator |
| `parse_result` | `raw_model_output` (full JSON), `parsed_tasks[]`, `latency_ms`, `tokens_in/out`, `cost_est` | the AI's v1; raw output is irreplaceable |
| `task_features` (per task) | `est_duration`, `cognitive_load`, `ai_delegatable`, `category`, `multi_step`, `complexity`, `tier`, `confidence` | the *historical* classification decision (principle 3) |
| `clarifying_question_asked` | `task_ref`, `question`, `trigger` (low confidence field) | what the system finds ambiguous |
| `clarifying_question_answered` | `answer`, `latency_ms` | disambiguation signal + friction cost |
| `enrichment_applied` | `task_ref`, `fields_added` (deadline/category/first_step/why) | which enrichments users keep vs strip |
| `task_edited` (per edit) | `task_ref`, `field`, `before`, `after`, `edit_type`, `edit_latency_ms` | **the core preference pair** |
| `task_accepted_unchanged` | `task_ref`, `field` | **positive label** — don't only log edits |
| `final_committed` | `final_tasks[]`, `time_to_commit_ms`, `n_edits`, `n_accepted` | the v1→final delta, fully reconstructable |

`edit_type` enum (tag at capture, ideally via a cheap classification call): `reorder · reword · split · merge · delete · add · retag · redeadline · reprioritize · typo`. The `typo` tag is what lets you later *filter noise from signal*.

---

## 2. Task lifecycle / behavioral events

Per task, over its whole life. This is the "how the user operates" stream.

| event_type | Key payload | Signal it feeds |
|---|---|---|
| `task_created` | `task_id`, classification snapshot | baseline |
| `deadline_set` | `deadline`, `source` (user/ai) | — |
| `deadline_changed` | `old`, `new`, `direction`, `delta_days`, `push_count` | **"pushes deadlines on multi-step tasks"** |
| `task_scheduled` | `into` (session/timeblock/calendar), `when` | planning behavior |
| `task_started` | `at`, `in_session?` | activation |
| `task_paused` / `task_resumed` | `at`, `reason?` | interruption patterns |
| `task_completed` | `at`, `vs_deadline` (early/on-time/late + delta), `actual_duration`, `est_duration` | **deadline adherence + duration calibration** |
| `task_abandoned` / `task_deleted` | `at`, `reason?`, `age` | avoidance ("hates health tasks") |
| `task_snoozed` | `from`, `to`, `count` | deferral patterns |
| `task_reopened` | `at` | false completions |
| `recurring_instance_completed` | `template_id`, `streak`, `count` | **familiarity → reflex promotion** |

Note: `actual_duration` vs `est_duration` is gold — it's how you later learn the user's (and the model's) time-estimation bias.

---

## 3. Session & focus events

| event_type | Key payload | Signal |
|---|---|---|
| `session_planned` | `set_chosen`, `tasks[]`, `xp_shown`, `est_total`, `alternatives_shown` | which sets get picked over which |
| `session_started` | `ceremony_tier_shown`, `mode` (phone-away/pomodoro) | — |
| `pomodoro_started` / `break_started` / `break_ended` / `pomodoro_completed` / `pomodoro_skipped` | `interval_len`, `at` | focus rhythm; ideal interval per user |
| `notification_sent` | `type`, `content_ref` | — |
| `notification_response` | `opened` / `dismissed` / `ignored`, `latency_ms` | **nudge effectiveness** (so tips can learn to fade) |
| `tip_shown` / `tip_dismissed` | `tip_id` | which tips help vs annoy |
| `session_completed` / `session_abandoned` | `done_vs_planned`, `duration`, `interruptions` | session efficacy |

---

## 4. AI handoff events

| event_type | Key payload | Signal |
|---|---|---|
| `model_recommended` | `task_ref`, `complexity`, `recommended_tier`, `model_id`, `reasoning` | router decisions, for later eval |
| `preprompt_generated` | `task_ref`, `prompt_version`, `text` | which pre-prompts get used |
| `handoff_action` | `copied` / `deep_linked` / `ignored` | did the handoff actually help |
| `result_captured` (optional) | `task_ref`, `pasted_text?`, `marked_done` | outcome, if the user volunteers it |

---

## 5. System & version registries (the retrospective join keys)

Not event streams — small reference tables your events point at. Without these, principle 2 is impossible.

- `prompt_registry`: `prompt_version` → `full_text`, `created_at`, `notes`
- `model_registry`: `model_id` → `provider`, `$/1k_in`, `$/1k_out`, `created_at`
- `schema_registry`: `schema_version` → changelog

Every AI event stores the *id*; you join to get the full text/pricing later. This is what lets you ask "how did everything generated by prompt v3 on the mid model perform?" months from now.

---

## 6. Consent & retention (the one place "log everything" needs discipline)

Capturing comprehensively is right for *behavioral and structural* data — it's cheap and you can't recreate it. But two honest limits, because you're under GDPR and brain dumps are sensitive personal data:

- **Separate behavior from raw sensitive content.** Events, edits, timings, classifications, versions → log freely; they're the moat and they're low-sensitivity. Raw brain-dump *text* and AI outputs → still log (you need them for the correction pairs), but treat them as the sensitive tier: tied to `consent_state`, under a defined **retention policy**, and **deletable/exportable** per user.
- **Consent is per-purpose and separable.** "Use my data to run BrainQueue" ≠ "use my data to train BrainQueue's models." Log the consent state on every event so that when you *do* build the loop, you can trivially filter to the lawfully-usable subset. Retrofitting consent onto already-collected data is often legally useless — so this field is the one piece of "loop" plumbing worth having from day one.

You're not hoarding blindly — you're hoarding *behavior* generously and *sensitive content* deliberately, with a consent tag that future-proofs both.

---

## 6b. Implementation status (v2.3.0) — spec vs. reality

This spec is the target model; here's what's actually wired today:

- **Consent is built.** A user-facing **"Memory"** opt-in maps to `consent_state` (`full` =
  personalize + train, `product-only` = service only, `none` = minimal), versioned and recorded
  via immutable `consent_updated` events; lowering it logs `training_data_deletion_requested`.
- **Provenance is built.** Every event carries `source`; `consent.isTrainingEligible()` keeps only
  `full`-consent, `user`-sourced data, and **never** Google/Microsoft-derived data (`src/lib/consent.js`).
- **De-identification helper** (`src/lib/deidentify.js`) strips direct identifiers from free text
  before any record reaches a training set.
- **The correction pair is captured directly:** `final_committed` stores `final_tasks[]` + a
  `_pid → task id` map, so (model v1 → human-corrected output) is a 2-row read, not an edit replay.
- **First consumption exists:** Level 0 adaptation (`src/lib/adapt.js`) re-ranks from completions;
  cross-dump memory feeds existing categories/tasks back into new dumps. The deeper loop is ahead.
- **Brain Dump is v3:** categories are inferred (free text, not enum), a `due_date` is extracted.
- **Process guard:** any capture change must follow [`telemetry-change-checklist.md`](telemetry-change-checklist.md).

---

## What this unlocks (and why you decide none of it now)

Because every event is raw, timestamped, versioned, and append-only, all of the following become **reprocessing choices** you make later against the same data — not capture choices you're locked into now:

- **Recency weighting** — apply any half-life (7/30/90 days), sliding window, or exponential decay retrospectively and compare.
- **Multiple learning-loop versions** — rebuild the distilled user model several different ways and backtest each against real outcomes.
- **Classifier retraining** — the `task_features` snapshots + final outcomes are a labeled dataset.
- **Prompt/model evals** — the correction pairs + version registries are your golden set and your A/B history.
- **Time-estimation calibration, avoidance detection, ideal-pomodoro-length** — all derivable, none needing to be decided up front.

> **Standing rule, again:** build the *capture* now (it's one-shot and unrecoverable). Build the *processing* — loop, evals, weighting, router — only after you have paying users and real accumulated data. Logging well is preparation; modeling early is the trap.
