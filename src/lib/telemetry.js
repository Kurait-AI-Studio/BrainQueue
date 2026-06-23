// ─── Telemetry delivery (the moat's durability layer) ────────────────────────
// Append-only event delivery for `task_events`. Extracted from App.jsx so the
// data-loss-prevention path is unit-testable: the Supabase client and the storage
// backend are injected, never reached for globally.
//
// Guarantees this layer makes (see test/telemetry.test.js):
//  1. Durable-first: an event is persisted to the outbox BEFORE any network call,
//     so a crash/abort mid-send can't lose it.
//  2. No silent drop: a failed flush keeps every event for the next attempt.
//  3. Idempotent retries: rows upsert on the unique event_id, so re-sending after a
//     lost "success" response can't double-write (falls back to insert pre-migration).
//  4. No lost-during-flight: events enqueued while a flush is in progress are kept.
//  5. No sequence gaps: each row carries its sequence_number from enqueue time and is
//     re-sent unchanged on retry — the bug that dropped a completion can't recur.

export const OUTBOX_KEY = "bq_event_outbox";

// RFC4122-ish id so every event is dedup-keyable even where crypto.randomUUID is absent.
export function eventUuid() {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch { /* fall through */ }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function readOutbox(storage, key = OUTBOX_KEY) {
  try { return JSON.parse(storage.getItem(key) || "[]"); } catch { return []; }
}
export function writeOutbox(storage, rows, key = OUTBOX_KEY) {
  try { storage.setItem(key, JSON.stringify(rows)); } catch { /* quota/blocked/no storage — best effort */ }
}

// Build a durable outbox bound to a Supabase-client getter and a storage backend.
// `getClient()` returns a supabase-like client (or null when not configured/signed-in).
export function createOutbox({ getClient, storage, key = OUTBOX_KEY }) {
  let flushing = false;
  const read = () => readOutbox(storage, key);
  const write = (rows) => writeOutbox(storage, rows, key);

  // Persist immediately, before any send — this is what makes delivery crash-safe.
  function enqueue(row) {
    write([...read(), row]);
    return row;
  }

  // Drain the outbox to Supabase. Safe to call often; no-ops when empty or already running.
  async function flush() {
    const sb = getClient();
    if (!sb || flushing) return { skipped: true };
    const rows = read();
    if (rows.length === 0) return { sent: 0 };
    flushing = true;
    try {
      // Idempotent path: dedup on the unique event_id (migration 0008). Until that index
      // exists, PostgREST rejects on_conflict (code 42P10) — fall back to a plain insert so
      // events still deliver durably (worst case is a rare dup row, deduped in analysis).
      let { error } = await sb.from("task_events").upsert(rows, { onConflict: "event_id", ignoreDuplicates: true });
      if (error && (error.code === "42P10" || /on conflict/i.test(error.message || ""))) {
        ({ error } = await sb.from("task_events").insert(rows));
      }
      if (error) return { error }; // keep rows for next attempt — nothing is removed
      // Drop exactly what we sent; events enqueued during the request are preserved.
      const sent = new Set(rows.map(r => r.event_id));
      write(read().filter(r => !sent.has(r.event_id)));
      return { sent: rows.length };
    } finally {
      flushing = false;
    }
  }

  return { enqueue, flush, pending: () => read().length, read };
}
