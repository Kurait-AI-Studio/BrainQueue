import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  CATEGORIES,
  BRAIN_DUMP_MODEL,
  BRAIN_DUMP_PROMPT_VERSION,
  BRAIN_DUMP_MAX_TOKENS,
  BRAIN_DUMP_SYSTEM,
  TASK_LIST_SCHEMA,
  sanitizeTask,
} from "./brainDumpSpec";
import { glass, glassStrong, useHover, GlassButton, ViewTab, TierBadge, TaskCard, DoneCard, XPBar, SideSection, MouseGlow, Dim, EmptyState, InlineCatAdd, Toast, UserChip, AnalyticsModal, TaskModal, SettingsModal, SessionSetupModal } from "./ui";


// ─── Auth ────────────────────────────────────────────────────────────────────
// Authentication is handled by Supabase Auth (OAuth2 + email magic link). The
// browser holds a short-lived JWT (auto-refreshed by the SDK); Row-Level Security
// on the `tasks` table scopes every read/write to the signed-in user. No password
// ever touches our code. See supabase/migrations for the schema + RLS policies.

// The signed-in user's id, kept in module scope so the Supabase row helpers can
// stamp user_id without threading it through every call site.
let _userId = null;
const setActiveUser = (id) => { _userId = id; };

// ─── Telemetry envelope state ────────────────────────────────────────────────
// The event envelope (Telemetry Capture Spec §"event envelope") carries fields you
// can never reconstruct after the fact: a monotonic per-user sequence, the schema +
// app version, the surface, consent state, and the user's local time/zone.
const SCHEMA_VERSION = 1;            // joins to schema_registry; bump with envelope changes
const APP_VERSION = "0.0.0";         // attribute behavior to a build
let _consentState = "product-only";  // full | product-only | none — tag every event
let _activeSessionId = null;         // set while a focus session is live; groups its events
let _activeSurface = "web";          // coarse screen hint (web/web:focus/web:braindump…)
const setConsentState = (c) => { _consentState = c; };
const setActiveSessionId = (id) => { _activeSessionId = id; };
const setSurface = (s) => { _activeSurface = s; };

// Monotonic sequence per user, persisted so ordering survives reloads and equal
// timestamps (principle 5). localStorage-backed; falls back to a timestamp if blocked.
function nextSequence() {
  try {
    const k = `bq_seq_${_userId}`;
    const n = (parseInt(localStorage.getItem(k), 10) || 0) + 1;
    localStorage.setItem(k, String(n));
    return n;
  } catch { return Date.now(); }
}

const OAUTH_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
];

async function signInWithProvider(provider) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

async function signInWithEmail(email) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

async function signOut() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function ProviderButton({ provider, busy, onClick }) {
  const [hov, hovProps] = useHover();
  const isGoogle = provider.id === "google";
  return (
    <button onClick={onClick} disabled={!!busy} {...hovProps}
      style={{
        width: "100%", padding: "0.85rem 1rem", borderRadius: "12px",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem",
        fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.85rem",
        cursor: busy ? "not-allowed" : "pointer", opacity: busy && busy !== provider.id ? 0.45 : 1,
        transition: "all 0.18s cubic-bezier(0.34,1.56,0.64,1)",
        transform: hov && !busy ? "translateY(-1px)" : "none",
        ...(isGoogle
          ? { background: hov ? "#fff" : "#f3f3f3", color: "#1a1a1a", border: "1px solid #fff" }
          : { ...glass, color: "#e8e8e8", border: `1px solid ${hov ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.12)"}` }),
      }}>
      {isGoogle ? <GoogleMark /> : <span style={{ fontSize: "1rem" }}>{provider.id === "github" ? "" : "→"}</span>}
      {busy === provider.id ? "Redirecting…" : provider.label}
    </button>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(null);   // provider id | "email" | null
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const configured = !!getSupabase();

  const oauth = async (id) => {
    setBusy(id); setError(null);
    try { await signInWithProvider(id); }
    catch (e) { setError(e.message); setBusy(null); }
    // on success the browser redirects away — no need to clear busy
  };

  const magic = async () => {
    if (!email.trim()) return;
    setBusy("email"); setError(null);
    try { await signInWithEmail(email.trim()); setSent(true); }
    catch (e) { setError(e.message); }
    setBusy(null);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#060610", padding: "1rem", fontFamily: "'DM Mono', monospace",
    }}>
      <MouseGlow />
      <div style={{
        ...glassStrong, borderRadius: "24px", padding: "2.5rem 2rem",
        width: "100%", maxWidth: "380px", position: "relative", zIndex: 1,
      }}>
        <h1 style={{
          fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.9rem",
          letterSpacing: "-0.03em", textAlign: "center", marginBottom: "0.25rem",
        }}>
          <span style={{ color: "#e8e8e8" }}>Brain</span>
          <span style={{ color: "#e8ff5a", textShadow: "0 0 20px rgba(232,255,90,0.4)" }}>Queue</span>
        </h1>
        <p style={{ color: "#444", fontSize: "0.74rem", textAlign: "center", marginBottom: "2rem" }}>
          your tasks, on every device
        </p>

        {!configured ? (
          <p style={{ color: "#ffb347", fontSize: "0.8rem", textAlign: "center", lineHeight: 1.7 }}>
            Supabase isn't configured.<br />Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>.
          </p>
        ) : sent ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📬</div>
            <p style={{ color: "#ccc", fontSize: "0.86rem", lineHeight: 1.7 }}>
              Magic link sent to<br /><strong style={{ color: "#e8ff5a" }}>{email}</strong>
            </p>
            <p style={{ color: "#444", fontSize: "0.72rem", marginTop: "0.75rem" }}>Open it on this device to sign in.</p>
            <button onClick={() => { setSent(false); setEmail(""); }}
              style={{ background: "none", border: "none", color: "#6b9fff", fontSize: "0.76rem", cursor: "pointer", marginTop: "1rem" }}>
              ← use a different email
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {OAUTH_PROVIDERS.map(p => (
                <ProviderButton key={p.id} provider={p} busy={busy} onClick={() => oauth(p.id)} />
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.3rem 0" }}>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
              <span style={{ color: "#333", fontSize: "0.68rem" }}>or email</span>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            </div>

            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") magic(); }}
              placeholder="you@example.com"
              autoCapitalize="none" autoCorrect="off" spellCheck="false"
              style={{
                ...glass, borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "0.6rem",
                color: "#e8e8e8", fontSize: "0.9rem", fontFamily: "'DM Mono', monospace",
                outline: "none", width: "100%", boxSizing: "border-box",
              }}
            />
            <button
              onClick={magic} disabled={!!busy || !email.trim()}
              style={{
                width: "100%", padding: "0.85rem",
                background: "rgba(232,255,90,0.1)", border: "1px solid rgba(232,255,90,0.4)",
                borderRadius: "12px", color: "#e8ff5a",
                fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.85rem",
                cursor: busy || !email.trim() ? "not-allowed" : "pointer",
                opacity: busy || !email.trim() ? 0.5 : 1,
              }}>
              {busy === "email" ? "Sending…" : "Send magic link →"}
            </button>
          </>
        )}

        {error && <p style={{ color: "#ff6b6b", fontSize: "0.78rem", marginTop: "1rem", textAlign: "center" }}>{error}</p>}

        <p style={{ color: "#222", fontSize: "0.64rem", textAlign: "center", marginTop: "1.6rem", lineHeight: 1.6 }}>
          Secured by Supabase Auth · OAuth 2.0
        </p>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #060610; overflow-x: hidden; max-width: 100%; }
        input { -webkit-appearance: none; appearance: none; }
      `}</style>
    </div>
  );
}

function Splash() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#060610", fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.4rem",
    }}>
      <span style={{ color: "#e8e8e8" }}>Brain</span>
      <span style={{ color: "#e8ff5a", textShadow: "0 0 20px rgba(232,255,90,0.4)" }}>Queue</span>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&display=swap'); body{background:#060610;}`}</style>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

import { CAT_ACCENT, DEFAULT_WEIGHTS, calcScore, taskCats, allCategories, URGENCY_TARGET_HRS, taskXP, todayScore, weekScore, RRULE, nextOccurrence, withClassification, TIER, taskTier, fmtDuration } from "./lib/tasks";

// localStorage cache is namespaced per user, so signing in as someone else on the
// same browser never surfaces the previous account's tasks or API key.
const stateKey = (uid) => `brainqueue_v4_${uid || "anon"}`;
function loadState(uid) {
  try {
    const r = localStorage.getItem(stateKey(uid));
    const s = r ? JSON.parse(r) : { tasks: [], weights: DEFAULT_WEIGHTS };
    // Brain Dump now runs through a server-side edge function, so no Anthropic key is
    // ever stored in the browser. Purge any key left over from the old client-side flow.
    if (s.apiKey) { delete s.apiKey; saveState(uid, s); }
    return s;
  } catch { return { tasks: [], weights: DEFAULT_WEIGHTS }; }
}
function saveState(uid, s) { try { localStorage.setItem(stateKey(uid), JSON.stringify(s)); } catch {} }

// One-time recovery. Tasks created before the auth migration live under the old
// non-namespaced "brainqueue_v4" key, which the per-user code no longer reads.
// If this user has no tasks yet, adopt the legacy ones (then rename the legacy
// key so a *different* account on the same browser can't inherit them). The mount
// sync afterwards upserts the adopted tasks to Supabase under this user's id —
// i.e. it re-homes your old tasks onto whatever account you're now signed in as.
const LEGACY_STATE_KEY = "brainqueue_v4";
function loadOrAdoptState(uid) {
  const current = loadState(uid);
  if (current.tasks?.length) return current;
  try {
    const legacyRaw = localStorage.getItem(LEGACY_STATE_KEY);
    if (!legacyRaw) return current;
    const legacy = JSON.parse(legacyRaw);
    if (!legacy?.tasks?.length) return current;
    const adopted = {
      tasks: legacy.tasks,
      weights: current.weights || legacy.weights || DEFAULT_WEIGHTS,
    };
    saveState(uid, adopted);
    localStorage.setItem(`${LEGACY_STATE_KEY}_migrated_${uid}`, legacyRaw); // keep a backup
    localStorage.removeItem(LEGACY_STATE_KEY);
    return adopted;
  } catch { return current; }
}

// Supabase client (lazy — only init if env vars present)
let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

// Supabase helpers — snake_case ↔ camelCase conversion. Every row carries the
// owner's user_id; RLS rejects writes where user_id ≠ auth.uid().
const toRow = (t) => ({
  id: String(t.id),
  user_id: _userId,
  title: t.title,
  category: taskCats(t)[0] || null,   // legacy single field = primary category
  categories: taskCats(t),
  recurrence: t.recurrence || "none",
  urgency: t.urgency,
  importance: t.importance,
  effort: t.effort,
  energy: t.energy,
  pleasure: t.pleasure ?? 3,
  est_minutes: t.est_minutes ?? null,
  cognitive_load: t.cognitive_load ?? null,
  ai_delegatable: t.ai_delegatable ?? false,
  multi_step: t.multi_step ?? false,
  notes: t.notes || "",
  done: t.done || false,
  added_at: t.addedAt || new Date().toISOString(),
  done_at: t.doneAt || null,
  updated_at: new Date().toISOString(),
});
const fromRow = (r) => ({
  id: r.id,
  title: r.title,
  category: r.category,
  categories: r.categories?.length ? r.categories : (r.category ? [r.category] : []),
  recurrence: r.recurrence || "none",
  urgency: r.urgency,
  importance: r.importance,
  effort: r.effort,
  energy: r.energy,
  pleasure: r.pleasure ?? 3,
  est_minutes: r.est_minutes ?? undefined,
  cognitive_load: r.cognitive_load ?? undefined,
  ai_delegatable: r.ai_delegatable ?? false,
  multi_step: r.multi_step ?? false,
  notes: r.notes,
  done: r.done,
  addedAt: r.added_at,
  doneAt: r.done_at,
});

async function fetchRemoteTasks(userId) {
  const sb = getSupabase();
  if (!sb) return null;
  // RLS already scopes this to the user; the explicit filter is belt-and-suspenders.
  const { data, error } = await sb.from("tasks").select("*").eq("user_id", userId);
  if (error) { console.error("Supabase fetch:", error); return null; }
  return data.map(fromRow);
}

async function upsertTask(task) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("tasks").upsert(toRow(task));
  if (error) console.error("Supabase upsert:", error);
}

async function deleteRemoteTask(id) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("tasks").delete().eq("id", String(id));
  if (error) console.error("Supabase delete:", error);
}

