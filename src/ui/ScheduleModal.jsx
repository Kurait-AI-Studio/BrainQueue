// Add-to-calendar modal: pick date/time/duration/reminders, then one-click insert
// (Google / Microsoft, with a consent redirect if the token lacks the scope) or a
// universal .ics download. The calendar plumbing lives in ../lib/calendar.
import { useState } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";
import {
  nextHour, ymd, pad2, calBackendFor, userProvider, buildEvent,
  downloadICS, insertViaProvider, requestCalendarConsent, CalAuthError,
} from "../lib/calendar";

const EFFORT_DURATION = { 1: 15, 2: 30, 3: 60, 4: 90, 5: 120 }; // minutes
const REMINDER_CHOICES = [
  { m: 0, label: "At start" }, { m: 10, label: "10 min" },
  { m: 60, label: "1 hour" }, { m: 1440, label: "1 day" },
];

export function ScheduleModal({ task, session, onClose, onResult }) {
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
