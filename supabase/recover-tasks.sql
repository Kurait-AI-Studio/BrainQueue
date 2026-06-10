-- Recover "disappeared" tasks
-- ---------------------------------------------------------------------------
-- WHY THEY VANISHED: every task row is owned by a user UUID, and Row-Level
-- Security only shows rows where tasks.user_id = auth.uid(). Tasks become
-- invisible when their user_id is NULL (e.g. imported by import-to-supabase.js,
-- which doesn't set one) or belongs to a DIFFERENT account than the one you're
-- signed in as (a Google login and an Apple "Hide My Email" login are two
-- separate users with two separate UUIDs, even though the relay address forwards
-- to your real inbox).
--
-- Run these in the Supabase dashboard → SQL Editor. It runs as superuser and
-- bypasses RLS, so it can see and fix every row regardless of owner.

-- 1. Who are your accounts? Find the UUID of the one you want to keep using.
select id, email, created_at,
       raw_app_meta_data->>'provider' as provider
from auth.users
order by created_at;

-- 2. Where did the tasks end up? Each group is one owner (NULL = orphaned import).
select coalesce(user_id::text, '⟨NULL / orphaned⟩') as owner,
       count(*)            as tasks,
       min(added_at)       as oldest,
       max(added_at)       as newest
from public.tasks
group by user_id
order by tasks desc;

-- 3. Peek at the orphaned / other-account rows to confirm they're yours.
select id, title, category, done, added_at, user_id
from public.tasks
where user_id is null            -- imported rows
order by added_at desc;

-- ---------------------------------------------------------------------------
-- 4. RE-HOME the tasks onto your chosen account. Copy your UUID from query #1
--    into <YOUR_UUID>, then run whichever applies. (Wrap in a transaction so you
--    can ROLLBACK if the count looks wrong.)
begin;

-- a) claim the orphaned import rows:
update public.tasks
set user_id = '18868d47-d55f-4a03-ae07-23102e6bfff3'
where user_id is null;

-- b) AND/OR move rows from an old account UUID to your current one:
-- update public.tasks
-- set user_id = '<YOUR_UUID>'
-- where user_id = '<OLD_UUID>';

-- verify before committing:
select count(*) as now_owned_by_you
from public.tasks
where user_id = '18868d47-d55f-4a03-ae07-23102e6bfff3';

commit;     -- or: rollback;
-- ---------------------------------------------------------------------------
-- Reload the app while signed in as that account → the tasks reappear (RLS now
-- matches) and realtime/sync resumes normally.
