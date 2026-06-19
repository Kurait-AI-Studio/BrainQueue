-- BrainQueue · telemetry capture v2 — the full event envelope + version registries.
-- Implements the Telemetry Capture Spec's principles 2–6 (the can't-retrofit fields).
-- Run in the Supabase SQL editor. Idempotent.

-- 1. Envelope fields on the immutable event log -------------------------------
alter table public.task_events
  add column if not exists event_id        uuid,
  add column if not exists session_id      bigint references public.sessions(id) on delete set null,
  add column if not exists sequence_number bigint,        -- monotonic per user
  add column if not exists schema_version  smallint default 1,
  add column if not exists app_version     text,
  add column if not exists surface         text,          -- web/ios/desktop + screen
  add column if not exists consent_state   text default 'product-only', -- full | product-only | none
  add column if not exists tz              text,          -- IANA tz at event time
  add column if not exists ts_local        text;          -- local wall-clock (sortable string)

create index if not exists task_events_seq_idx on public.task_events (user_id, sequence_number);

-- 2. Version registries — the retrospective join keys (principle 2) -----------
create table if not exists public.prompt_registry (
  prompt_version text primary key,
  full_text      text,
  source_ref     text,            -- where the canonical text lives (e.g. git path)
  notes          text,
  created_at     timestamptz not null default now()
);
create table if not exists public.model_registry (
  model_id   text primary key,
  provider   text,
  price_in   numeric,             -- $ / 1M input tokens
  price_out  numeric,             -- $ / 1M output tokens
  created_at timestamptz not null default now()
);
create table if not exists public.schema_registry (
  schema_version smallint primary key,
  changelog      text,
  created_at     timestamptz not null default now()
);

-- Registries are shared reference data: any authenticated user may read them.
do $$ begin
  alter table public.prompt_registry enable row level security;
  alter table public.model_registry  enable row level security;
  alter table public.schema_registry enable row level security;
exception when others then null; end $$;
drop policy if exists "prompt_registry_read" on public.prompt_registry;
create policy "prompt_registry_read" on public.prompt_registry for select to authenticated using (true);
drop policy if exists "model_registry_read" on public.model_registry;
create policy "model_registry_read" on public.model_registry for select to authenticated using (true);
drop policy if exists "schema_registry_read" on public.schema_registry;
create policy "schema_registry_read" on public.schema_registry for select to authenticated using (true);

-- 3. Seed the current versions ------------------------------------------------
insert into public.schema_registry (schema_version, changelog) values
  (1, 'Initial event envelope: event_id, session_id, sequence_number, schema_version, app_version, surface, consent_state, tz, ts_local.')
  on conflict (schema_version) do nothing;
insert into public.model_registry (model_id, provider, price_in, price_out) values
  ('claude-sonnet-4-6', 'anthropic', 3.0, 15.0)
  on conflict (model_id) do nothing;
insert into public.prompt_registry (prompt_version, source_ref, notes) values
  ('braindump-v1', 'src/brainDumpSpec.js@BRAIN_DUMP_SYSTEM', 'Brain Dump extraction system prompt + JSON schema; canonical text is git-versioned in the repo.')
  on conflict (prompt_version) do nothing;