// ─── Telemetry ───────────────────────────────────────────────────────────────
// Fire-and-forget append to the immutable task_events log (the behavioral moat).
// Never blocks or throws into the UI — failures are swallowed like upsertTask.
function logEvent(eventType, taskId = null, context = null) {
  const sb = getSupabase();
  if (!sb || !_userId) return;
  const now = new Date();
  let tz; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = null; }
  const uuid = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : undefined;
  sb.from("task_events")
    .insert({
      event_id: uuid,
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
      context,                              // event-specific payload
    })
    .then(({ error }) => { if (error) console.warn("task_events:", error.message); });
}

// Focus sessions. insert returns the new row id so we can finalize it on session end.
async function insertSession(plannedIds) {
  const sb = getSupabase();
  if (!sb || !_userId) return null;
  const { data, error } = await sb.from("sessions")
    .insert({ user_id: _userId, planned_task_ids: plannedIds.map(String), started_at: new Date().toISOString() })
    .select("id").single();
  if (error) { console.warn("sessions insert:", error.message); return null; }
  return data?.id ?? null;
}
async function finalizeSession(id, completedIds, focusSeconds) {
  const sb = getSupabase();
  if (!sb || id == null) return;
  const { error } = await sb.from("sessions")
    .update({ ended_at: new Date().toISOString(), completed_task_ids: completedIds.map(String), focus_seconds: Math.round(focusSeconds) })
    .eq("id", id);
  if (error) console.warn("sessions finalize:", error.message);
}

// ─── Calendar ────────────────────────────────────────────────────────────────
// One editable event per task, committed through whichever backend the user's
// auth provider supports — one-click via API where we can, .ics download (which
// every calendar app, including Apple Calendar, opens natively) everywhere else.
//
// To add a provider with one-click insert later: sign-in support for it (add to
// OAUTH_PROVIDERS) + an entry here with its scope + an `insert` adapter below.
const CAL_BACKENDS = {
  google: {
    label: "Google Calendar",
    scope: "https://www.googleapis.com/auth/calendar.events",
    // access_type=offline + prompt=consent so the consent screen actually shows
    // the calendar permission (and Google issues a token that carries the scope).
    queryParams: { access_type: "offline", prompt: "consent" },
  },
  azure: {
    label: "Outlook Calendar",
    scope: "Calendars.ReadWrite offline_access",
    queryParams: { prompt: "consent" },
  },
};

// The provider the signed-in user authenticated with (google | github | email | azure | apple …).
const userProvider = (session) => session?.user?.app_metadata?.provider || "email";
const calBackendFor = (session) => CAL_BACKENDS[userProvider(session)] || null;

const PENDING_CAL_KEY = "bq_pending_calendar";

const pad2 = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Turn a task + the modal's choices into a serializable, backend-agnostic event.
// All timed fields are ISO strings so the whole thing survives a sessionStorage
// round-trip across the OAuth consent redirect.
function buildEvent(task, opts) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lines = [];
  if (task.notes) lines.push(task.notes);
  lines.push(`Categories: ${taskCats(task).join(", ") || "—"} · priority score ${calcScore(task, DEFAULT_WEIGHTS)}/100`);
  lines.push("Scheduled from BrainQueue");
  const description = lines.join("\n");
  const recurrence = task.recurrence && task.recurrence !== "none" ? task.recurrence : null;

  if (opts.allDay) {
    const start = new Date(`${opts.date}T00:00:00`);
    const end = new Date(start.getTime() + 24 * 3600 * 1000); // exclusive end = next day
    return {
      summary: task.title, description, allDay: true, timeZone: tz, recurrence,
      startDate: ymd(start), endDate: ymd(end), reminders: opts.reminders,
    };
  }
  const start = new Date(`${opts.date}T${opts.time}:00`);
  const end = new Date(start.getTime() + opts.durationMin * 60000);
  return {
    summary: task.title, description, allDay: false, timeZone: tz, recurrence,
    start: start.toISOString(), end: end.toISOString(), reminders: opts.reminders,
  };
}

// 401/403 ⇒ token missing the calendar scope (or expired) ⇒ re-consent.
class CalAuthError extends Error {}

async function googleInsert(token, ev) {
  const body = ev.allDay
    ? { summary: ev.summary, description: ev.description, start: { date: ev.startDate }, end: { date: ev.endDate } }
    : { summary: ev.summary, description: ev.description,
        start: { dateTime: ev.start, timeZone: ev.timeZone },
        end: { dateTime: ev.end, timeZone: ev.timeZone } };
  body.reminders = { useDefault: false, overrides: ev.reminders.map(m => ({ method: "popup", minutes: m })) };
  if (ev.recurrence) body.recurrence = [RRULE[ev.recurrence]];
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) throw new CalAuthError("calendar permission missing");
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || `Google Calendar error ${res.status}`);
  return res.json();
}

async function microsoftInsert(token, ev) {
  // Graph wants local date-times (no offset) paired with an IANA timeZone.
  const noZ = (iso) => new Date(iso).toLocaleString("sv-SE").replace(" ", "T"); // "YYYY-MM-DDTHH:mm:ss"
  const body = ev.allDay
    ? { subject: ev.summary, body: { contentType: "text", content: ev.description }, isAllDay: true,
        start: { dateTime: `${ev.startDate}T00:00:00`, timeZone: ev.timeZone },
        end: { dateTime: `${ev.endDate}T00:00:00`, timeZone: ev.timeZone } }
    : { subject: ev.summary, body: { contentType: "text", content: ev.description },
        start: { dateTime: noZ(ev.start), timeZone: ev.timeZone },
        end: { dateTime: noZ(ev.end), timeZone: ev.timeZone } };
  if (ev.reminders.length) { body.isReminderOn = true; body.reminderMinutesBeforeStart = Math.min(...ev.reminders); }
  if (ev.recurrence) {
    const day0 = new Date(ev.start || `${ev.startDate}T00:00:00`);
    const pattern = ev.recurrence === "weekly"
      ? { type: "weekly", interval: 1, daysOfWeek: [day0.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase()] }
      : ev.recurrence === "monthly"
        ? { type: "absoluteMonthly", interval: 1, dayOfMonth: day0.getDate() }
        : { type: "daily", interval: 1 };
    body.recurrence = { pattern, range: { type: "noEnd", startDate: ev.startDate || ev.start.slice(0, 10) } };
  }
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) throw new CalAuthError("calendar permission missing");
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error?.message || `Outlook error ${res.status}`);
  return res.json();
}

