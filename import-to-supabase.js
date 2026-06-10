// import-to-supabase.js
// Import a BrainQueue CSV export into Supabase, stamped with your user_id.
//
//   SUPABASE_SERVICE_ROLE_KEY=... IMPORT_USER_ID=<your-uuid> \
//     node import-to-supabase.js [path/to/export.csv]
//
// Why the service-role key: Row-Level Security now requires every row's user_id
// to equal auth.uid(). This script has no logged-in session, so it uses the
// service-role key (Dashboard → Project Settings → API → service_role) which
// bypasses RLS — and writes your user_id explicitly so the rows belong to you.
// The service-role key is a full-access secret: keep it in .env, never ship it
// to the browser, never commit it.
//
// Find your user_id (IMPORT_USER_ID): Dashboard → Authentication → Users, or run
//   select id, email from auth.users;  in the SQL Editor.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";

config(); // loads .env

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID } = process.env;
const csvPath = process.argv[2] || "brainqueue_2026-06-04.csv";

// Fail fast with actionable messages rather than a cryptic RLS error later.
const missing = [];
if (!VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!IMPORT_USER_ID) missing.push("IMPORT_USER_ID");
if (missing.length) {
  console.error(`❌ Missing env var(s): ${missing.join(", ")}`);
  console.error("   Usage: SUPABASE_SERVICE_ROLE_KEY=... IMPORT_USER_ID=<uuid> node import-to-supabase.js [csv]");
  process.exit(1);
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const csv = readFileSync(csvPath, "utf8");
const rows = parse(csv, { columns: true, skip_empty_lines: true });

// Accepts BOTH export shapes:
//   • App "↓ CSV"  → camelCase (addedAt/doneAt), no id, no user_id.
//   • Supabase export → snake_case (added_at/done_at), with id + user_id (often
//     the literal text "null" for empty cells).
// `nn` turns "", undefined and the string "null" into a real null.
const nn = (v) => (v == null || v === "" || v === "null") ? null : v;

const tasks = rows.map(r => {
  // Preserve the original timestamps from whichever column the file used.
  const added_at = nn(r.added_at) || nn(r.addedAt) || new Date().toISOString();
  const done_at = nn(r.done_at) || nn(r.doneAt) || null;
  // Keep the real id if the file has one (Supabase export) so we UPDATE the
  // existing row in place — no duplicate. Otherwise synthesize a deterministic,
  // user-scoped id so re-running the same app-CSV import upserts, not duplicates.
  const id = nn(r.id) || (IMPORT_USER_ID.slice(0, 8) + "_" + (r.title || "") + "_" + added_at).replace(/\s/g, "").slice(0, 60);
  return {
    id: String(id),
    user_id: IMPORT_USER_ID,           // always claim the row for this user
    title: r.title,
    category: r.category,
    urgency: parseInt(r.urgency),
    importance: parseInt(r.importance),
    effort: parseInt(r.effort),
    energy: parseInt(r.energy),
    notes: r.notes || "",
    done: String(r.done).toLowerCase() === "true",
    added_at,
    done_at,
    updated_at: new Date().toISOString(),
  };
});

console.log(`Importing ${tasks.length} tasks from ${csvPath} for user ${IMPORT_USER_ID}…`);

const { error } = await supabase
  .from("tasks")
  .upsert(tasks, { onConflict: "id", ignoreDuplicates: false });

if (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
} else {
  console.log(`✅ ${tasks.length} tasks imported and stamped with your user_id.`);
}
