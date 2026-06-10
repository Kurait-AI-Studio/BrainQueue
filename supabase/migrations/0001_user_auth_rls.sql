-- BrainQueue · per-user ownership + Row-Level Security for the tasks table.
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Safe to re-run: every statement is idempotent.

-- 1. Add the owner column. Existing rows get NULL and become invisible under RLS
--    (see the backfill note at the bottom if you want to keep them).
alter table public.tasks
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists tasks_user_id_idx on public.tasks (user_id);

-- 2. Turn on Row-Level Security and lock the table down to its owner.
alter table public.tasks enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- 3. Realtime: make sure the table is published, and use REPLICA IDENTITY FULL so
--    DELETE events carry the old row (needed for the user_id realtime filter).
alter table public.tasks replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

-- 4. (Optional) Backfill rows that existed before auth. Replace the UUID with your
--    own (find it in Supabase → Authentication → Users), then uncomment:
-- update public.tasks set user_id = '00000000-0000-0000-0000-000000000000'
--   where user_id is null;