function insertViaProvider(provider, token, ev) {
  if (provider === "google") return googleInsert(token, ev);
  if (provider === "azure") return microsoftInsert(token, ev);
  return Promise.reject(new Error("No one-click calendar for this provider"));
}

// Redirect to the provider's consent screen asking for the calendar scope on top
// of the already-granted sign-in scopes. The pending event is stashed first so we
// can finish the insert when the browser comes back.
async function requestCalendarConsent(provider, ev, taskId) {
  const sb = getSupabase();
  const backend = CAL_BACKENDS[provider];
  if (!sb || !backend) throw new Error("Calendar not available for this account.");
  sessionStorage.setItem(PENDING_CAL_KEY, JSON.stringify({ provider, ev, taskId }));
  const { error } = await sb.auth.signInWithOAuth({
    provider,
    options: { scopes: backend.scope, redirectTo: window.location.origin, queryParams: backend.queryParams },
  });
  if (error) { sessionStorage.removeItem(PENDING_CAL_KEY); throw error; }
}

// Did the provider redirect back with a denial instead of a grant?
function consentWasDenied() {
  const blob = window.location.hash + " " + window.location.search;
  return /error=access_denied|error=consent_required|error_description/i.test(blob);
}
function clearAuthParamsFromUrl() {
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
}

// ─── .ics generation (universal, zero-permission) ──────────────────────────────
const icsEscape = (s = "") => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsUTC = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // YYYYMMDDTHHMMSSZ

