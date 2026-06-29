-- BrainQueue · the Capture inbox — raw brain dumps awaiting processing.
-- Run in the Supabase SQL editor. Idempotent.
--
-- This stores the RAW captured text (the "prefilled dump"). What the user CORRECTS when
-- they process it lives in the immutable task_events log (brain_dump_created.raw_text →
-- parse_result.parsed_tasks → final_committed.final_tasks + task_edited deltas), linked
-- back to the capture by `capture_id` stamped on those events. So the full chain —
-- raw capture → submitted dump → model output → human-corrected result — is reconstructable.

create table if not exists public.captures (
  id           text primary key,              -- client-generated (matches the app's capture id)
  user_id      uuid not null references auth.users(id) on delete cascade,
  text         text not null,                 -- the raw captured brain dump, untouched
  created_at   timestamptz not null default now(),
  processed    boolean not null default false,
  processed_at timestamptz,
  updated_at   timestamptz not null default now()
);
create index if not exists captures_user_idx on public.captures (user_id, created_at desc);

alter table public.captures enable row level security;
-- Captures are mutable (the user edits/discards their own inbox) — full owner CRUD, unlike
-- the append-only task_events log.
drop policy if exists "captures_select_own" on public.captures;
create policy "captures_select_own" on public.captures for select using (auth.uid() = user_id);
drop policy if exists "captures_insert_own" on public.captures;
create policy "captures_insert_own" on public.captures for insert with check (auth.uid() = user_id);
drop policy if exists "captures_update_own" on public.captures;
create policy "captures_update_own" on public.captures for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "captures_delete_own" on public.captures;
create policy "captures_delete_own" on public.captures for delete using (auth.uid() = user_id);
