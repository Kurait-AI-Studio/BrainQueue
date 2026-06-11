-- BrainQueue · "pleasure" rating (1–5) for tasks — how much the user enjoys doing it.
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

alter table public.tasks add column if not exists pleasure smallint default 3;

-- Keep it in the valid 1..5 range for any pre-existing rows.
update public.tasks set pleasure = 3 where pleasure is null;