function buildICS(ev) {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@brainqueue`;
  const stamp = icsUTC(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BrainQueue//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp}`,
  ];
  if (ev.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${ev.startDate.replace(/-/g, "")}`);
    lines.push(`DTEND;VALUE=DATE:${ev.endDate.replace(/-/g, "")}`);
  } else {
    lines.push(`DTSTART:${icsUTC(ev.start)}`, `DTEND:${icsUTC(ev.end)}`);
  }
  lines.push(`SUMMARY:${icsEscape(ev.summary)}`, `DESCRIPTION:${icsEscape(ev.description)}`);
  if (ev.recurrence) lines.push(RRULE[ev.recurrence]);
  ev.reminders.forEach(m => {
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", `TRIGGER:-PT${m}M`, "END:VALARM");
  });
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadICS(ev) {
  const blob = new Blob([buildICS(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(ev.summary || "task").replace(/[^a-z0-9]+/gi, "-").slice(0, 40).toLowerCase()}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Merge: for each task, keep whichever version has the latest updated_at/addedAt
function mergeTasks(local, remote) {
  const map = new Map();
  [...local, ...remote].forEach(t => {
    const existing = map.get(String(t.id));
    if (!existing) { map.set(String(t.id), t); return; }
    const existingTs = new Date(existing.doneAt || existing.addedAt || 0).getTime();
    const newTs = new Date(t.doneAt || t.addedAt || 0).getTime();
    if (newTs > existingTs) map.set(String(t.id), t);
  });
  return Array.from(map.values());
}

const VIEWS = ["🔥 Do Now", "⚡ Quick Wins", "🧠 Low Energy", "🗂 By Category", "✅ Done"];

// glass + glassStrong tokens now live in ./ui/tokens (imported above).

// Mouse glow — organic morphing shape, color tied to movement speed
// MouseGlow now lives in ./ui (imported above).

// useHover, GlassButton, ViewTab, ScoreRing now live in ./ui (imported above).

// TierBadge, TaskCard, DoneCard now live in ./ui (imported above).

// GlassSlider now lives in ./ui/GlassSlider (imported above).

// Default the start to the next round hour, and the duration to the task's effort.
const nextHour = () => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; };
const EFFORT_DURATION = { 1: 15, 2: 30, 3: 60, 4: 90, 5: 120 }; // minutes
const REMINDER_CHOICES = [
  { m: 0, label: "At start" }, { m: 10, label: "10 min" },
  { m: 60, label: "1 hour" }, { m: 1440, label: "1 day" },
];

function ScheduleModal({ task, session, onClose, onResult }) {
  const start0 = nextHour();
  const [allDay, setAllDay] = useState(false);
  const [date, setDate] = useState(ymd(start0));
  const [time, setTime] = useState(`${pad2(start0.getHours())}:${pad2(start0.getMinutes())}`);
  const [durationMin, setDurationMin] = useState(EFFORT_DURATION[task.effort] || 60);
  const [reminders, setReminders] = useState([10]);
  const [busy, setBusy] = useState(null); // "api" | "ics" | null
  const [error, setError] = useState(null);

  const backend = calBackendFor(session);          // { label, scope… } or null
  const provider = userProvider(session);
  const opts = { allDay, date, time, durationMin, reminders };

  const toggleReminder = (m) =>
    setReminders(r => r.includes(m) ? r.filter(x => x !== m) : [...r, m].sort((a, b) => a - b));

  const onDownloadICS = () => {
    downloadICS(buildEvent(task, opts));
    onResult({ type: "success", msg: "Calendar file downloaded — open it to add the event." });
    onClose();
  };

  const onAddViaApi = async () => {
    setBusy("api"); setError(null);
    const ev = buildEvent(task, opts);
    const token = session.provider_token;
    try {
      if (token) {
        await insertViaProvider(provider, token, ev);
        onResult({ type: "success", msg: `Added to ${backend.label} ✓` });
        onClose();
        return;
      }
      // No usable token in this session → go get consent (full-page redirect).
      await requestCalendarConsent(provider, ev, task.id);
      // browser redirects away; nothing after this runs
    } catch (e) {
      if (e instanceof CalAuthError) {
        // Had a token but it lacked the scope — ask for consent.
        try { await requestCalendarConsent(provider, ev, task.id); return; }
        catch (e2) { setError(e2.message); }
      } else {
        setError(e.message);
      }
      setBusy(null);
    }
  };

  const fieldStyle = { ...glass, borderRadius: "10px", padding: "0.6rem 0.8rem", color: "#e8e8e8", fontSize: "0.82rem", fontFamily: "'DM Mono', monospace", outline: "none", boxSizing: "border-box", colorScheme: "dark" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "440px", maxHeight: "90vh", overflow: "auto", padding: "1.8rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.15rem", color: "#fff", margin: 0 }}>📅 Add to calendar</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 1.3rem", lineHeight: 1.4 }}>{task.title}</p>

        {/* All-day toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", cursor: "pointer" }}>
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} style={{ accentColor: "#e8ff5a", width: "16px", height: "16px" }} />
          <span style={{ fontSize: "0.8rem", color: "#bbb", fontFamily: "'Syne', sans-serif" }}>All-day event</span>
        </label>

        {/* Date + (time / duration) */}
        <div style={{ display: "grid", gridTemplateColumns: allDay ? "1fr" : "1fr 1fr", gap: "0.6rem", marginBottom: "1.1rem" }}>
          <div>
            <label style={{ fontSize: "0.68rem", color: "#666", fontFamily: "'Syne', sans-serif", display: "block", marginBottom: "0.3rem" }}>DATE</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...fieldStyle, width: "100%" }} />
          </div>
          {!allDay && (
            <div>
              <label style={{ fontSize: "0.68rem", color: "#666", fontFamily: "'Syne', sans-serif", display: "block", marginBottom: "0.3rem" }}>START</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...fieldStyle, width: "100%" }} />
            </div>
          )}
        </div>

        {!allDay && (
          <div style={{ marginBottom: "1.1rem" }}>
            <label style={{ fontSize: "0.68rem", color: "#666", fontFamily: "'Syne', sans-serif", display: "block", marginBottom: "0.4rem" }}>DURATION</label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {[15, 30, 60, 90, 120].map(d => (
                <button key={d} onClick={() => setDurationMin(d)} style={{
                  padding: "0.3rem 0.7rem", borderRadius: "20px", cursor: "pointer", fontSize: "0.72rem",
                  fontFamily: "'Syne', sans-serif", fontWeight: 600,
                  border: `1px solid ${durationMin === d ? "rgba(232,255,90,0.6)" : "rgba(255,255,255,0.08)"}`,
                  background: durationMin === d ? "rgba(232,255,90,0.14)" : "transparent",
                  color: durationMin === d ? "#e8ff5a" : "#555",
                }}>{d < 60 ? `${d}m` : `${d / 60}h`.replace(".5h", "h30")}</button>
              ))}
            </div>
          </div>
        )}

        {/* Reminders */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ fontSize: "0.68rem", color: "#666", fontFamily: "'Syne', sans-serif", display: "block", marginBottom: "0.4rem" }}>REMIND ME</label>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {REMINDER_CHOICES.map(({ m, label }) => {
              const on = reminders.includes(m);
              return (
                <button key={m} onClick={() => toggleReminder(m)} style={{
                  padding: "0.3rem 0.7rem", borderRadius: "20px", cursor: "pointer", fontSize: "0.72rem",
                  fontFamily: "'Syne', sans-serif", fontWeight: 600,
                  border: `1px solid ${on ? "rgba(107,159,255,0.6)" : "rgba(255,255,255,0.08)"}`,
                  background: on ? "rgba(107,159,255,0.14)" : "transparent",
                  color: on ? "#6b9fff" : "#555",
                }}>{on ? "✓ " : ""}{label}</button>
              );
            })}
          </div>
        </div>

        {error && <p style={{ color: "#ff6b6b", fontSize: "0.76rem", marginBottom: "0.9rem", textAlign: "center" }}>{error}</p>}

        {/* Actions: one-click insert where the provider supports it, .ics always. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {backend && (
            <GlassButton onClick={onAddViaApi} accent="#e8ff5a" disabled={!!busy} style={{ width: "100%", padding: "0.85rem" }}>
              {busy === "api" ? "Connecting…" : `Add to ${backend.label}`}
            </GlassButton>
          )}
          <GlassButton onClick={onDownloadICS} disabled={!!busy} style={{ width: "100%", padding: "0.85rem", ...(backend ? {} : { color: "#e8ff5a" }) }}>
            ↓ Download .ics {backend ? "(any calendar)" : "(Apple, Outlook, any app)"}
          </GlassButton>
        </div>
        {!backend && (
          <p style={{ fontSize: "0.68rem", color: "#444", textAlign: "center", marginTop: "0.9rem", lineHeight: 1.5 }}>
            One-click add is available when you sign in with Google or Microsoft.
          </p>
        )}
      </div>
    </div>
  );
}

// TaskModal now lives in ./ui (imported above).

// Compact −/value/+ stepper for tweaking a 1-5 score inline before adding.
// Dim now lives in ./ui (imported above).

// Fields we diff between the AI's proposal and what the user finally keeps. The gap
// between these two IS the preference dataset (Telemetry Capture Spec §1).
const DUMP_DIFF_FIELDS = ["title", "category", "urgency", "importance", "effort", "energy", "pleasure", "est_minutes", "cognitive_load", "ai_delegatable", "multi_step", "recurrence"];
// Coarse edit_type tag at capture time (spec: ideally a cheap classification call;
// a heuristic is far better than nothing and lets us filter typos from signal later).
const editTypeFor = (field) =>
  field === "title" ? "reword"
  : field === "category" ? "retag"
  : field === "recurrence" ? "reschedule"
  : ["urgency", "importance", "effort", "energy", "pleasure"].includes(field) ? "reprioritize"
  : "field_edit";
const sameVal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function BrainDumpModal({ onClose, onTasksAdded, weights }) {
  const [dump, setDump] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  // Capture state for the correction goldmine.
  const dumpIdRef = useRef(null);          // ties brain_dump_created → parse_* → final_committed
  const originalRef = useRef(null);        // the AI's untouched v1, to diff against on commit
  const parsedAtRef = useRef(0);           // when the preview appeared (time-to-commit clock)

  // Tag this surface for the envelope while the modal is mounted.
  useEffect(() => { setSurface("web:braindump"); return () => setSurface("web"); }, []);

  const parseDump = async () => {
    if (!dump.trim()) return;
    setLoading(true); setError(null);
    const dumpId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    dumpIdRef.current = dumpId;
    // Principle 1 (log raw input) + 2 (version the generator).
    logEvent("brain_dump_created", null, { dump_id: dumpId, raw_text: dump, char_count: dump.length, input_method: "typed" });
    logEvent("parse_requested", null, { dump_id: dumpId, prompt_version: BRAIN_DUMP_PROMPT_VERSION, model_id: BRAIN_DUMP_MODEL, params: { max_tokens: BRAIN_DUMP_MAX_TOKENS } });
    const t0 = performance.now();
    try {
      // Call the server-side "brain-dump" edge function (which holds the Anthropic
      // key) with the user's session token — the key is never in the browser.
      const sb = getSupabase();
      const { data: { session } = { session: null } } = sb ? await sb.auth.getSession() : { data: { session: null } };
      if (!session) throw new Error("Please sign in again to run Brain Dump.");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-dump`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          dump,
          system: BRAIN_DUMP_SYSTEM,
          // Structured outputs: the model is constrained to this schema, so the
          // response text is guaranteed-valid JSON — no markdown fences, no
          // regex scraping, no truncation surprises.
          schema: TASK_LIST_SCHEMA,
          model: BRAIN_DUMP_MODEL,
          max_tokens: BRAIN_DUMP_MAX_TOKENS,
        })
      });
      const rawText = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${rawText.slice(0, 300)}`);
      const data = JSON.parse(rawText);
      if (data.error) throw new Error(`API: ${data.error.message}`);
      const textBlock = data.content?.find(b => b.type === "text");
      if (!textBlock) throw new Error("No text in response");
      const result = JSON.parse(textBlock.text);
      const tasks = (result.tasks || []).map(sanitizeTask);
      if (!tasks.length) throw new Error("No actionable tasks found in that dump.");
      // Stable per-task ref so edits/removals stay matched to the original across the diff.
      const withPid = tasks.map((t, i) => ({ ...t, _pid: `${dumpId}:${i}` }));
      // Principle 1: the raw model output is irreplaceable. Estimate cost from usage.
      const usage = data.usage || {};
      const cost_est = usage.input_tokens != null
        ? +(usage.input_tokens / 1e6 * 3 + (usage.output_tokens || 0) / 1e6 * 15).toFixed(5) : null;
      logEvent("parse_result", null, {
        dump_id: dumpId, prompt_version: BRAIN_DUMP_PROMPT_VERSION, model_id: BRAIN_DUMP_MODEL,
        raw_model_output: textBlock.text, parsed_tasks: tasks, latency_ms: Math.round(performance.now() - t0),
        tokens_in: usage.input_tokens ?? null, tokens_out: usage.output_tokens ?? null, cost_est,
      });
      originalRef.current = withPid.map(t => ({ ...t }));   // deep-enough snapshot of v1
      parsedAtRef.current = performance.now();
      setParsed(withPid);
    } catch (e) {
      setError(e.message);
      logEvent("parse_failed", null, { dump_id: dumpId, error: String(e.message).slice(0, 300), latency_ms: Math.round(performance.now() - t0) });
    }
    setLoading(false);
  };

  const updateTask = (i, patch) => setParsed(p => p.map((t, j) => j === i ? { ...t, ...patch } : t));
  const removeTask = (i) => setParsed(p => p.filter((_, j) => j !== i));

  // The v1 → final delta. Every kept-unchanged field is a positive label (principle 7),
  // every edit is a preference pair (principle 1) — log both, fully reconstructable.
  const logCorrections = () => {
    const dumpId = dumpIdRef.current;
    const orig = originalRef.current || [];
    const finalByPid = new Map(parsed.map(t => [t._pid, t]));
    let nEdits = 0, nRemoved = 0, nAccepted = 0;
    const editTypes = {};
    for (const o of orig) {
      const f = finalByPid.get(o._pid);
      if (!f) {
        nRemoved++; editTypes.delete = (editTypes.delete || 0) + 1;
        logEvent("task_edited", null, { dump_id: dumpId, task_ref: o._pid, edit_type: "delete", field: null });
        continue;
      }
      const changed = DUMP_DIFF_FIELDS.filter(field => !sameVal(o[field], f[field]));
      if (changed.length === 0) {
        nAccepted++;
        logEvent("task_accepted_unchanged", null, { dump_id: dumpId, task_ref: o._pid, fields: DUMP_DIFF_FIELDS });
      } else {
        for (const field of changed) {
          nEdits++;
          const et = editTypeFor(field);
          editTypes[et] = (editTypes[et] || 0) + 1;
          logEvent("task_edited", null, { dump_id: dumpId, task_ref: o._pid, field, before: o[field] ?? null, after: f[field] ?? null, edit_type: et });
        }
      }
    }
    logEvent("final_committed", null, {
      dump_id: dumpId, n_tasks: parsed.length, n_edits: nEdits, n_removed: nRemoved, n_accepted: nAccepted,
      edit_types: editTypes, time_to_commit_ms: Math.round(performance.now() - parsedAtRef.current),
    });
  };

  const confirmAdd = () => {
    try { logCorrections(); } catch { /* telemetry must never block the commit */ }
    const now = new Date().toISOString();
    // Strip the internal _pid before the tasks enter the app/db.
    onTasksAdded(parsed.map((t, i) => {
      const task = { ...t, id: Date.now() + i, done: false, addedAt: now, doneAt: null };
      delete task._pid;
      return task;
    }));
    onClose();
  };

  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") parseDump(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "640px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.3rem", color: "#fff", margin: 0 }}>Brain Dump</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        {!parsed ? (
          <>
            <p style={{ color: "#555", fontSize: "0.82rem", marginBottom: "1rem", lineHeight: 1.7 }}>Paste anything — numbered, prose, checkboxes, any language. Claude extracts and scores the tasks; you tweak before adding.</p>
            <textarea value={dump} onChange={e => setDump(e.target.value)} onKeyDown={onKey} autoFocus
              placeholder={"5. Se renseigner sur Runpod\n6. Faire recette Sauce carotte\n7. Entreprise Mansa remplir documents\n8. Create Obsidian vault"}
              style={{ width: "100%", minHeight: "180px", ...glass, borderRadius: "12px", padding: "1rem", color: "#ccc", fontSize: "0.87rem", fontFamily: "'DM Mono', monospace", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            <GlassButton onClick={parseDump} disabled={loading || !dump.trim()} accent="#e8ff5a" style={{ marginTop: "1rem", width: "100%", padding: "0.9rem" }}>
              {loading ? "Classifying…" : "Parse & classify →"}
            </GlassButton>
            <p style={{ color: "#2e2e2e", fontSize: "0.65rem", textAlign: "center", marginTop: "0.6rem" }}>⌘/Ctrl + Enter · model: {BRAIN_DUMP_MODEL}</p>
            {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.75rem" }}>❌ {error}</p>}
          </>
        ) : (
          <>
            <p style={{ color: "#555", fontSize: "0.82rem", marginBottom: "1.2rem" }}>Found <strong style={{ color: "#e8ff5a" }}>{parsed.length} task{parsed.length === 1 ? "" : "s"}</strong>. Edit anything, then add.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
              {parsed.map((t, i) => {
                const acc = CAT_ACCENT(t.category);
                return (
                  <div key={i} style={{ ...glass, borderRadius: "12px", padding: "0.85rem 1rem", borderLeft: `2px solid ${acc}66` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                      <input value={t.title} onChange={e => updateTask(i, { title: e.target.value })}
                        style={{ flex: 1, minWidth: 0, background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#ddd", fontSize: "0.87rem", fontWeight: 600, fontFamily: "'DM Mono', monospace", outline: "none", padding: "2px 0" }} />
                      <span style={{ fontSize: "0.68rem", color: "#e8ff5a", fontWeight: 700, whiteSpace: "nowrap" }}>Score {calcScore(t, weights)}</span>
                      <button onClick={() => removeTask(i)} title="Remove"
                        style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: "0.85rem" }}
                        onMouseEnter={e => e.target.style.color = "#ef4444"} onMouseLeave={e => e.target.style.color = "#2a2a2a"}>🗑</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
                      <select value={t.category} onChange={e => updateTask(i, { category: e.target.value })}
                        style={{ background: acc + "14", border: `1px solid ${acc}33`, borderRadius: "20px", color: acc, fontSize: "0.66rem", fontFamily: "'Syne', sans-serif", fontWeight: 700, padding: "2px 8px", outline: "none", cursor: "pointer", appearance: "none" }}>
                        {CATEGORIES.map(c => <option key={c} value={c} style={{ background: "#101018", color: "#ddd" }}>{c}</option>)}
                      </select>
                      <Dim label="U" value={t.urgency} onChange={v => updateTask(i, { urgency: v })} />
                      <Dim label="I" value={t.importance} onChange={v => updateTask(i, { importance: v })} />
                      <Dim label="E" value={t.effort} onChange={v => updateTask(i, { effort: v })} />
                      <Dim label="⚡" value={t.energy} onChange={v => updateTask(i, { energy: v })} />
                      <TierBadge task={t} showEst />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <GlassButton onClick={() => setParsed(null)} style={{ flex: 1 }}>← Back</GlassButton>
              <GlassButton onClick={confirmAdd} disabled={!parsed.length} accent="#e8ff5a" style={{ flex: 2 }}>Add {parsed.length} task{parsed.length === 1 ? "" : "s"} →</GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// WeightSlider now lives in ./ui (imported above).

// SettingsModal now lives in ./ui (imported above).

function ExportButton({ tasks, weights }) {
  const exportCSV = () => {
    const headers = ["title", "category", "urgency", "importance", "effort", "energy", "score", "done", "notes", "addedAt", "doneAt"];
    const rows = tasks.map(t => headers.map(h => {
      const v = h === "score" ? calcScore(t, weights) : t[h] ?? "";
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `brainqueue_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  return <GlassButton onClick={exportCSV} title="Export CSV" style={{ padding: "0.55rem 0.75rem", fontSize: "0.8rem" }}>↓<span className="bq-lbl"> CSV</span></GlassButton>;
}

