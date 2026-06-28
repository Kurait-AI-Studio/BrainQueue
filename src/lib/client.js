// ─── App runtime client: Supabase + telemetry envelope + focus sessions ──────
// The shared singleton layer the app and its screens depend on. Extracted from
// App.jsx so each screen can be its own module without re-importing the glue.
// Module state here is a per-tab singleton (one signed-in user at a time).
import { createClient } from "@supabase/supabase-js";
import { createOutbox, eventUuid } from "./telemetry";
import { CONSENT_VERSION, normalizeConsent } from "./consent";

// ── Signed-in user ───────────────────────────────────────────────────────────
// Kept in module scope so the row helpers can stamp user_id without threading it
// through every call site. See supabase/migrations for the RLS that scopes rows.
let _userId = null;
export const setActiveUser = (id) => { _userId = id; };
export const getUserId = () => _userId;

// Sign the current user out (clears the Supabase session + JWT).
export async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

// ── Telemetry envelope state ─────────────────────────────────────────────────
// The event envelope carries fields you can't reconstruct after the fact: a
// monotonic per-user sequence, schema + app version, surface, consent, local tz.
const SCHEMA_VERSION = 1;            // joins to schema_registry; bump with envelope changes
/* global __APP_VERSION__ */
// Injected from package.json at build time by Vite (see vite.config.js), so it always
// matches the released version. Falls back only outside a Vite build (e.g. unit tests).
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
let _consentState = "product-only";  // full | product-only | none — tag every event
let _activeSessionId = null;         // set while a focus session is live; groups its events
let _activeSurface = "web";          // coarse screen hint (web/web:focus/web:braindump…)
export const setConsentState = (c) => { _consentState = c; };
export const getConsentState = () => _consentState;
export const setActiveSessionId = (id) => { _activeSessionId = id; };
export const setSurface = (s) => { _activeSurface = s; };

// Monotonic sequence per user, persisted so ordering survives reloads and equal
// timestamps. localStorage-backed; falls back to a timestamp if blocked.
function nextSequence() {
  try {
    const k = `bq_seq_${_userId}`;
    const n = (parseInt(localStorage.getItem(k), 10) || 0) + 1;
    localStorage.setItem(k, String(n));
    return n;
  } catch { return Date.now(); }
}

// ── Supabase client (lazy — only init if env vars present) ───────────────────
let _supabase = null;
export function getSupabase() {
  if (_supabase) return _supabase;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

// ── Telemetry delivery ───────────────────────────────────────────────────────
// Durable, not fire-and-forget: every event is stamped + written to a localStorage
// outbox, then flushed with retry. The outbox guarantees are unit-tested in
// ./telemetry (test/telemetry.test.js); here we inject the real client.
const _outbox = createOutbox({
  getClient: getSupabase,
  storage: typeof localStorage !== "undefined" ? localStorage : undefined,
});
export const flushOutbox = () => _outbox.flush();

// `source` marks where the data originated: "user" for first-party, user-authored content
// (the default), or a provider id ("google" / "microsoft" / "provider") for data derived
// from a third-party API. The training export keeps ONLY source:"user" records, so the
// origin of every trained datum is provable — required by the privacy policy (§4) and by
// Google's API policy. It lives inside the jsonb context, so no schema migration is needed.
export function logEvent(eventType, taskId = null, context = null, source = "user") {
  if (!_userId) return;
  const now = new Date();
  let tz; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = null; }
  const row = {
    event_id: eventUuid(),
    user_id: _userId,
    task_id: taskId != null ? String(taskId) : null,
    session_id: _activeSessionId,
    event_type: eventType,
    event_at: now.toISOString(),          // ts_utc — canonical ordering
    ts_local: now.toLocaleString("sv"),   // local wall-clock (sortable "YYYY-MM-DD HH:mm:ss")
    tz,
    sequence_number: nextSequence(),
    schema_version: SCHEMA_VERSION,
    app_version: APP_VERSION,
    surface: _activeSurface,
    consent_state: _consentState,
    context: { ...(context || {}), source }, // event payload + provenance tag
  };
  _outbox.enqueue(row);   // durable first — persisted before any send
  _outbox.flush();
}

// Record an explicit, auditable data-use consent choice. Persists the level (as a
// back-compatible string) plus the consent version + timestamp, updates the runtime flag
// that tags every event, and writes an immutable `consent_updated` event. A downgrade
// from "full" is a withdrawal: we also log a deletion request for the user's
// training-eligible raw data (fulfilled server-side), per the privacy policy (§4).
export function updateConsent(next) {
  const prev = _consentState;
  const state = normalizeConsent(next);
  setConsentState(state);
  try {
    if (_userId) {
      localStorage.setItem(`bq_consent_${_userId}`, state);
      localStorage.setItem(`bq_consent_meta_${_userId}`, JSON.stringify({ version: CONSENT_VERSION, ts: new Date().toISOString() }));
    }
  } catch { /* storage blocked — the event below is still the durable record */ }
  logEvent("consent_updated", null, { consent_state: state, previous: prev, consent_version: CONSENT_VERSION });
  if (prev === "full" && state !== "full") {
    logEvent("training_data_deletion_requested", null, { reason: "consent_withdrawn", consent_version: CONSENT_VERSION });
  }
  return state;
}

// ── Focus sessions ───────────────────────────────────────────────────────────
// insert returns the new row id so we can finalize it on session end.
export async function insertSession(plannedIds) {
  const sb = getSupabase();
  if (!sb || !_userId) return null;
  const { data, error } = await sb.from("sessions")
    .insert({ user_id: _userId, planned_task_ids: plannedIds.map(String), started_at: new Date().toISOString() })
    .select("id").single();
  if (error) { console.warn("sessions insert:", error.message); return null; }
  return data?.id ?? null;
}
export async function finalizeSession(id, completedIds, focusSeconds) {
  const sb = getSupabase();
  if (!sb || id == null) return;
  const { error } = await sb.from("sessions")
    .update({ ended_at: new Date().toISOString(), completed_task_ids: completedIds.map(String), focus_seconds: Math.round(focusSeconds) })
    .eq("id", id);
  if (error) console.warn("sessions finalize:", error.message);
}
