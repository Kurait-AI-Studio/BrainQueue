// Live telemetry round-trip test (uses .env). Verifies the enriched capture
// (final_committed.final_tasks + task_id_map) actually persists in Supabase via the
// REAL delivery path (src/lib/telemetry.js outbox), through RLS, as a real user.
//
// Safety: it creates a THROWAWAY auth user, writes only that user's events, then
// admin-deletes the user so task_events cascade-delete with it. Nothing is left in
// the production log. A pre-run sweep also removes any orphaned selftest+ users from
// earlier interrupted runs. Run:  node test/telemetry-capture.live.mjs
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { createOutbox, eventUuid } from "../src/lib/telemetry.js";

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ok = (m) => console.log(`  ✓ ${m}`);
// assert throws (so main()'s finally still cleans up) — never process.exit mid-test.
const assert = (cond, m) => { if (!cond) throw new Error(m); };

// Order-insensitive deep equal: Postgres jsonb normalizes object key order, so a
// plain JSON.stringify compare gives false negatives. Compare by value + structure.
function deepEq(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepEq(v, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEq(a[k], b[k]));
}

if (!URL || !ANON || !SERVICE) {
  console.error("❌ missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

// Remove any leftover selftest users (cleans orphans from interrupted runs).
async function sweepOrphans() {
  let removed = 0;
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) { console.log(`  ⚠ could not sweep orphans: ${error.message}`); return; }
  for (const u of data.users) {
    if (u.email && u.email.startsWith("selftest+")) { await admin.auth.admin.deleteUser(u.id); removed++; }
  }
  if (removed) ok(`swept ${removed} orphaned selftest user(s) from earlier runs`);
}

// ── sample data: one brain dump → model v1 → human-corrected final ──────────────
const dumpId = eventUuid();
const dumpText = "1. appeler la banque pour la carte\n2. acheter des piles\n3. write project research brief";
const parsedTasks = [
  { title: "Call the bank about the card", category: "Finance", urgency: 5, importance: 4, effort: 2, energy: 2, notes: "", est_minutes: 10, cognitive_load: 2, ai_delegatable: false, multi_step: false },
  { title: "Buy batteries", category: "Personal", urgency: 3, importance: 2, effort: 1, energy: 1, notes: "", est_minutes: 5, cognitive_load: 1, ai_delegatable: false, multi_step: false },
  { title: "Write project research brief", category: "Work", urgency: 3, importance: 5, effort: 4, energy: 5, notes: "", est_minutes: 120, cognitive_load: 5, ai_delegatable: true, multi_step: true },
];
// human kept #1, retagged #2 Personal→Admin, deleted #3. The committed v_final + id map:
const cid = (i) => 1730000000000 + i;
const taskIdMap = { [`${dumpId}:0`]: cid(0), [`${dumpId}:1`]: cid(1) };
const finalTasks = [
  { ...parsedTasks[0], id: cid(0), done: false, addedAt: "2026-06-27T10:00:00.000Z", doneAt: null },
  { ...parsedTasks[1], category: "Admin", id: cid(1), done: false, addedAt: "2026-06-27T10:00:00.000Z", doneAt: null },
];

let seq = 0;
const mkRow = (userId, event_type, task_id, context) => ({
  event_id: eventUuid(), user_id: userId, task_id: task_id != null ? String(task_id) : null,
  session_id: null, event_type, event_at: new Date().toISOString(),
  ts_local: new Date().toLocaleString("sv"), tz: "Europe/Paris", sequence_number: ++seq,
  schema_version: 1, app_version: "test", surface: "web:braindump", consent_state: "product-only", context,
});

async function main() {
  await sweepOrphans();

  const email = `selftest+${eventUuid()}@brainqueue.test`;
  const password = `Tq-${eventUuid()}`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert(!cErr, `create test user: ${cErr?.message}`);
  const userId = created.user.id;
  ok(`created throwaway user (${userId.slice(0, 8)}…)`);

  try {
    const user = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: sErr } = await user.auth.signInWithPassword({ email, password });
    assert(!sErr, `sign in test user: ${sErr?.message}`);
    ok("signed in as test user");

    // Drive the REAL outbox (durable enqueue → flush → upsert), not a hand-rolled insert.
    const mem = new Map();
    const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v) };
    const outbox = createOutbox({ getClient: () => user, storage });

    const rows = [
      mkRow(userId, "brain_dump_created", null, { dump_id: dumpId, raw_text: dumpText, char_count: dumpText.length, input_method: "typed" }),
      mkRow(userId, "parse_result", null, { dump_id: dumpId, prompt_version: "braindump-v2", model_id: "gpt-4.1-mini", provider: "openai", raw_model_output: JSON.stringify({ tasks: parsedTasks }), parsed_tasks: parsedTasks, latency_ms: 812, tokens_in: 640, tokens_out: 420, cost_est: 0.000928 }),
      mkRow(userId, "final_committed", null, { dump_id: dumpId, n_tasks: 2, n_edits: 1, n_removed: 1, n_accepted: 1, edit_types: { retag: 1, delete: 1 }, time_to_commit_ms: 9300, final_tasks: finalTasks, task_id_map: taskIdMap }),
    ];
    rows.forEach((r) => outbox.enqueue(r));
    const r1 = await outbox.flush();
    assert(!r1.error, `flush: ${JSON.stringify(r1.error)}`);
    ok(`outbox flushed ${r1.sent} events (pending now: ${outbox.pending()})`);
    assert(outbox.pending() === 0, "outbox not drained — events would be lost");

    // Read back AS THE USER (proves RLS select + that it truly landed).
    const { data: got, error: rErr } = await user.from("task_events").select("*").eq("user_id", userId).order("sequence_number");
    assert(!rErr, `read back: ${rErr?.message}`);
    assert(got.length === 3, `expected 3 rows, got ${got.length}`);
    ok("read back 3 events via RLS");

    // The NEW capture survived the jsonb round-trip (by value; key order is normalized).
    const fc = got.find((r) => r.event_type === "final_committed");
    assert(fc, "final_committed row missing");
    assert(deepEq(fc.context.final_tasks, finalTasks), "final_tasks did not round-trip");
    ok("final_tasks round-tripped (the supervised label, read directly)");
    assert(deepEq(fc.context.task_id_map, taskIdMap), "task_id_map did not round-trip");
    ok("task_id_map round-tripped (links model output → task outcome)");
    assert(fc.context.final_tasks[1].category === "Admin", "the human correction (retag) was lost");
    ok("human correction preserved (Personal → Admin retag visible in final_tasks)");

    const pr = got.find((r) => r.event_type === "parse_result");
    assert(deepEq(pr.context.parsed_tasks, parsedTasks), "parse_result.parsed_tasks did not round-trip");
    assert(got.every((r) => Number.isInteger(r.sequence_number) && r.schema_version === 1), "envelope fields missing");
    ok("envelope intact (sequence_number, schema_version) + parse_result v1 preserved");

    // Idempotency: re-enqueue the same final_committed (same event_id) and flush.
    outbox.enqueue(rows[2]);
    await outbox.flush();
    const { data: after } = await user.from("task_events").select("event_id").eq("user_id", userId);
    if (after.length === 3) ok("idempotent: re-sending the same event_id did not duplicate (migration 0008 active)");
    else console.log(`  ⚠ re-send produced ${after.length} rows — unique event_id index (migration 0008) not applied; falls back to insert`);

    console.log("\n✅ PASS — enriched telemetry persists through the real delivery path + RLS.");
  } finally {
    const { error: dErr } = await admin.auth.admin.deleteUser(userId);
    if (dErr) { console.error(`\n⚠ CLEANUP FAILED — remove user ${userId} manually: ${dErr.message}`); return; }
    const { count } = await admin.from("task_events").select("event_id", { count: "exact", head: true }).eq("user_id", userId);
    if (count && count > 0) console.error(`\n⚠ ${count} test rows still present for ${userId} — investigate cascade`);
    else ok("cleaned up: throwaway user + all its events cascade-deleted (production log untouched)");
  }
}

main().catch((e) => { console.error(`\n❌ FAIL: ${e?.message || e}`); process.exitCode = 1; });