// ─── Sidebar: XP/level, analytics, categories ────────────────────────────────
// XPBar now lives in ./ui/widgets (imported above).

// MiniBars now lives in ./ui/widgets (imported above).

// SideSection now lives in ./ui/widgets (imported above).

function Sidebar({ tasks, customCategories, filterCat, onPickCategory, onOpenAnalytics, open, onClose, session }) {
  const cats = allCategories(customCategories);
  const countFor = (c) => tasks.filter(t => !t.done && taskCats(t).includes(c)).length;
  const activeCount = tasks.filter(t => !t.done).length;

  const catRow = (c, count, active) => {
    const acc = c === "All" ? "#e8ff5a" : CAT_ACCENT(c);
    return (
      <button key={c} onClick={() => onPickCategory(c)} style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%",
        padding: "0.4rem 0.6rem", borderRadius: "9px", cursor: "pointer", marginBottom: "0.2rem",
        border: `1px solid ${active ? acc + "66" : "transparent"}`, background: active ? acc + "18" : "transparent",
        color: active ? acc : "#9a9aa6", fontFamily: "'Syne', sans-serif", fontWeight: 600, fontSize: "0.76rem",
        transition: "all 0.15s",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          {c !== "All" && <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: acc, boxShadow: `0 0 6px ${acc}` }} />}{c}
        </span>
        <span style={{ fontSize: "0.62rem", color: "#666" }}>{count}</span>
      </button>
    );
  };

  return (
    <>
      {open && <div className="bq-backdrop" onClick={onClose} />}
      <aside className={`bq-sidebar${open ? " open" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.03em" }}>
            <span style={{ color: "#e8e8e8" }}>Brain</span><span style={{ color: "#e8ff5a", textShadow: "0 0 16px rgba(232,255,90,0.4)" }}>Queue</span>
          </h1>
          <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: "#666", fontSize: "1.3rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <XPBar tasks={tasks} />

        <SideSection title="Analytics">
          <div style={{ ...glass, borderRadius: "12px", padding: "0.7rem 0.8rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "#aaa", marginBottom: "0.6rem" }}>
              <span><b style={{ color: "#e8ff5a" }}>{activeCount}</b> active</span>
              <span><b style={{ color: "#6b9fff" }}>{todayScore(tasks)}</b> today</span>
              <span><b style={{ color: "#6bffb3" }}>{weekScore(tasks)}</b> this wk</span>
            </div>
            <GlassButton onClick={onOpenAnalytics} style={{ width: "100%", padding: "0.5rem", fontSize: "0.74rem" }}>📊 View analytics</GlassButton>
          </div>
        </SideSection>

        <SideSection title="Categories">
          {catRow("All", tasks.filter(t => !t.done).length, filterCat === "All")}
          {cats.map(c => catRow(c, countFor(c), filterCat === c))}
        </SideSection>

        <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
          <UserChip session={session} />
          <button onClick={() => signOut()} title="Sign out" style={{ ...glass, borderRadius: "10px", padding: "0.4rem 0.55rem", color: "#9a9aa6", cursor: "pointer", fontSize: "0.85rem", border: "1px solid rgba(255,255,255,0.1)" }}>⏻</button>
        </div>
      </aside>
    </>
  );
}

// ─── Analytics modal ─────────────────────────────────────────────────────────
// Donut now lives in ./ui/widgets (imported above).

// StatCard now lives in ./ui/widgets (imported above).

// AnalyticsModal now lives in ./ui (imported above).

// ─── Focus sessions + Pomodoro ───────────────────────────────────────────────
// Lightweight, fully client-side notifications: a soft chime + an in-tab Web
// Notification on each phase change. No service worker, no backend.
function notify(title, body) {
  try { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body }); } catch { /* ignore */ }
}
let _audioCtx = null;
function chime(freq = 660) {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = _audioCtx.createOscillator(), g = _audioCtx.createGain();
    o.type = "sine"; o.frequency.value = freq; o.connect(g); g.connect(_audioCtx.destination);
    const t = _audioCtx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.start(t); o.stop(t + 0.7);
  } catch { /* ignore */ }
}
const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const TIER_RANK = { reflex: 0, standard: 1, heavy: 2 };

// FocusRing now lives in ./ui/widgets (imported above).

// Ready-made task sets so the user picks a focus in one tap instead of curating.
// `tasks` arrives already active + score-sorted, so "Do Now" is just the top slice.
// buildProposals now lives in ./ui (imported above).

// SessionStepper now lives in ./ui/widgets (imported above).

// SessionSetupModal now lives in ./ui (imported above).

function FocusMode({ session, tasks, onMarkDone, onExit }) {
  const [completed, setCompleted] = useState([]);
  const remaining = session.taskIds.filter(id => !completed.includes(id));
  const current = tasks.find(t => t.id === remaining[0]) || null;
  const heaviestTier = session.taskIds
    .map(id => tasks.find(t => t.id === id)).filter(Boolean)
    .reduce((m, t) => Math.max(m, TIER_RANK[taskTier(t)]), 0);

  const [phase, setPhase] = useState("intro"); // intro | work | break | done
  const [secondsLeft, setSecondsLeft] = useState(session.work * 60);
  const [running, setRunning] = useState(true);
  const [pomos, setPomos] = useState(0);
  const focusSec = useRef(0);
  const flipping = useRef(false);

  // Calm entrance; longer breath for heavier work.
  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("work"), heaviestTier === 2 ? 4200 : 2400);
    return () => clearTimeout(t);
  }, [phase, heaviestTier]);

  // Tick
  useEffect(() => {
    if ((phase !== "work" && phase !== "break") || !running) return;
    const iv = setInterval(() => {
      if (phase === "work") focusSec.current += 1;
      setSecondsLeft(s => s - 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, running]);

  // Phase transition when the clock runs out
  useEffect(() => {
    if (phase !== "work" && phase !== "break") return;
    if (secondsLeft > 0) { flipping.current = false; return; }
    if (flipping.current) return;
    flipping.current = true;
    if (phase === "work") {
      chime(660); notify("Break time", "Step away and breathe.");
      setPomos(p => p + 1); logEvent("pomodoro_completed", null, { minutes: session.work });
      logEvent("break_started", null, { trigger: "pomodoro", break_minutes: session.brk });
      setPhase("break"); setSecondsLeft(session.brk * 60);
    } else {
      chime(880); notify("Back to focus", "Next round — let's go.");
      logEvent("break_ended", null, { trigger: "timer" });
      setPhase("work"); setSecondsLeft(session.work * 60);
    }
  }, [secondsLeft, phase, session.work, session.brk]);

  const finish = () => onExit(completed, focusSec.current);
  const doneCurrent = () => {
    if (!current) return;
    onMarkDone(current.id);
    const next = [...completed, current.id];
    setCompleted(next);
    if (session.taskIds.every(id => next.includes(id))) setPhase("done");
  };
  // Manual break: the user chooses to step away. Logged so we can later learn each
  // user's natural focus rhythm (Telemetry Capture Spec §3 — break_started/break_ended).
  const takeBreak = () => {
    chime(660); notify("Break", "Step away and breathe.");
    logEvent("break_started", null, { trigger: "manual", break_minutes: session.brk });
    flipping.current = true;
    setPhase("break"); setSecondsLeft(session.brk * 60); setRunning(true);
  };
  const endBreak = () => {
    chime(880);
    logEvent("break_ended", null, { trigger: "manual" });
    flipping.current = true;
    setPhase("work"); setSecondsLeft(session.work * 60);
  };

  const shell = { position: "fixed", inset: 0, zIndex: 300, background: "radial-gradient(900px 600px at 50% 35%, rgba(232,255,90,0.05), transparent 60%), #060610", color: "#e8e8e8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "2rem", fontFamily: "'DM Mono', monospace" };

  // INTRO ceremony
  if (phase === "intro") {
    const heavy = heaviestTier === 2;
    return (
      <div style={shell}>
        <div className="task-enter" style={{ maxWidth: "560px" }}>
          <p style={{ fontFamily: "'Syne', sans-serif", color: "#555", letterSpacing: "0.3em", textTransform: "uppercase", fontSize: "0.7rem" }}>Focus</p>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(1.6rem, 5vw, 2.4rem)", color: "#fff", margin: "1rem 0", lineHeight: 1.2 }}>{current ? current.title : "Let's begin"}</h1>
          {heavy && <p style={{ color: "#888", fontSize: "0.9rem" }}>Take a breath. What does “done” look like?</p>}
          <p style={{ color: "#444", fontSize: "0.78rem", marginTop: "1.5rem" }}>{session.work}-minute focus · {remaining.length} task{remaining.length === 1 ? "" : "s"}</p>
        </div>
      </div>
    );
  }

  // DONE summary
  if (phase === "done") {
    return (
      <div style={shell}>
        <div className="task-enter">
          <div style={{ fontSize: "2.4rem", marginBottom: "0.6rem" }}>✓</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.8rem", color: "#e8ff5a", margin: 0 }}>Session complete</h1>
          <p style={{ color: "#aaa", fontSize: "0.95rem", marginTop: "1rem", lineHeight: 1.9 }}>
            <b style={{ color: "#6bffb3" }}>{completed.length}</b> task{completed.length === 1 ? "" : "s"} done ·{" "}
            <b style={{ color: "#e8ff5a" }}>{mmss(focusSec.current)}</b> focused · <b style={{ color: "#6b9fff" }}>{pomos}</b> pomodoro{pomos === 1 ? "" : "s"}
          </p>
          <GlassButton onClick={finish} accent="#e8ff5a" style={{ marginTop: "1.8rem", padding: "0.8rem 2rem" }}>Done</GlassButton>
        </div>
      </div>
    );
  }

  // WORK / BREAK — calm, single-task screen: a timer bar up top, one focus card below.
  const isBreak = phase === "break";
  const accent = isBreak ? "#6b9fff" : "#e8ff5a";
  const taskTotal = session.taskIds.length;
  const taskPos = Math.min(completed.length + 1, taskTotal);
  const tier = current ? TIER[taskTier(current)] : null;
  const progPct = taskTotal ? (completed.length / taskTotal) * 100 : 0;

  const stage = { ...shell, justifyContent: "flex-start", padding: 0, overflow: "hidden" };
  const topbar = { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.1rem 1.6rem", boxSizing: "border-box" };
  const pill = { display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "0.05rem", padding: "0.4rem 1.3rem", borderRadius: "14px", ...glass, border: `1px solid ${accent}44`, opacity: running ? 1 : 0.55, transition: "opacity .3s" };
  const card = { ...glassStrong, position: "relative", width: "100%", maxWidth: "620px", borderRadius: "24px", padding: "2.6rem 2rem 2rem", border: `1px solid ${accent}22`, boxShadow: `0 0 80px ${accent}10`, textAlign: "center" };
  const badge = { width: "54px", height: "54px", margin: "0 auto 1.4rem", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: "1.4rem", background: `${accent}14`, border: `1px solid ${accent}55`, boxShadow: `0 0 24px ${accent}33` };
  const eyebrow = { fontFamily: "'Syne', sans-serif", color: accent, letterSpacing: "0.28em", textTransform: "uppercase", fontSize: "0.66rem", opacity: 0.85, margin: 0 };
  const btn = { padding: "0.8rem 1.2rem", flex: "1 1 auto" };

  return (
    <div style={stage}>
      {/* top bar: wordmark · timer · exit */}
      <div style={topbar}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.05rem", color: "#fff" }}>Brain<span style={{ color: "#e8ff5a" }}>Queue</span></span>
        <div style={pill}>
          <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>{mmss(secondsLeft)}</span>
          <span style={{ fontSize: "0.56rem", letterSpacing: "0.18em", textTransform: "uppercase", color: accent }}>{running ? (isBreak ? "Break time" : "Focus time") : "Paused"}</span>
        </div>
        <button onClick={finish} title="End session"
          style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", color: "#888", fontSize: "0.74rem", padding: "0.45rem 0.8rem", cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>✕ Exit Focus</button>
      </div>

      {/* centered focus card */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "1rem 1.4rem 3rem", boxSizing: "border-box" }}>
        <div className="task-enter" style={card}>
          <div style={badge}>{isBreak ? "☕" : "✓"}</div>
          <p style={eyebrow}>{isBreak ? "On a break" : "Your current focus"}</p>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(1.4rem, 4vw, 2.1rem)", color: "#fff", margin: "0.7rem 0 0", lineHeight: 1.2 }}>
            {isBreak ? "Breathe — look away from the screen" : (current ? current.title : "All tasks done — wrap up")}
          </h1>
          <p style={{ color: "#7a7a86", fontSize: "0.8rem", margin: "0.9rem 0 0", lineHeight: 1.6, maxWidth: "440px", marginInline: "auto" }}>
            {isBreak
              ? "Rest your eyes. Your timer resumes focus when the break ends."
              : (current ? <>✦ Chosen for this slot — {tier.label.toLowerCase()} effort, ~{fmtDuration(current.est_minutes || 25)}, matching your current energy &amp; urgency.</> : "Nothing left in this session.")}
          </p>

          {!isBreak && (
            <div style={{ maxWidth: "300px", margin: "1.6rem auto 1.8rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#888", marginBottom: "0.55rem", letterSpacing: "0.05em" }}>{taskPos} of {taskTotal}</div>
              <div style={{ height: "6px", borderRadius: "20px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progPct}%`, background: accent, borderRadius: "20px", transition: "width .4s", boxShadow: `0 0 12px ${accent}88` }} />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.7rem", marginTop: isBreak ? "1.8rem" : 0, flexWrap: "wrap", justifyContent: "center" }}>
            {isBreak ? (
              <GlassButton onClick={endBreak} accent="#6bffb3" style={btn}>▶ Resume focus</GlassButton>
            ) : (
              <>
                {current && <GlassButton onClick={doneCurrent} accent="#e8ff5a" style={btn}>✓ Complete task</GlassButton>}
                <GlassButton onClick={takeBreak} style={btn}>☕ Take a short break</GlassButton>
                <GlassButton onClick={() => setRunning(r => !r)} style={btn}>{running ? "⏸ Pause focus" : "▶ Resume"}</GlassButton>
              </>
            )}
          </div>

          <p style={{ color: "#4a4a52", fontSize: "0.7rem", marginTop: "1.5rem", marginBottom: 0 }}>
            ⓘ {isBreak ? "Telemetry noted your break — it helps tune your ideal rhythm." : "The next task appears only after this one is completed."}
          </p>
        </div>
      </div>
    </div>
  );
}

