-- BrainQueue · multi-category + recurrence support for the tasks table.
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
--
-- IMPORTANT: run this BEFORE deploying the multi-category / recurrence build —
-- the app now writes `categories` and `recurrence` on every task, and an upsert
-- referencing a missing column fails, which would break sync.

-- 1. New columns. `categories` is an array; `recurrence` is one of
--    none | daily | weekly | monthly.
alter table public.tasks add column if not exists categories text[] default '{}';
alter table public.tasks add column if not exists recurrence  text   default 'none';

-- 2. Backfill: seed `categories` from the existing single `category` so old tasks
--    keep their tag under the new model.
update public.tasks
set categories = array[category]
where category is not null
  and (categories is null or cardinality(categories) = 0);

-- 3. Keep `recurrence` sane for any pre-existing rows.
update public.tasks set recurrence = 'none' where recurrence is null;
