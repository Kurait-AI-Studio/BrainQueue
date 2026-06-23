import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { CATEGORIES } from "./brainDumpSpec";
import { glass, glassStrong, GlassButton, ViewTab, TaskCard, DoneCard, MouseGlow, EmptyState, InlineCatAdd, Toast, XpBurst, SetCelebration, AppSidebar } from "./ui";
import { recordSetClear, celebrationTitle } from "./lib/rewards";
import { getSupabase, getUserId, setActiveUser, setConsentState, setActiveSessionId, setSurface, logEvent, flushOutbox, insertSession, finalizeSession, signOut } from "./lib/client";
import { LoginScreen, Splash } from "./ui/LoginScreen";
import { FocusMode } from "./ui/FocusMode";
import { BrainDumpModal } from "./ui/BrainDumpModal";
import { WeeklyReviewModal } from "./ui/WeeklyReviewModal";

// Code-split the heavy, on-demand screens/modals: they're only mounted on a user action
// (open settings, edit a task, view analytics, enter Focus Mode), so keeping them out of
// the initial bundle cuts first-load JS. Each becomes its own async chunk; React.lazy
// loads it the first time it renders. Named exports → mapped to default for lazy().
const AnalyticsModal = lazy(() => import("./ui/AnalyticsModal").then(m => ({ default: m.AnalyticsModal })));
const TaskModal = lazy(() => import("./ui/TaskModal").then(m => ({ default: m.TaskModal })));
const TaskDetailModal = lazy(() => import("./ui/TaskDetailModal").then(m => ({ default: m.TaskDetailModal })));
const SettingsModal = lazy(() => import("./ui/SettingsModal").then(m => ({ default: m.SettingsModal })));
const FocusSetsScreen = lazy(() => import("./ui/FocusSetsScreen").then(m => ({ default: m.FocusSetsScreen })));


// ─── Auth ────────────────────────────────────────────────────────────────────
// Authentication is handled by Supabase Auth (OAuth2 + email magic link). The
// browser holds a short-lived JWT (auto-refreshed by the SDK); Row-Level Security
// on the `tasks` table scopes every read/write to the signed-in user. No password
// ever touches our code. See supabase/migrations for the schema + RLS policies.

// The Supabase client, the signed-in user, the telemetry envelope + logEvent, and
// focus-session helpers all live in ./lib/client (imported above) so screens can be
// their own modules without re-importing the glue.


import { CAT_ACCENT, DEFAULT_WEIGHTS, calcScore, taskCats, allCategories, URGENCY_TARGET_HRS, taskXP, RRULE, nextOccurrence, withClassification, taskTier } from "./lib/tasks";
import { DEFAULT_REVIEW_TONE } from "./lib/weeklyReview";

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