// An empty view is an invitation to act, not a dead end — directive copy + a CTA.
// EmptyState now lives in ./ui (imported above).

// Inline "+ category" pill for the main category bar (Enter or + to add).
// InlineCatAdd now lives in ./ui (imported above).

function MainApp({ session }) {
  const userId = session.user.id;
  setActiveUser(userId); // ensure row helpers stamp user_id before any task write
  // Load this user's data-use consent (defaults to "product-only" — lawful basis to
  // run BrainQueue, but NOT to train on their data). Every event is tagged with it so a
  // future learning loop can trivially filter to the consented subset (principle 6).
  try { setConsentState(localStorage.getItem(`bq_consent_${userId}`) || "product-only"); } catch { /* default stands */ }

  const [state, setState] = useState(() => loadOrAdoptState(userId));
  const { tasks, weights = DEFAULT_WEIGHTS, customCategories = [] } = state;
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error

  // Custom categories live in local storage and don't sync directly — but tasks
  // DO sync, so any custom category attached to a task is recovered here by
  // unioning the local list with every non-default category found on the tasks.
  const syncedCategories = useMemo(() => {
    const set = new Set(customCategories);
    tasks.forEach(t => taskCats(t).forEach(c => { if (c && !CATEGORIES.includes(c)) set.add(c); }));
    return [...set];
  }, [customCategories, tasks]);

  const update = (patch) => setState(s => { const n = { ...s, ...patch }; saveState(userId, n); return n; });

  // On mount: fetch this user's remote tasks, merge with local, then subscribe to
  // realtime changes scoped to their rows.
  useEffect(() => {
    setActiveUser(userId);
    const sb = getSupabase();
    if (!sb) return;

    setSyncStatus("syncing");
    const ownFilter = `user_id=eq.${userId}`;

    // 1. Initial fetch + merge
    fetchRemoteTasks(userId).then(remote => {
      if (!remote) { setSyncStatus("error"); return; }
      setState(s => {
        const merged = mergeTasks(s.tasks, remote);
        const remoteIds = new Set(remote.map(t => String(t.id)));
        s.tasks.forEach(t => { if (!remoteIds.has(String(t.id))) upsertTask(t); });
        const n = { ...s, tasks: merged };
        saveState(userId, n);
        return n;
      });
      setSyncStatus("synced");
    });

    // 2. Realtime subscription — INSERT/UPDATE/DELETE for this user, from any device
    const channel = sb
      .channel(`tasks-realtime-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks", filter: ownFilter }, ({ new: row }) => {
        const task = fromRow(row);
        setState(s => {
          if (s.tasks.find(t => String(t.id) === String(task.id))) return s; // already have it
          const n = { ...s, tasks: [...s.tasks, task] };
          saveState(userId, n);
          return n;
        });
        setSyncStatus("synced");
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks", filter: ownFilter }, ({ new: row }) => {
        const task = fromRow(row);
        setState(s => {
          const n = { ...s, tasks: s.tasks.map(t => String(t.id) === String(task.id) ? task : t) };
          saveState(userId, n);
          return n;
        });
        setSyncStatus("synced");
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks", filter: ownFilter }, ({ old: row }) => {
        setState(s => {
          const n = { ...s, tasks: s.tasks.filter(t => String(t.id) !== String(row.id)) };
          saveState(userId, n);
          return n;
        });
        setSyncStatus("synced");
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") console.log("✓ Realtime connected");
        if (status === "CHANNEL_ERROR") { console.error("Realtime error"); setSyncStatus("error"); }
      });

    // Cleanup on unmount / user switch
    return () => { sb.removeChannel(channel); };
  }, [userId]);

  const [view, setView] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showDump, setShowDump] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [scheduleTask, setScheduleTask] = useState(null);
  const [toast, setToast] = useState(null); // { type: "success" | "error", msg }
  const [filterCat, setFilterCat] = useState("All");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSessionSetup, setShowSessionSetup] = useState(false);
  const [focusSession, setFocusSession] = useState(null);

  // After returning from a calendar-consent redirect, finish (or report) the
  // insert that was stashed before we left. Runs on mount + when the provider
  // token lands in the session; a ref makes it fire at most once.
  const calResumeRef = useRef(false);
  useEffect(() => {
    if (calResumeRef.current) return;
    const raw = sessionStorage.getItem(PENDING_CAL_KEY);
    if (!raw) return;
    if (consentWasDenied()) {
      calResumeRef.current = true;
      sessionStorage.removeItem(PENDING_CAL_KEY);
      setToast({ type: "error", msg: "Calendar access denied — you can still download the .ics from any task." });
      clearAuthParamsFromUrl();
      return;
    }
    const token = session.provider_token;
    if (!token) return; // token not in the session yet — wait for it
    calResumeRef.current = true;
    const { provider, ev } = JSON.parse(raw);
    sessionStorage.removeItem(PENDING_CAL_KEY);
    insertViaProvider(provider, token, ev)
      .then(() => setToast({ type: "success", msg: `Added to ${CAL_BACKENDS[provider]?.label || "your calendar"} ✓` }))
      .catch(e => setToast({ type: "error", msg: `Couldn't add to calendar: ${e.message}` }));
    clearAuthParamsFromUrl();
  }, [session.provider_token]);

  // All mutators compute from the *live* state (s.tasks) inside the updater, not
  // a captured `tasks` closure — otherwise a realtime echo or a quick second
  // action can revert an earlier change (e.g. completions silently disappearing).
  const commit = useCallback((mut) => {
    setState(s => {
      const tasks2 = mut(s.tasks);
      const n = { ...s, tasks: tasks2 };
      saveState(userId, n);
      return n;
    });
  }, [userId]);

  const saveTask = useCallback((raw) => {
    const t = withClassification(raw);           // ensure every task carries a tier
    let isNew = false;
    commit(ts => { isNew = !ts.find(x => x.id === t.id); return isNew ? [...ts, t] : ts.map(x => x.id === t.id ? t : x); });
    upsertTask(t);
    logEvent(isNew ? "task_created" : "task_edited", t.id, { tier: taskTier(t), category: t.category });
    if (isNew) {
      // Manual tasks get a classification snapshot too, so the labeled dataset covers
      // every task's origin, not just brain-dumped ones (principle 3).
      logEvent("task_features", t.id, {
        est_minutes: t.est_minutes, cognitive_load: t.cognitive_load,
        ai_delegatable: t.ai_delegatable, multi_step: t.multi_step,
        tier: taskTier(t), category: t.category, urgency: t.urgency,
        importance: t.importance, effort: t.effort, energy: t.energy, source: "manual",
      });
    }
    setShowAdd(false); setEditTask(null);
  }, [commit]);

  const markDone = useCallback((id) => {
    commit(ts => {
      const updated = ts.map(t => t.id === id ? { ...t, done: true, doneAt: new Date().toISOString() } : t);
      const task = updated.find(t => t.id === id);
      // Recurring task → spawn its next occurrence so it reappears in the queue.
      const spawned = task && task.recurrence && task.recurrence !== "none" ? nextOccurrence({ ...task, done: false, doneAt: null }) : null;
      if (task) {
        upsertTask(task);
        const late = task.addedAt && (new Date(task.doneAt) - new Date(task.addedAt)) / 3.6e6 > (URGENCY_TARGET_HRS[task.urgency] ?? 72);
        logEvent(late ? "task_completed_late" : "task_completed", task.id, { tier: taskTier(task), xp: taskXP(task) });
      }
      if (spawned) upsertTask(spawned);
      return spawned ? [...updated, spawned] : updated;
    });
  }, [commit]);

  const addCategory = useCallback((c) => {
    const name = c.trim();
    if (!name) return;
    setState(s => {
      if (allCategories(s.customCategories || []).includes(name)) return s;
      const n = { ...s, customCategories: [...(s.customCategories || []), name] };
      saveState(userId, n);
      return n;
    });
  }, [userId]);

  const restore = useCallback((id) => {
    commit(ts => {
      const updated = ts.map(t => t.id === id ? { ...t, done: false, doneAt: null } : t);
      const task = updated.find(t => t.id === id);
      if (task) upsertTask(task);
      return updated;
    });
    logEvent("task_restored", id);
  }, [commit]);

  const deleteTask = useCallback((id) => {
    commit(ts => ts.filter(t => t.id !== id));
    deleteRemoteTask(id);
    logEvent("task_deleted", id);
  }, [commit]);

  const addBulk = useCallback((newTasks) => {
    const classified = newTasks.map(withClassification);
    commit(ts => [...ts, ...classified]);
    classified.forEach(t => {
      upsertTask(t);
      // The historical classification decision, snapshotted at create time (principle 3):
      // eval needs the real decision the system made then, not one re-derived later.
      logEvent("task_features", t.id, {
        est_minutes: t.est_minutes, cognitive_load: t.cognitive_load,
        ai_delegatable: t.ai_delegatable, multi_step: t.multi_step,
        tier: taskTier(t), category: t.category, urgency: t.urgency,
        importance: t.importance, effort: t.effort, energy: t.energy, source: "brain_dump",
      });
    });
    logEvent("braindump_added", null, { count: classified.length });
  }, [commit]);

  const startSession = useCallback(async ({ taskIds, work, brk }) => {
    setShowSessionSetup(false);
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission(); } catch { /* ignore */ }
    const id = await insertSession(taskIds);
    setActiveSessionId(id);   // group every focus/pomodoro event under this session
    setSurface("web:focus");
    logEvent("session_started", null, { count: taskIds.length, work, brk });
    setFocusSession({ id, taskIds, work, brk });
  }, []);

  const endSession = useCallback((completedIds, focusSeconds) => {
    setFocusSession(fs => {
      if (fs) {
        finalizeSession(fs.id, completedIds, focusSeconds);
        logEvent("session_completed", null, { completed: completedIds.length, focus_seconds: Math.round(focusSeconds) });
      }
      return null;
    });
    setActiveSessionId(null);
    setSurface("web");
  }, []);

  const active = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done).sort((a, b) => new Date(b.doneAt) - new Date(a.doneAt));
  const sorted = [...active].sort((a, b) => calcScore(b, weights) - calcScore(a, weights));

  const viewTasks = view === 4 ? done : [
    sorted.filter(t => calcScore(t, weights) >= 60 || t.urgency >= 4),
    sorted.filter(t => t.effort <= 2 && t.importance >= 3),
    sorted.filter(t => t.energy <= 2),
    filterCat === "All" ? sorted : sorted.filter(t => taskCats(t).includes(filterCat)),
  ][view];

  const viewDescriptions = [
    "High score + urgent. Start here.",
    "Under 15 min, meaningful impact.",
    "Doable in zombie mode.",
    `${filterCat === "All" ? "All" : filterCat} active tasks.`,
    `${done.length} completed tasks.`,
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #060610; overflow-x: hidden; max-width: 100%; }
        ::selection { background: #e8ff5a33; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #e8ff5a; box-shadow: 0 0 8px #e8ff5a88; cursor: pointer; }
        input, textarea { -webkit-appearance: none; appearance: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .task-enter { animation: fadeUp 0.28s cubic-bezier(0.34,1.2,0.64,1) both; }
        .bq-sidebar { position: fixed; top: 0; left: 0; width: 264px; height: 100vh; overflow-y: auto; z-index: 40;
          background: rgba(12,12,20,0.85); backdrop-filter: blur(24px) saturate(150%); -webkit-backdrop-filter: blur(24px) saturate(150%);
          border-right: 1px solid rgba(255,255,255,0.07); padding: 1.3rem 1.1rem 2rem; display: flex; flex-direction: column; gap: 1.3rem;
          transform: translateX(-100%); transition: transform .26s cubic-bezier(.34,1.2,.64,1); box-shadow: 0 0 60px rgba(0,0,0,.6); }
        .bq-sidebar.open { transform: translateX(0); }
        .bq-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 39; }
        .bq-head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 1.3rem; }
        .bq-actions { display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0; }
        @media (max-width: 680px) {
          .bq-title { font-size: 1.3rem !important; }
          .bq-sub { font-size: 0.62rem !important; }
          /* Stack the header; show LABELED action buttons that wrap into rows
             (icon-only was too cryptic on a phone). */
          .bq-head { flex-wrap: wrap; }
          .bq-actions { width: 100%; flex-wrap: wrap; justify-content: flex-start; gap: 0.4rem; margin-top: 0.5rem; }
          .bq-actions > * { flex: 1 1 auto; justify-content: center; }
        }
        /* Quality floor: visible keyboard focus + honour reduced-motion. */
        :focus-visible { outline: 2px solid rgba(232,255,90,0.65); outline-offset: 2px; border-radius: 6px; }
        *:focus:not(:focus-visible) { outline: none; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
        }
      `}</style>

      <MouseGlow />

      {/* Ambient orbs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(107,159,255,0.06) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "-10%", right: "-5%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(196,123,255,0.05) 0%, transparent 70%)" }} />
      </div>

      <Sidebar tasks={tasks} customCategories={syncedCategories} filterCat={filterCat} session={session}
        onPickCategory={(c) => { setFilterCat(c); setView(3); setSidebarOpen(false); }}
        onOpenAnalytics={() => { setShowAnalytics(true); setSidebarOpen(false); }}
        open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="bq-shell" style={{ minHeight: "100vh", color: "#e0e0e0", fontFamily: "'DM Mono', monospace", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: "1.5rem 1.25rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ maxWidth: "780px", margin: "0 auto" }}>
            <div className="bq-head">
              <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", minWidth: 0 }}>
                <GlassButton onClick={() => setSidebarOpen(o => !o)} title="Menu" style={{ padding: "0.55rem 0.75rem", fontSize: "0.95rem", flexShrink: 0 }}>☰</GlassButton>
                <div style={{ minWidth: 0 }}>
                  <h1 className="bq-title" style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.03em", lineHeight: 1, whiteSpace: "nowrap" }}>
                    <span style={{ color: "#e8e8e8" }}>Brain</span><span style={{ color: "#e8ff5a", textShadow: "0 0 18px rgba(232,255,90,0.35)" }}>Queue</span>
                  </h1>
                  <p className="bq-sub" style={{ fontSize: "0.7rem", color: "#555", marginTop: "0.35rem", whiteSpace: "nowrap", fontFamily: "'Syne', sans-serif" }}>
                    {active.length} active · {done.length} done
                    {syncStatus === "syncing" && <span style={{ color: "#6b9fff", marginLeft: "0.4rem" }}>↻</span>}
                    {syncStatus === "synced"  && <span style={{ color: "#6bffb3", marginLeft: "0.4rem" }}>✓</span>}
                    {syncStatus === "error"   && <span style={{ color: "#ff6b6b", marginLeft: "0.4rem" }}>⚠ offline</span>}
                  </p>
                </div>
              </div>
              <div className="bq-actions">
                <ExportButton tasks={tasks} weights={weights} />
                <GlassButton onClick={() => setShowSettings(true)} title="Settings" style={{ padding: "0.55rem 0.7rem", fontSize: "0.82rem" }}>⚙️<span className="bq-lbl"> Settings</span></GlassButton>
                <GlassButton onClick={() => setShowSessionSetup(true)} title="Focus" accent="#6bffb3" style={{ padding: "0.55rem 0.85rem", fontSize: "0.82rem" }}>▶<span className="bq-lbl"> Focus</span></GlassButton>
                <GlassButton onClick={() => setShowDump(true)} title="Brain Dump" style={{ padding: "0.55rem 0.85rem", fontSize: "0.82rem" }}>✨<span className="bq-lbl"> Brain Dump</span></GlassButton>
                <GlassButton onClick={() => setShowAdd(true)} title="Add task" accent="#e8ff5a" style={{ padding: "0.55rem 0.9rem", fontSize: "0.82rem" }}>+<span className="bq-lbl"> Add</span></GlassButton>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
              {VIEWS.map((v, i) => <ViewTab key={i} label={v} active={view === i} onClick={() => setView(i)} />)}
            </div>
          </div>
        </div>

        {view === 3 && (
          <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ maxWidth: "720px", margin: "0 auto", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {["All", ...allCategories(syncedCategories)].map(c => {
                const acc = c === "All" ? "#e8ff5a" : CAT_ACCENT(c); const act = filterCat === c;
                return (
                  <button key={c} onClick={() => setFilterCat(c)} style={{
                    padding: "0.28rem 0.75rem", borderRadius: "20px",
                    border: `1px solid ${act ? acc + "60" : "rgba(255,255,255,0.06)"}`,
                    background: act ? acc + "14" : "transparent",
                    color: act ? acc : "#3a3a3a", fontSize: "0.73rem", cursor: "pointer",
                    fontFamily: "'Syne', sans-serif", fontWeight: 600,
                    transition: "background 0.15s, border-color 0.15s, color 0.15s",
                  }}>{c}</button>
                );
              })}
              <InlineCatAdd onAdd={addCategory} />
            </div>
          </div>
        )}

        <div style={{ padding: "0.9rem 1.5rem 0.4rem" }}>
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>
            <p style={{ fontSize: "0.7rem", color: "#3a3a3a", fontFamily: "'Syne', sans-serif", letterSpacing: "0.06em" }}>
              <span style={{ color: "#6b6b76", fontWeight: 700 }}>{viewTasks?.length} {viewTasks?.length === 1 ? "TASK" : "TASKS"}</span> · {viewDescriptions[view].toUpperCase()}
            </p>
          </div>
        </div>

        <div style={{ padding: "0.5rem 1.5rem 5rem", maxWidth: "720px", margin: "0 auto" }}>
          {!viewTasks?.length ? (
            <EmptyState view={view} filterCat={filterCat} onAdd={() => setShowAdd(true)} onDump={() => setShowDump(true)} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {viewTasks.map((t, i) => (
                <div key={t.id} className="task-enter" style={{ animationDelay: `${i * 0.04}s` }}>
                  {t.done
                    ? <DoneCard task={t} onDelete={deleteTask} onRestore={restore} />
                    : <TaskCard task={t} onEdit={setEditTask} onMarkDone={markDone} onDelete={deleteTask} onSchedule={setScheduleTask} weights={weights} />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSettings && <SettingsModal weights={weights} onSave={(w) => update({ weights: w })} onClose={() => setShowSettings(false)} />}
      {showDump && <BrainDumpModal onClose={() => setShowDump(false)} onTasksAdded={addBulk} weights={weights} />}
      {(showAdd || editTask) && <TaskModal task={editTask} onClose={() => { setShowAdd(false); setEditTask(null); }} onSave={saveTask} customCategories={syncedCategories} onAddCategory={addCategory} />}
      {scheduleTask && <ScheduleModal task={scheduleTask} session={session} onClose={() => setScheduleTask(null)} onResult={setToast} />}
      {showAnalytics && <AnalyticsModal tasks={tasks} customCategories={syncedCategories} onClose={() => setShowAnalytics(false)} />}
      {showSessionSetup && <SessionSetupModal tasks={sorted} onStart={startSession} onClose={() => setShowSessionSetup(false)} />}
      {focusSession && <FocusMode session={focusSession} tasks={tasks} onMarkDone={markDone} onExit={endSession} />}
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
    </>
  );
}

// Brief auto-dismissing notice for calendar add results (and the post-redirect resume).
// Toast now lives in ./ui (imported above).

// UserChip now lives in ./ui (imported above).

export default function App() {
  // undefined = still loading the session; null = no Supabase / signed out.
  const [session, setSession] = useState(() => (getSupabase() ? undefined : null));

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    sb.auth.getSession().then(({ data }) => { if (active) setSession(data.session); });
    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  if (session === undefined) return <Splash />;
  if (!session) return <LoginScreen />;
  // key on user id so switching accounts fully remounts with fresh per-user state
  return <MainApp key={session.user.id} session={session} />;
}
