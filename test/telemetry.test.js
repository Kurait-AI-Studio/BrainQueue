// Tests for the telemetry outbox — the moat's durability layer (src/lib/telemetry.js).
// These exist because a fire-and-forget logEvent once dropped a completed-task event on a
// transient failure (and burned a sequence number, leaving a gap). Each test below pins a
// guarantee that prevents that class of data loss. Run: `npm test`.

import test from "node:test";
import assert from "node:assert/strict";
import { createOutbox, eventUuid, readOutbox } from "../src/lib/telemetry.js";

// ── test doubles ─────────────────────────────────────────────────────────────
function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

// A supabase-ish client whose upsert/insert outcomes are scripted. `plan.upsert`/`plan.insert`
// may be a single outcome, an array (consumed per call), or a function(callIndex)->outcome.
// An outcome is { error: null } (ok) or { error: {...} } (failure).
function fakeClient(plan = {}) {
  const calls = { upsert: [], insert: [] };
  const pick = (kind) => {
    const o = plan[kind];
    if (typeof o === "function") return o(calls[kind].length);
    if (Array.isArray(o)) return o[Math.min(calls[kind].length, o.length - 1)] ?? { error: null };
    return o ?? { error: null };
  };
  const client = {
    from() {
      return {
        // pick the scripted outcome BEFORE recording the call, so plan arrays/functions
        // are indexed by the call's own number (0 on the first call).
        async upsert(rows, opts) { const out = pick("upsert"); calls.upsert.push({ rows, opts }); return out; },
        async insert(rows) { const out = pick("insert"); calls.insert.push({ rows }); return out; },
      };
    },
  };
  return { client, calls };
}

let _seq = 0;
const makeRow = (over = {}) => ({ event_id: eventUuid(), event_type: "task_completed", sequence_number: ++_seq, ...over });
const OK = { error: null };
const FAIL = { error: { message: "network down" } };

// ── guarantees ───────────────────────────────────────────────────────────────

test("durable-first: an event is persisted before any network call", () => {
  const storage = memStorage();
  const { client, calls } = fakeClient();
  const ob = createOutbox({ getClient: () => client, storage });

  const row = ob.enqueue(makeRow());

  assert.equal(ob.pending(), 1);
  assert.equal(readOutbox(storage)[0].event_id, row.event_id);
  assert.equal(calls.upsert.length, 0, "nothing should be sent on enqueue");
});

test("successful flush delivers via idempotent upsert, then clears the outbox", async () => {
  const storage = memStorage();
  const { client, calls } = fakeClient({ upsert: OK });
  const ob = createOutbox({ getClient: () => client, storage });
  ob.enqueue(makeRow());

  const res = await ob.flush();

  assert.equal(res.sent, 1);
  assert.equal(ob.pending(), 0);
  assert.equal(calls.upsert.length, 1);
  assert.deepEqual(calls.upsert[0].opts, { onConflict: "event_id", ignoreDuplicates: true },
    "must upsert on the unique event_id so retries can't double-write");
  assert.equal(calls.insert.length, 0);
});

test("a failed flush keeps the event for retry — no silent drop", async () => {
  const storage = memStorage();
  const { client } = fakeClient({ upsert: FAIL });
  const ob = createOutbox({ getClient: () => client, storage });
  const row = ob.enqueue(makeRow());

  const res = await ob.flush();

  assert.ok(res.error, "flush should surface the error");
  assert.equal(ob.pending(), 1, "the event must remain queued");
  assert.equal(readOutbox(storage)[0].event_id, row.event_id);
});

test("the lost-completion scenario: an event that fails once is delivered on the next flush", async () => {
  const storage = memStorage();
  const { client } = fakeClient({ upsert: [FAIL, OK] }); // first send fails, second succeeds
  const ob = createOutbox({ getClient: () => client, storage });
  ob.enqueue(makeRow({ event_type: "task_completed" }));

  await ob.flush();                         // transient failure
  assert.equal(ob.pending(), 1, "still queued after the failure");
  await ob.flush();                         // retry
  assert.equal(ob.pending(), 0, "delivered on retry — not lost");
});

