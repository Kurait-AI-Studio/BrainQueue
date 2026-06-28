-- BrainQueue · Brain Dump v3 — inferred categories, due dates, cleaner notes.
-- Run in the Supabase SQL editor. Idempotent.

-- 1. Tasks can now carry a due date (the AI infers deadlines from the dump).
alter table public.tasks add column if not exists due_date date;

-- 2. Register the v3 prompt/schema so telemetry stays interpretable (Capture Spec, principle 2).
--    v3 changes: category is inferred (no fixed enum), a due_date field is extracted, notes
--    are rewritten as clean adjacent context, and today's date is injected at call time.
insert into public.prompt_registry (prompt_version, source_ref, notes) values
  ('braindump-v3', 'src/brainDumpSpec.js@BRAIN_DUMP_SYSTEM',
   'v3: inferred (non-enum) categories, due_date extraction (YYYY-MM-DD), notes rewritten as clean adjacent context. Today''s date injected into the system prompt at call time.')
  on conflict (prompt_version) do nothing;
