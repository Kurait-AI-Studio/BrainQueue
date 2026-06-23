// ─── Calendar ────────────────────────────────────────────────────────────────
// One editable event per task, committed through whichever backend the user's auth
// provider supports — one-click via API where we can (Google / Microsoft), and a
// universal .ics download (which every calendar app, incl. Apple, opens natively)
// everywhere else. Extracted from App.jsx so ScheduleModal can be its own module.
//
// To add a provider with one-click insert later: sign-in support for it (OAUTH_PROVIDERS
// in LoginScreen) + an entry here with its scope + an `insert` adapter below.
import { taskCats, calcScore, DEFAULT_WEIGHTS, RRULE } from "./tasks";
import { getSupabase } from "./client";

export const CAL_BACKENDS = {
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
export const userProvider = (session) => session?.user?.app_metadata?.provider || "email";
export const calBackendFor = (session) => CAL_BACKENDS[userProvider(session)] || null;

export const PENDING_CAL_KEY = "bq_pending_calendar";

export const pad2 = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// Default the start to the next round hour.
export const nextHour = () => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; };

// Turn a task + the modal's choices into a serializable, backend-agnostic event.
// All timed fields are ISO strings so the whole thing survives a sessionStorage
// round-trip across the OAuth consent redirect.
export function buildEvent(task, opts) {
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
export class CalAuthError extends Error {}

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

export function insertViaProvider(provider, token, ev) {
  if (provider === "google") return googleInsert(token, ev);
  if (provider === "azure") return microsoftInsert(token, ev);
  return Promise.reject(new Error("No one-click calendar for this provider"));
}

// Redirect to the provider's consent screen asking for the calendar scope on top
// of the already-granted sign-in scopes. The pending event is stashed first so we
// can finish the insert when the browser comes back.
export async function requestCalendarConsent(provider, ev, taskId) {
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
export function consentWasDenied() {
  const blob = window.location.hash + " " + window.location.search;
  return /error=access_denied|error=consent_required|error_description/i.test(blob);
}
export function clearAuthParamsFromUrl() {
  window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
}

// ─── .ics generation (universal, zero-permission) ──────────────────────────────
const icsEscape = (s = "") => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsUTC = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); // YYYYMMDDTHHMMSSZ

export function buildICS(ev) {
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

export function downloadICS(ev) {
  const blob = new Blob([buildICS(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(ev.summary || "task").replace(/[^a-z0-9]+/gi, "-").slice(0, 40).toLowerCase()}.ics`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