test("missing unique index (42P10) falls back to insert and still delivers", async () => {
  const storage = memStorage();
  const { client, calls } = fakeClient({
    upsert: { error: { code: "42P10", message: "no unique or exclusion constraint matching the ON CONFLICT" } },
    insert: OK,
  });
  const ob = createOutbox({ getClient: () => client, storage });
  ob.enqueue(makeRow());

  const res = await ob.flush();

  assert.equal(res.sent, 1);
  assert.equal(ob.pending(), 0);
  assert.equal(calls.upsert.length, 1);
  assert.equal(calls.insert.length, 1, "should fall back to plain insert");
});

test("no sequence gap: sequence_number is preserved across a failed+retried flush", async () => {
  const storage = memStorage();
  const sent = [];
  const { client } = fakeClient({
    upsert: (i) => (i === 0 ? FAIL : OK),
  });
  // capture what actually gets sent on the successful attempt
  const wrapped = { from: () => ({
    async upsert(rows, opts) { const r = await client.from().upsert(rows, opts); if (!r.error) sent.push(...rows.map(x => x.sequence_number)); return r; },
    async insert(rows) { return client.from().insert(rows); },
  }) };
  const ob = createOutbox({ getClient: () => wrapped, storage });
  ob.enqueue(makeRow({ sequence_number: 5 }));

  await ob.flush();                                   // fail
  assert.equal(readOutbox(storage)[0].sequence_number, 5, "sequence stays put in the outbox");
  await ob.flush();                                   // retry
  assert.deepEqual(sent, [5], "re-sent with the same sequence — no gap, no renumber");
});

test("no lost-during-flight: events enqueued while a flush is in progress survive", async () => {
  const storage = memStorage();
  let release;
  const gate = new Promise(r => { release = r; });
  let upsertCalls = 0;
  const client = { from: () => ({
    async upsert() { upsertCalls++; await gate; return OK; },
    async insert() { return OK; },
  }) };
  const ob = createOutbox({ getClient: () => client, storage });

  ob.enqueue(makeRow());                 // event "a"
  const flushing = ob.flush();           // sends [a]; parks on the gate
  const b = ob.enqueue(makeRow());       // arrives mid-flight
  release();
  await flushing;

  assert.equal(upsertCalls, 1, "only the first batch was sent");
  const remaining = readOutbox(storage);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].event_id, b.event_id, "b survived; a was removed");
});

test("concurrency guard: a second flush while one is in flight is a no-op", async () => {
  const storage = memStorage();
  let release;
  const gate = new Promise(r => { release = r; });
  let upsertCalls = 0;
  const client = { from: () => ({
    async upsert() { upsertCalls++; await gate; return OK; },
    async insert() { return OK; },
  }) };
  const ob = createOutbox({ getClient: () => client, storage });
  ob.enqueue(makeRow());

  const p1 = ob.flush();
  const r2 = await ob.flush();           // should bail immediately
  assert.deepEqual(r2, { skipped: true });
  release();
  await p1;
  assert.equal(upsertCalls, 1, "no double-send");
});

test("flush with no client (signed out / unconfigured) retains events", async () => {
  const storage = memStorage();
  const ob = createOutbox({ getClient: () => null, storage });
  ob.enqueue(makeRow());

  const res = await ob.flush();

  assert.deepEqual(res, { skipped: true });
  assert.equal(ob.pending(), 1, "events kept until a client is available");
});

test("eventUuid returns unique, well-formed dedup keys", () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = new Set();
  for (let i = 0; i < 5000; i++) {
    const id = eventUuid();
    assert.match(id, re);
    ids.add(id);
  }
  assert.equal(ids.size, 5000, "every event must get a distinct id");
});

test("a broken storage backend degrades gracefully instead of throwing", () => {
  const bad = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const ob = createOutbox({ getClient: () => null, storage: bad });
  assert.doesNotThrow(() => ob.enqueue(makeRow()));
  assert.equal(ob.pending(), 0); // unreadable storage reads as empty — but never crashes the app
});
