-- BrainQueue · make the event log's delivery idempotent.
-- The client now buffers events in a durable outbox and retries failed inserts
-- (network blips, expired JWT, offline). Without a dedup key, a retry after a lost
-- "success" response would double-write the immutable log. A unique event_id lets
-- the client upsert with on_conflict(event_id) do_nothing, so retries are no-ops.
-- Run in the Supabase SQL editor. Idempotent.

-- Postgres treats NULLs as distinct, so the pre-envelope rows (event_id is null,
-- migration 0005) coexist fine; uniqueness is enforced only on real ids.
create unique index if not exists task_events_event_id_key
  on public.task_events (event_id);
