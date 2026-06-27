-- BrainQueue · server-authoritative daily Brain Dump cap.
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
--
-- Why server-side: the brain-dump edge function is the only thing that costs money, so
-- the cap must live where the client can't reach it. The count is incremented ONLY by
-- the SECURITY DEFINER function below, keyed on auth.uid() — a client cannot evade the
-- limit by withholding its own telemetry. The edge function reserves one unit BEFORE
-- calling the model, so the expensive call is what's gated.

-- 1. Per-user / per-day counter ------------------------------------------------
create table if not exists public.brain_dump_quota (
  user_id    uuid not null references auth.users(id) on delete cascade,
  day        date not null,                 -- UTC calendar day
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.brain_dump_quota enable row level security;
-- Users may READ their own usage (for a "X of N left today" UI). Writes go only through
-- bump_brain_dump_quota (security definer) — there is deliberately no insert/update policy.
drop policy if exists "brain_dump_quota_select_own" on public.brain_dump_quota;
create policy "brain_dump_quota_select_own" on public.brain_dump_quota
  for select using (auth.uid() = user_id);

-- 2. Atomic reserve-and-check --------------------------------------------------
-- Reserves one Brain Dump for the caller for today (UTC) and reports whether they are
-- within p_limit. SECURITY DEFINER so it can write under the locked-down RLS above;
-- search_path is pinned for safety. Returns: { allowed, used, limit, resets_on }.
create or replace function public.bump_brain_dump_quota(p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_day   date := (now() at time zone 'utc')::date;
  v_count integer;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'used', 0, 'limit', p_limit, 'reason', 'unauthenticated');
  end if;
  insert into public.brain_dump_quota (user_id, day, count, updated_at)
    values (v_uid, v_day, 1, now())
    on conflict (user_id, day)
    do update set count = brain_dump_quota.count + 1, updated_at = now()
    returning count into v_count;
  return jsonb_build_object(
    'allowed', v_count <= p_limit,
    'used',    v_count,
    'limit',   p_limit,
    'resets_on', (v_day + 1)
  );
end $$;

revoke all on function public.bump_brain_dump_quota(integer) from public;
grant execute on function public.bump_brain_dump_quota(integer) to authenticated;
