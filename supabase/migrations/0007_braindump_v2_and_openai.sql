-- BrainQueue · register the brain-dump v2 prompt and the OpenAI route's models.
-- These are the retrospective join keys for telemetry (Capture Spec, principle 2):
-- every parse_* event stamps model_id + prompt_version, and the weekly review joins
-- back to these tables to price runs and compare prompt/model versions over time.
-- Run in the Supabase SQL editor after deploying the provider-aware brain-dump
-- function. Idempotent — safe to re-run.

-- New models reachable through the brain-dump edge function's allowlist. Prices are
-- $ / 1M tokens and mirror BRAIN_DUMP_MODELS in src/brainDumpSpec.js.
insert into public.model_registry (model_id, provider, price_in, price_out) values
  ('claude-haiku-4-5', 'anthropic', 1.0,  5.0),
  ('gpt-4o-mini',      'openai',    0.15, 0.6),
  ('gpt-4.1-mini',     'openai',    0.4,  1.6),
  ('gpt-4o',           'openai',    2.5,  10.0)
  on conflict (model_id) do nothing;

-- The v2 extraction prompt: provider-neutral framing so Anthropic and OpenAI produce
-- the same tasks behind the shared schema, tighter split/dedup + category tie-break
-- rules, and a worked micro-example so cheaper/cross-provider models match Claude.
-- Schema is unchanged, so no new schema_registry row.
insert into public.prompt_registry (prompt_version, source_ref, notes) values
  ('braindump-v2', 'src/brainDumpSpec.js@BRAIN_DUMP_SYSTEM',
   'v2: provider-neutral (Anthropic + OpenAI) wording, tighter split/dedup + category tie-break rules, and a worked micro-example. Schema unchanged from v1.')
  on conflict (prompt_version) do nothing;
