-- BrainQueue · classification metadata for tasks (drives the reflex/standard/heavy tier).
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

alter table public.tasks add column if not exists est_minutes    integer;
alter table public.tasks add column if not exists cognitive_load smallint;   -- 1..5
alter table public.tasks add column if not exists ai_delegatable boolean default false;
alter table public.tasks add column if not exists multi_step     boolean default false;

-- Backfill sensible defaults from the fields that already exist, so old tasks get a tier.
update public.tasks set
  cognitive_load = coalesce(cognitive_load, energy, 3),
  est_minutes    = coalesce(est_minutes, (array[2, 15, 60, 240, 480])[greatest(1, least(5, effort))]),
  multi_step     = coalesce(multi_step, effort >= 4),
  ai_delegatable = coalesce(ai_delegatable, false)
where cognitive_load is null or est_minutes is null or multi_step is null;
