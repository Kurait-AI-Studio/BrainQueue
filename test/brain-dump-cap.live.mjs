// Live test for the daily Brain Dump cap (uses .env). Verifies the server-authoritative
// quota function bump_brain_dump_quota: reserves are counted, and `allowed` flips to
// false once the limit is exceeded — exactly what the edge function gates on.
//
// Safety: throwaway user, then admin-deletes it so the quota row cascade-deletes.
// Requires migration 0009 applied. If the function isn't there yet, it says so clearly.
// Run:  node test/brain-dump-cap.live.mjs
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { eventUuid } from "../src/lib/telemetry.js";

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ok = (m) => console.log(`  ✓ ${m}`);
const assert = (c, m) => { if (!c) throw new Error(m); };

if (!URL || !ANON || !SERVICE) { console.error("❌ missing Supabase vars in .env"); process.exit(1); }
const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

async function sweepOrphans() {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return;
  let n = 0;
  for (const u of data.users) if (u.email?.startsWith("selftest+")) { await admin.auth.admin.deleteUser(u.id); n++; }
  if (n) ok(`swept ${n} orphaned selftest user(s)`);
}

const LIMIT = 3;

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
    assert(!sErr, `sign in: ${sErr?.message}`);

    // Probe the function first so a missing migration gives a clear message.
    const probe = await user.rpc("bump_brain_dump_quota", { p_limit: LIMIT });
    if (probe.error) {
      const missing = probe.error.code === "PGRST202" || /could not find the function|does not exist/i.test(probe.error.message || "");
      if (missing) {
        console.log(`\n⏳ PENDING: migration 0009 not applied yet.`);
        console.log(`   Apply supabase/migrations/0009_brain_dump_quota.sql in the Supabase SQL editor, then re-run.`);
        process.exitCode = 2;
        return;
      }
      throw new Error(`rpc error: ${probe.error.message}`);
    }
    // probe consumed reserve #1.
    assert(probe.data.allowed === true && probe.data.used === 1, `call 1 should be allowed (used 1), got ${JSON.stringify(probe.data)}`);
    ok(`call 1/${LIMIT}: allowed, used=1`);

    for (let i = 2; i <= LIMIT; i++) {
      const { data, error } = await user.rpc("bump_brain_dump_quota", { p_limit: LIMIT });
      assert(!error, `call ${i}: ${error?.message}`);
      assert(data.allowed === true && data.used === i, `call ${i} should be allowed (used ${i}), got ${JSON.stringify(data)}`);
      ok(`call ${i}/${LIMIT}: allowed, used=${i}`);
    }

    // The over-limit call must be denied.
    const over = await user.rpc("bump_brain_dump_quota", { p_limit: LIMIT });
    assert(!over.error, `over-limit call: ${over.error?.message}`);
    assert(over.data.allowed === false && over.data.used === LIMIT + 1, `call ${LIMIT + 1} must be denied, got ${JSON.stringify(over.data)}`);
    ok(`call ${LIMIT + 1}/${LIMIT}: DENIED (allowed=false, used=${over.data.used}) — the cap holds`);

    // The user can read their own usage (for a "X left today" UI).
    const { data: rows, error: rErr } = await user.from("brain_dump_quota").select("*").eq("user_id", userId);
    assert(!rErr && rows.length === 1 && rows[0].count === LIMIT + 1, `usage row should be readable via RLS, got ${JSON.stringify(rows)}`);
    ok("usage row readable by the user via RLS (count matches)");

    console.log("\n✅ PASS — daily cap is server-authoritative and enforced.");
  } finally {
    const { error: dErr } = await admin.auth.admin.deleteUser(userId);
    if (dErr) console.error(`\n⚠ CLEANUP FAILED — remove user ${userId} manually: ${dErr.message}`);
    else {
      const { count } = await admin.from("brain_dump_quota").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
      if (count && count > 0) console.error(`\n⚠ ${count} quota rows remain for ${userId} — investigate cascade`);
      else ok("cleaned up: throwaway user + quota row cascade-deleted");
    }
  }
}

main().catch((e) => { console.error(`\n❌ FAIL: ${e?.message || e}`); process.exitCode = 1; });