// Supabase helpers — snake_case ↔ camelCase conversion. Every row carries the
// owner's user_id; RLS rejects writes where user_id ≠ auth.uid().
const toRow = (t) => ({
  id: String(t.id),
  user_id: getUserId(),
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

  const fieldStyle = { ...glass, borderRadius: "10px", padding: "0.6rem 0.8rem", color: "#e8e8e8", fontSize: "0.82rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", outline: "none", boxSizing: "border-box", colorScheme: "dark" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "440px", maxHeight: "90vh", overflow: "auto", padding: "1.8rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "1.15rem", color: "#fff", margin: 0 }}>📅 Add to calendar</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        <p style={{ fontSize: "0.78rem", color: "#888", margin: "0 0 1.3rem", lineHeight: 1.4 }}>{task.title}</p>

        {/* All-day toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", cursor: "pointer" }}>
          <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} style={{ accentColor: "#bef24a", width: "16px", height: "16px" }} />
          <span style={{ fontSize: "0.8rem", color: "#bbb", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>All-day event</span>
        </label>

        {/* Date + (time / duration) */}
        <div style={{ display: "grid", gridTemplateColumns: allDay ? "1fr" : "1fr 1fr", gap: "0.6rem", marginBottom: "1.1rem" }}>
          <div>
            <label style={{ fontSize: "0.68rem", color: "#666", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "block", marginBottom: "0.3rem" }}>DATE</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...fieldStyle, width: "100%" }} />
          </div>
          {!allDay && (
            <div>
              <label style={{ fontSize: "0.68rem", color: "#666", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "block", marginBottom: "0.3rem" }}>START</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ ...fieldStyle, width: "100%" }} />
            </div>
          )}
        </div>

        {!allDay && (
          <div style={{ marginBottom: "1.1rem" }}>
            <label style={{ fontSize: "0.68rem", color: "#666", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "block", marginBottom: "0.4rem" }}>DURATION</label>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {[15, 30, 60, 90, 120].map(d => (
                <button key={d} onClick={() => setDurationMin(d)} style={{
                  padding: "0.3rem 0.7rem", borderRadius: "20px", cursor: "pointer", fontSize: "0.72rem",
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600,
                  border: `1px solid ${durationMin === d ? "rgba(232,255,90,0.6)" : "rgba(255,255,255,0.08)"}`,
                  background: durationMin === d ? "rgba(232,255,90,0.14)" : "transparent",
                  color: durationMin === d ? "#bef24a" : "#555",
                }}>{d < 60 ? `${d}m` : `${d / 60}h`.replace(".5h", "h30")}</button>
              ))}
            </div>
          </div>
        )}

        {/* Reminders */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ fontSize: "0.68rem", color: "#666", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "block", marginBottom: "0.4rem" }}>REMIND ME</label>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {REMINDER_CHOICES.map(({ m, label }) => {
              const on = reminders.includes(m);
              return (
                <button key={m} onClick={() => toggleReminder(m)} style={{
                  padding: "0.3rem 0.7rem", borderRadius: "20px", cursor: "pointer", fontSize: "0.72rem",
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600,
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
            <GlassButton onClick={onAddViaApi} accent="#bef24a" disabled={!!busy} style={{ width: "100%", padding: "0.85rem" }}>
              {busy === "api" ? "Connecting…" : `Add to ${backend.label}`}
            </GlassButton>
          )}
          <GlassButton onClick={onDownloadICS} disabled={!!busy} style={{ width: "100%", padding: "0.85rem", ...(backend ? {} : { color: "#bef24a" }) }}>
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

// ─── Focus sessions + Pomodoro ───────────────────────────────────────────────
// Lightweight, fully client-side notifications: a soft chime + an in-tab Web
// Notification on each phase change. No service worker, no backend.

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
  const { tasks, weights = DEFAULT_WEIGHTS, customCategories = [], reviewTone = DEFAULT_REVIEW_TONE } = state;
  const tasksRef = useRef(tasks); tasksRef.current = tasks; // latest tasks for set-clear detection
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

    // Drain any events stranded by a previous offline/failed session, and keep
    // retrying whenever connectivity returns.
    flushOutbox();
    const onOnline = () => flushOutbox();
    window.addEventListener("online", onOnline);

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
    return () => { sb.removeChannel(channel); window.removeEventListener("online", onOnline); };
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
  const [showReview, setShowReview] = useState(false);
  const [showSessionSetup, setShowSessionSetup] = useState(false);
  const [xpBurst, setXpBurst] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [focusSession, setFocusSession] = useState(null);
  const [sessionDraft, setSessionDraft] = useState([]); // task ids queued for a focus session
  const [detailTask, setDetailTask] = useState(null);    // task whose wide detail view is open
  const [seedDraftIds, setSeedDraftIds] = useState([]);  // tray → pre-seed the focus-set editor

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
        setXpBurst({ id: Date.now(), amount: taskXP(task), label: "Task complete" }); // dopamine pop
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

  const startSession = useCallback(async ({ taskIds, work, brk, meta }) => {
    setShowSessionSetup(false);
    setSeedDraftIds([]);
    setSessionDraft([]); // starting a session consumes the tray
    setDetailTask(null);
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission(); } catch { /* ignore */ }
    const id = await insertSession(taskIds);
    setActiveSessionId(id);   // group every focus/pomodoro event under this session
    setSurface("web:focus");
    // meta carries how the set was assembled (proposed / customized / custom / tray / single)
    // + whether it was reordered and how many tasks were added/removed — signal for the learning loop.
    logEvent("session_started", null, { count: taskIds.length, work, brk, ...(meta || { source: "proposed" }) });
    setFocusSession({ id, taskIds, work, brk });
  }, []);

  // "Session tray" — queue tasks from the All Tasks list, then open the focus-set editor pre-seeded.
  const addToSession = (task) => {
    if (sessionDraft.includes(task.id)) { setToast({ type: "success", msg: "Already in your session" }); return; }
    setSessionDraft(d => [...d, task.id]);
    logEvent("session_task_queued", task.id, { from: "all_tasks", tier: taskTier(task) });
    setToast({ type: "success", msg: "Added to focus session" });
  };
  const focusNow = (task) => { setDetailTask(null); startSession({ taskIds: [task.id], work: 25, brk: 5, meta: { source: "single", count: 1, reordered: false, added: 0, removed: 0, base_set_ids: [String(task.id)], final_ids: [String(task.id)] } }); };
  const startTraySession = () => { setSeedDraftIds(sessionDraft); setShowSessionSetup(true); };

  const endSession = useCallback((completedIds, focusSeconds) => {
    setFocusSession(fs => {
      if (fs) {
        finalizeSession(fs.id, completedIds, focusSeconds);
        // Record the actual ids (not just the count) so the set is reconstructable from
        // this single immutable event even if the mutable sessions row or an individual
        // task_completed event never lands. planned_ids = the final set that was run.
        logEvent("session_completed", null, {
          completed: completedIds.length,
          completed_ids: completedIds.map(String),
          planned_ids: (fs.taskIds || []).map(String),
          focus_seconds: Math.round(focusSeconds),
        });
        // Full set clear → the BIG celebration (gated to whole sets / combos / streaks).
        const planned = fs.taskIds || [];
        const doneNow = new Set(tasksRef.current.filter(t => t.done).map(t => t.id));
        if (planned.length > 0 && planned.every(id => doneNow.has(id))) {
          const r = recordSetClear(session?.user?.id);
          r.earned.forEach(b => logEvent("bonus_earned", null, { bonus: b.id, xp: b.xp, sets_today: r.setsToday, streak: r.streak }));
          setCelebration({ id: Date.now(), title: celebrationTitle(r), earned: r.earned, totalXp: r.totalXp });
        }
      }
      return null;
    });
    setActiveSessionId(null);
    setSurface("web");
  }, [session]);

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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0a0a0d; overflow-x: hidden; max-width: 100%; }
        ::selection { background: #bef24a33; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
        input[type=range] { -webkit-appearance: none; width: 100%; height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; outline: none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #bef24a; box-shadow: 0 0 8px #bef24a88; cursor: pointer; }
        input, textarea { -webkit-appearance: none; appearance: none; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .task-enter { animation: fadeUp 0.28s cubic-bezier(0.34,1.2,0.64,1) both; }
        .bq-sidebar { position: fixed; top: 0; left: 0; width: 264px; height: 100vh; overflow-y: auto; z-index: 40;
          background: rgba(12,12,20,0.85); backdrop-filter: blur(24px) saturate(150%); -webkit-backdrop-filter: blur(24px) saturate(150%);
          border-right: 1px solid rgba(255,255,255,0.07); padding: 1.3rem 1.1rem 2rem; display: flex; flex-direction: column; gap: 1.3rem;
          transform: translateX(-100%); transition: transform .26s cubic-bezier(.34,1.2,.64,1); box-shadow: 0 0 60px rgba(0,0,0,.6); }
        .bq-sidebar.open { transform: translateX(0); }
        .bq-backdrop, .app-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 39; }
        /* New persistent shell sidebar: drawer on mobile, fixed rail on desktop. */
        .app-sidebar { position: fixed; top: 0; left: 0; width: 234px; height: 100vh; overflow-y: auto; z-index: 40;
          background: #0e0e12; border-right: 1px solid rgba(255,255,255,0.06); padding: 1.5rem 0.9rem; display: flex; flex-direction: column;
          transform: translateX(-100%); transition: transform .26s cubic-bezier(.34,1.2,.64,1); box-shadow: 0 0 60px rgba(0,0,0,.6); }
        .app-sidebar.open { transform: translateX(0); }
        @media (min-width: 900px) {
          .app-sidebar { transform: translateX(0); box-shadow: none; }
          .app-main { margin-left: 234px; }
          .app-backdrop { display: none; }
          .bq-topbar-left { display: none !important; }
        }
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

      <AppSidebar session={session} tasks={tasks} active="tasks" open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        onAddTask={() => setShowAdd(true)} onSignOut={() => signOut()}
        onNav={(id) => {
          if (id === "focus") setShowSessionSetup(true);
          else if (id === "tasks") setView(3);
          else if (id === "analytics") setShowAnalytics(true);
          else if (id === "rewards") setShowReview(true);
          else if (id === "settings") setShowSettings(true);
        }} />

      <div className="bq-shell app-main" style={{ minHeight: "100vh", color: "#e0e0e0", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ padding: "1.5rem 1.25rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ maxWidth: "780px", margin: "0 auto" }}>
            <div className="bq-head">
              <div className="bq-topbar-left" style={{ display: "flex", alignItems: "center", gap: "0.7rem", minWidth: 0 }}>
                <GlassButton onClick={() => setSidebarOpen(o => !o)} title="Menu" style={{ padding: "0.55rem 0.75rem", fontSize: "0.95rem", flexShrink: 0 }}>☰</GlassButton>
                <div style={{ minWidth: 0 }}>
                  <h1 className="bq-title" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.03em", lineHeight: 1, whiteSpace: "nowrap" }}>
                    <span style={{ color: "#e8e8e8" }}>Brain</span><span style={{ color: "#bef24a", textShadow: "0 0 18px rgba(232,255,90,0.35)" }}>Queue</span>
                  </h1>
                  <p className="bq-sub" style={{ fontSize: "0.7rem", color: "#555", marginTop: "0.35rem", whiteSpace: "nowrap", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                    {active.length} active · {done.length} done
                    {syncStatus === "syncing" && <span style={{ color: "#6b9fff", marginLeft: "0.4rem" }}>↻</span>}
                    {syncStatus === "synced"  && <span style={{ color: "#6bffb3", marginLeft: "0.4rem" }}>✓</span>}
                    {syncStatus === "error"   && <span style={{ color: "#ff6b6b", marginLeft: "0.4rem" }}>⚠ offline</span>}
                  </p>
                </div>
              </div>
              <div className="bq-actions">
                <GlassButton onClick={() => setShowSettings(true)} title="Settings" style={{ padding: "0.55rem 0.7rem", fontSize: "0.82rem" }}>⚙️<span className="bq-lbl"> Settings</span></GlassButton>
                <GlassButton onClick={() => setShowSessionSetup(true)} title="Focus" accent="#6bffb3" style={{ padding: "0.55rem 0.85rem", fontSize: "0.82rem" }}>▶<span className="bq-lbl"> Focus</span></GlassButton>
                <GlassButton onClick={() => setShowDump(true)} title="Brain Dump" style={{ padding: "0.55rem 0.85rem", fontSize: "0.82rem" }}>✨<span className="bq-lbl"> Brain Dump</span></GlassButton>
                <GlassButton onClick={() => setShowAdd(true)} title="Add task" accent="#bef24a" style={{ padding: "0.55rem 0.9rem", fontSize: "0.82rem" }}>+<span className="bq-lbl"> Add</span></GlassButton>
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
                const acc = c === "All" ? "#bef24a" : CAT_ACCENT(c); const act = filterCat === c;
                return (
                  <button key={c} onClick={() => setFilterCat(c)} style={{
                    padding: "0.28rem 0.75rem", borderRadius: "20px",
                    border: `1px solid ${act ? acc + "60" : "rgba(255,255,255,0.06)"}`,
                    background: act ? acc + "14" : "transparent",
                    color: act ? acc : "#3a3a3a", fontSize: "0.73rem", cursor: "pointer",
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 600,
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
            <p style={{ fontSize: "0.7rem", color: "#3a3a3a", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", letterSpacing: "0.06em" }}>
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
                    : <TaskCard task={t} onOpen={setDetailTask} onAddToSession={addToSession} inSession={sessionDraft.includes(t.id)} onEdit={setEditTask} onMarkDone={markDone} onDelete={deleteTask} onSchedule={setScheduleTask} weights={weights} />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSettings && <Suspense fallback={null}><SettingsModal weights={weights} reviewTone={reviewTone} onSave={(s) => update(s)} onClose={() => setShowSettings(false)} /></Suspense>}
      {showDump && <BrainDumpModal onClose={() => setShowDump(false)} onTasksAdded={addBulk} weights={weights} />}
      {(showAdd || editTask) && <Suspense fallback={null}><TaskModal task={editTask} onClose={() => { setShowAdd(false); setEditTask(null); }} onSave={saveTask} customCategories={syncedCategories} onAddCategory={addCategory} /></Suspense>}
      {scheduleTask && <ScheduleModal task={scheduleTask} session={session} onClose={() => setScheduleTask(null)} onResult={setToast} />}
      {showAnalytics && <Suspense fallback={null}><AnalyticsModal tasks={tasks} customCategories={syncedCategories} onClose={() => setShowAnalytics(false)} /></Suspense>}
      {showReview && <WeeklyReviewModal tasks={tasks} weights={weights} tone={reviewTone} onClose={() => setShowReview(false)}
        onView={(r) => logEvent("weekly_review_viewed", null, { week_start: r.range.start.toISOString().slice(0, 10), tone: r.tone, completed: r.stats.completed, added: r.stats.added, capture_rate: r.stats.captureRate, focus_minutes: r.stats.focusMinutes, delta: r.stats.delta, top_category: r.stats.topCategory?.cat ?? null })} />}
      {detailTask && <Suspense fallback={null}><TaskDetailModal task={tasks.find(t => t.id === detailTask.id) || detailTask} weights={weights} inSession={sessionDraft.includes(detailTask.id)}
        onClose={() => setDetailTask(null)}
        onEdit={(t) => { setDetailTask(null); setEditTask(t); }}
        onMarkDone={(id) => { markDone(id); setDetailTask(null); }}
        onDelete={(id) => { deleteTask(id); setDetailTask(null); }}
        onSchedule={(t) => { setDetailTask(null); setScheduleTask(t); }}
        onAddToSession={addToSession} onFocusNow={focusNow} /></Suspense>}
      {sessionDraft.length > 0 && !showSessionSetup && !focusSession && (
        <div style={{ position: "fixed", left: "50%", bottom: 22, transform: "translateX(-50%)", zIndex: 240, display: "flex", alignItems: "center", gap: 14, background: "#14141a", border: "1px solid rgba(190,242,74,0.4)", borderRadius: 999, padding: "0.6rem 0.7rem 0.6rem 1.1rem", boxShadow: "0 16px 40px rgba(0,0,0,0.5)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "#ededf0" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>🎯 {sessionDraft.length} task{sessionDraft.length === 1 ? "" : "s"} queued for focus</span>
          <button onClick={() => setSessionDraft([])} title="Clear" style={{ background: "none", border: "none", color: "#83838f", cursor: "pointer", fontSize: "0.85rem" }}>Clear</button>
          <button onClick={startTraySession} style={{ background: "#bef24a", border: "none", borderRadius: 999, padding: "0.5rem 1.1rem", color: "#0a0a0d", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}>Start focus →</button>
        </div>
      )}
      {showSessionSetup && <Suspense fallback={null}><FocusSetsScreen tasks={sorted} session={session} onStart={startSession} initialDraftIds={seedDraftIds} onExit={() => { setShowSessionSetup(false); setSeedDraftIds([]); }} /></Suspense>}
      {focusSession && <FocusMode session={focusSession} tasks={tasks} onMarkDone={markDone} onExit={endSession} />}
      <XpBurst burst={xpBurst} onDone={() => setXpBurst(null)} />
      <SetCelebration celebration={celebration} onDone={() => setCelebration(null)} />
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
