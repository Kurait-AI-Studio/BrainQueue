import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  CATEGORIES,
  BRAIN_DUMP_MODEL,
  BRAIN_DUMP_MAX_TOKENS,
  BRAIN_DUMP_SYSTEM,
  TASK_LIST_SCHEMA,
  sanitizeTask,
} from "./brainDumpSpec";


// ─── Auth ────────────────────────────────────────────────────────────────────
// Authentication is handled by Supabase Auth (OAuth2 + email magic link). The
// browser holds a short-lived JWT (auto-refreshed by the SDK); Row-Level Security
// on the `tasks` table scopes every read/write to the signed-in user. No password
// ever touches our code. See supabase/migrations for the schema + RLS policies.

// The signed-in user's id, kept in module scope so the Supabase row helpers can
// stamp user_id without threading it through every call site.
let _userId = null;
const setActiveUser = (id) => { _userId = id; };

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
        body { background: #060610; }
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

const CATEGORY_COLORS = {
  Health: { accent: "#ff6b6b", glow: "255,107,107" },
  Work: { accent: "#6b9fff", glow: "107,159,255" },
  Admin: { accent: "#ffb347", glow: "255,179,71" },
  Social: { accent: "#6bffb3", glow: "107,255,179" },
  Finance: { accent: "#c47bff", glow: "196,123,255" },
  Learning: { accent: "#5de8ff", glow: "93,232,255" },
  Personal: { accent: "#ffaa5e", glow: "255,170,94" },
};
// Custom categories get a stable colour derived from their name (hash → palette).
const CAT_PALETTE = ["#ff6b6b","#6b9fff","#ffb347","#6bffb3","#c47bff","#5de8ff","#ffaa5e","#e8ff5a","#ff8fd0","#7cffb2","#ff7a5c","#a78bff"];
const hashStr = (s = "") => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const CAT_ACCENT = (cat) => CATEGORY_COLORS[cat]?.accent || CAT_PALETTE[hashStr(cat) % CAT_PALETTE.length];
const hexToRgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
const CAT_GLOW = (cat) => CATEGORY_COLORS[cat]?.glow || hexToRgb(CAT_ACCENT(cat));

const ENERGY_LABELS = { 1: "Zombie mode", 2: "Low", 3: "Normal", 4: "Focused", 5: "Peak" };
const PLEASURE_LABELS = { 1: "😣 Dread", 2: "😕 Meh", 3: "😐 Neutral", 4: "🙂 Enjoy", 5: "😍 Love it" };
const EFFORT_LABELS = { 1: "2 min", 2: "15 min", 3: "1 hour", 4: "Half day", 5: "Multi-day" };
const DEFAULT_WEIGHTS = { urgency: 30, importance: 30, effort: 15, energy: 10, pleasure: 15 };

function calcScore(task, w = DEFAULT_WEIGHTS) {
  const wp = w.pleasure ?? 0;
  const total = w.urgency + w.importance + w.effort + w.energy + wp || 100;
  return Math.round(
    (task.urgency * (w.urgency / total) +
      task.importance * (w.importance / total) +
      (6 - task.effort) * (w.effort / total) +
      (6 - task.energy) * (w.energy / total) +
      (task.pleasure ?? 3) * (wp / total)) * 20
  );
}
function getUrgencyLabel(u) {
  if (u >= 5) return "🔴 Today"; if (u >= 4) return "🟠 This week";
  if (u >= 3) return "🟡 This month"; return "⚪ Someday";
}

// ─── Categories: multi + custom ──────────────────────────────────────────────
// A task's categories (array). Falls back to the legacy single `category` field
// so tasks created before multi-category still work.
const taskCats = (t) => (t.categories?.length ? t.categories : (t.category ? [t.category] : []));
const allCategories = (custom = []) => [...CATEGORIES, ...custom.filter(c => !CATEGORIES.includes(c))];

// ─── Gamification: XP + levels ───────────────────────────────────────────────
// XP rewards harder, higher-stakes tasks (urgency/importance/effort/energy) and
// gives an on-time bonus when a task is finished within the window its urgency
// implies — so "time taken" matters too.
const URGENCY_TARGET_HRS = { 1: 336, 2: 168, 3: 72, 4: 24, 5: 8 };
function taskXP(task) {
  const diff = (task.urgency || 0) + (task.importance || 0) + (task.effort || 0) + (task.energy || 0); // 4..20
  let xp = 10 + diff * 4;
  if (task.doneAt && task.addedAt) {
    const hrs = (new Date(task.doneAt) - new Date(task.addedAt)) / 3.6e6;
    if (hrs <= (URGENCY_TARGET_HRS[task.urgency] ?? 72)) xp += 15; // on-time bonus
  }
  return Math.round(xp);
}
const totalXP = (tasks) => tasks.filter(t => t.done).reduce((s, t) => s + taskXP(t), 0);

const LEVEL_TITLES = ["Sprout", "Doer", "Organizer", "Achiever", "Strategist", "Operator", "Machine", "Virtuoso", "Legend"];
function levelInfo(xp) {
  // Deliberately steep: ~a week of solid days per early level, harder after.
  let level = 1, need = 300, acc = 0;
  while (xp >= acc + need) { acc += need; level++; need = Math.round(need * 1.5); }
  const into = xp - acc;
  return { level, into, need, pct: Math.round((into / need) * 100), title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] };
}

// ─── Analytics: completions over time ────────────────────────────────────────
// Returns buckets [{ label, count, xp }] (oldest → newest) for the chosen period,
// derived entirely from each done task's doneAt — no extra storage needed.
function doneSeries(tasks, period) {
  const done = tasks.filter(t => t.done && t.doneAt).map(t => ({ d: new Date(t.doneAt), xp: taskXP(t) }));
  const now = new Date();
  const sod = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const bucket = (from, to, label, full) => {
    const hits = done.filter(x => x.d >= from && x.d < to);
    return { label, full, count: hits.length, xp: hits.reduce((s, h) => s + h.xp, 0) };
  };
  const out = [];
  if (period === "week") {
    // Current calendar week, Monday → Sunday, one bar per day.
    const today = sod(now);
    const dow = (today.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(today); monday.setDate(today.getDate() - dow);
    const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      const from = new Date(monday); from.setDate(monday.getDate() + i);
      const to = new Date(from); to.setDate(from.getDate() + 1);
      out.push(bucket(from, to, wd[i], from.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })));
    }
  } else {
    // Current month, one bar per day (1 … last day).
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let i = 0; i < days; i++) {
      const from = new Date(first); from.setDate(first.getDate() + i);
      const to = new Date(from); to.setDate(from.getDate() + 1);
      out.push(bucket(from, to, String(i + 1), from.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })));
    }
  }
  return out;
}
const countDoneBetween = (tasks, from, to) => tasks.filter(t => t.done && t.doneAt && new Date(t.doneAt) >= from && new Date(t.doneAt) < to).length;
function todayScore(tasks) { const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setDate(s.getDate() + 1); return countDoneBetween(tasks, s, e); }
function weekScore(tasks) { const t = new Date(); t.setHours(0, 0, 0, 0); const dow = (t.getDay() + 6) % 7; const m = new Date(t); m.setDate(t.getDate() - dow); const e = new Date(m); e.setDate(m.getDate() + 7); return countDoneBetween(tasks, m, e); }

// ─── Recurrence ──────────────────────────────────────────────────────────────
const RECURRENCE_LABELS = { none: "One-time", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const RRULE = { daily: "RRULE:FREQ=DAILY", weekly: "RRULE:FREQ=WEEKLY", monthly: "RRULE:FREQ=MONTHLY" };
// When a recurring task is completed, spawn its next (not-done) occurrence.
function nextOccurrence(task) {
  return { ...task, id: Date.now() + Math.floor(Math.random() * 1000), done: false, doneAt: null, addedAt: new Date().toISOString() };
}

// ─── Classification: reflex / standard / heavy ───────────────────────────────
// est_minutes / cognitive_load / ai_delegatable / multi_step come free from the
// Brain Dump call; for manual or pre-classification tasks we derive them so every
// task still gets a tier with no extra input.
const EST_BY_EFFORT = [2, 15, 60, 240, 480]; // minutes, indexed by effort-1
function withClassification(t) {
  const effort = t.effort || 3;
  return {
    ...t,
    est_minutes: t.est_minutes ?? EST_BY_EFFORT[Math.min(4, Math.max(0, effort - 1))],
    cognitive_load: t.cognitive_load ?? t.energy ?? 3,
    ai_delegatable: t.ai_delegatable ?? false,
    multi_step: t.multi_step ?? effort >= 4,
  };
}
const TIER = {
  reflex:   { label: "Reflex",   icon: "⚡", color: "#6bffb3" },
  standard: { label: "Standard", icon: "◐", color: "#6b9fff" },
  heavy:    { label: "Heavy",    icon: "⬣", color: "#c47bff" },
};
function taskTier(t) {
  const load = t.cognitive_load ?? t.energy ?? 3;
  const effort = t.effort || 3;
  const multi = t.multi_step ?? effort >= 4;
  if (effort >= 4 || (load >= 4 && multi)) return "heavy";
  if (effort <= 2 && load <= 2 && !multi) return "reflex";
  return "standard";
}
const fmtDuration = (m) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}h`.replace(".0h", "h") : `${m}m`);

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// localStorage cache is namespaced per user, so signing in as someone else on the
// same browser never surfaces the previous account's tasks or API key.
const stateKey = (uid) => `brainqueue_v4_${uid || "anon"}`;
function loadState(uid) {
  try { const r = localStorage.getItem(stateKey(uid)); return r ? JSON.parse(r) : { tasks: [], apiKey: "", weights: DEFAULT_WEIGHTS }; }
  catch { return { tasks: [], apiKey: "", weights: DEFAULT_WEIGHTS }; }
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
      apiKey: current.apiKey || legacy.apiKey || "",
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
  sb.from("task_events")
    .insert({ user_id: _userId, task_id: taskId != null ? String(taskId) : null, event_type: eventType, event_at: new Date().toISOString(), context })
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
const DEFAULT_FORM = { title: "", categories: ["Work"], recurrence: "none", urgency: 3, importance: 3, effort: 3, energy: 3, pleasure: 3, notes: "" };

const glass = {
  background: "rgba(255,255,255,0.04)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
};
const glassStrong = {
  background: "rgba(255,255,255,0.07)",
  backdropFilter: "blur(40px) saturate(200%)",
  WebkitBackdropFilter: "blur(40px) saturate(200%)",
  border: "1px solid rgba(255,255,255,0.13)",
  boxShadow: "0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
};

// Mouse glow — organic morphing shape, color tied to movement speed
function MouseGlow() {
  const canvasRef = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth, h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w; canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    // State
    const pos = { x: -999, y: -999 };      // actual mouse
    const smooth = { x: -999, y: -999 };   // smoothed position for drawing
    let hue = 260;                           // current displayed hue
    let targetHue = 260;                     // hue we're drifting toward (set on move)
    let speed = 0;                           // mouse speed magnitude
    let prevX = -999, prevY = -999;

    // Blob: 8 control points around the glow, each with their own phase offset
    const N = 8;
    const phases = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2);
    const phaseOffsets = Array.from({ length: N }, () => Math.random() * Math.PI * 2);
    const ampOffsets = Array.from({ length: N }, () => Math.random() * Math.PI * 2);

    let frame = 0;

    const onMove = (e) => {
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      speed = Math.sqrt(dx * dx + dy * dy); // pixels moved this event
      prevX = e.clientX; prevY = e.clientY;
      pos.x = e.clientX; pos.y = e.clientY;
      // Color advances proportionally to speed
      targetHue = (targetHue + speed * 0.8) % 360;
    };
    window.addEventListener("mousemove", onMove);

    // Draw organic blob using canvas path with sinusoidal radii per segment
    // 5 layers: innermost 40px → outermost 200px, opacity 0.20 → 0.019 (×0.55 each step)
    const LAYERS = [
      { r: 40,  hueShift: 0,   alpha: 0.260, deform: 1.00, speed: 1.00 },
      { r: 75,  hueShift: 25,  alpha: 0.150, deform: 0.80, speed: 0.80 },
      { r: 115, hueShift: 50,  alpha: 0.085, deform: 0.60, speed: 0.60 },
      { r: 158, hueShift: 80,  alpha: 0.048, deform: 0.40, speed: 0.40 },
      { r: 200, hueShift: 115, alpha: 0.028, deform: 0.22, speed: 0.22 },
    ];

    const drawBlob = (cx, cy, layer, hueBase, frameLocal, speedLocal) => {
      const { r: baseR, hueShift, alpha, deform } = layer;
      const hue1 = (hueBase + hueShift) % 360;
      const hue2 = (hue1 + 30) % 360;

      const points = [];
      for (let i = 0; i < N; i++) {
        const angle = phases[i];
        const slowWave = Math.sin(frameLocal * 0.007 + phaseOffsets[i]) * 0.22 * deform;
        const fastWave = Math.sin(frameLocal * 0.019 + ampOffsets[i]) * 0.10 * deform;
        const speedBulge = Math.sin(phases[i] + frameLocal * 0.04) * (speedLocal * 0.4 * deform);
        const r = baseR * (1 + slowWave + fastWave) + speedBulge;
        points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
      }

      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const curr = points[i];
        const next = points[(i + 1) % N];
        const mid = { x: (curr.x + next.x) / 2, y: (curr.y + next.y) / 2 };
        if (i === 0) ctx.moveTo(mid.x, mid.y);
        else ctx.quadraticCurveTo(curr.x, curr.y, mid.x, mid.y);
      }
      const first = points[0];
      const last = points[N - 1];
      ctx.quadraticCurveTo(last.x, last.y, (last.x + first.x) / 2, (last.y + first.y) / 2);
      ctx.closePath();

      // Very wide falloff + heavy canvas blur for a true soft frontier
      ctx.save();
      ctx.filter = `blur(${Math.round(baseR * 0.95)}px)`;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.8);
      grad.addColorStop(0,    `hsla(${hue1}, 78%, 64%, ${alpha})`);
      grad.addColorStop(0.15, `hsla(${hue1}, 76%, 62%, ${alpha * 0.88})`);
      grad.addColorStop(0.35, `hsla(${hue1}, 72%, 58%, ${alpha * 0.60})`);
      grad.addColorStop(0.55, `hsla(${hue2}, 68%, 54%, ${alpha * 0.32})`);
      grad.addColorStop(0.75, `hsla(${hue2}, 64%, 50%, ${alpha * 0.12})`);
      grad.addColorStop(0.90, `hsla(${hue2}, 60%, 46%, ${alpha * 0.03})`);
      grad.addColorStop(1,    "transparent");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);

      smooth.x += (pos.x - smooth.x) * 0.12;
      smooth.y += (pos.y - smooth.y) * 0.12;

      hue += (targetHue - hue) * 0.06;
      speed *= 0.88;

      // Draw outermost first so inner layers sit on top
      for (let i = LAYERS.length - 1; i >= 0; i--) {
        drawBlob(smooth.x, smooth.y, LAYERS[i], hue, frame, speed * LAYERS[i].speed);
      }

      raf.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  // Extra CSS blur on the whole canvas melts the 5 layers into one seamless haze
  // so no individual layer edge is ever visible.
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, filter: "blur(26px)" }} />;
}

function useHover() {
  const [hovered, setHovered] = useState(false);
  return [hovered, { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }];
}

function GlassButton({ onClick, children, accent, style = {}, disabled, className, title }) {
  const [hov, hovProps] = useHover();
  const [pressed, setPressed] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled} className={className} title={title}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)}
      {...hovProps}
      style={{
        ...glass, borderRadius: "12px", padding: "0.7rem 1.2rem",
        color: accent || "#fff",
        border: `1px solid ${hov ? (accent || "rgba(255,255,255,0.3)") : "rgba(255,255,255,0.1)"}`,
        background: hov ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)",
        boxShadow: hov ? `0 0 20px ${accent ? accent + "44" : "rgba(255,255,255,0.1)"}, inset 0 1px 0 rgba(255,255,255,0.12)` : glass.boxShadow,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.82rem",
        transform: pressed ? "scale(0.97)" : hov ? "scale(1.02)" : "scale(1)",
        transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        opacity: disabled ? 0.4 : 1, ...style,
      }}>{children}</button>
  );
}

function ViewTab({ label, active, onClick }) {
  const [hov, hovProps] = useHover();
  return (
    <button onClick={onClick} {...hovProps} style={{
      padding: "0.5rem 1rem", borderRadius: "24px",
      border: active ? "1px solid rgba(232,255,90,0.5)" : "1px solid rgba(255,255,255,0.08)",
      background: active ? "rgba(232,255,90,0.15)" : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
      color: active ? "#e8ff5a" : hov ? "#ddd" : "#666",
      fontFamily: "'Syne', sans-serif", fontWeight: active ? 700 : 400, fontSize: "0.78rem",
      cursor: "pointer", whiteSpace: "nowrap",
      boxShadow: active ? "0 0 16px rgba(232,255,90,0.2), inset 0 1px 0 rgba(255,255,255,0.1)" : "none",
      transform: hov && !active ? "translateY(-1px)" : "translateY(0)",
      transition: "background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    }}>{label}</button>
  );
}

function ScoreRing({ score }) {
  const color = score >= 80 ? "#e8ff5a" : score >= 60 ? "#ffb347" : "#555";
  return (
    <div style={{
      width: "42px", height: "42px", borderRadius: "50%",
      background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      boxShadow: `0 0 12px ${color}44`,
    }}>
      <div style={{
        width: "30px", height: "30px", borderRadius: "50%",
        background: "rgba(10,10,20,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.65rem", fontWeight: 800, color, fontFamily: "'Syne', sans-serif",
      }}>{score}</div>
    </div>
  );
}

function TierBadge({ task, showEst = false }) {
  const { label, icon, color } = TIER[taskTier(task)];
  const est = task.est_minutes;
  return (
    <span title={`${label} task${est ? ` · ~${fmtDuration(est)}` : ""}${task.ai_delegatable ? " · AI can help" : ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6rem", padding: "2px 7px", borderRadius: "20px",
        background: color + "18", color, border: `1px solid ${color}30`, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
      {icon} {label}{showEst && est ? ` · ${fmtDuration(est)}` : ""}{task.ai_delegatable ? " · 🤖" : ""}
    </span>
  );
}

function TaskCard({ task, onEdit, onMarkDone, onDelete, onSchedule, weights }) {
  const [hov, hovProps] = useHover();
  const score = calcScore(task, weights);
  const accent = CAT_ACCENT(task.category);
  const glowRgb = CAT_GLOW(taskCats(task)[0] || task.category);

  return (
    <div {...hovProps} style={{
      ...glass,
      borderRadius: "16px",
      padding: "1rem 1.2rem",
      borderLeft: `2px solid ${accent}88`,
      boxShadow: hov
        ? `0 12px 40px rgba(0,0,0,0.5), 0 0 24px rgba(${glowRgb},0.12), inset 0 1px 0 rgba(255,255,255,0.1)`
        : glass.boxShadow,
      transform: hov ? "translateY(-2px)" : "translateY(0)",
      transition: "transform 0.25s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.25s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ color: "#e8e8e8", fontSize: "0.9rem", fontWeight: 600, lineHeight: 1.4 }}>{task.title}</span>
            <ScoreRing score={score} />
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            {taskCats(task).map(c => { const a = CAT_ACCENT(c); return (
              <span key={c} style={{ fontSize: "0.67rem", padding: "2px 8px", borderRadius: "20px", background: a + "18", color: a, border: `1px solid ${a}30`, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{c}</span>
            ); })}
            {task.recurrence && task.recurrence !== "none" && <span style={{ fontSize: "0.6rem", color: "#888" }} title={RECURRENCE_LABELS[task.recurrence]}>🔁</span>}
            <TierBadge task={task} showEst />
            <span style={{ fontSize: "0.67rem", color: "#555" }}>{getUrgencyLabel(task.urgency)}</span>
            <span style={{ fontSize: "0.67rem", color: "#444" }}>⚡ {EFFORT_LABELS[task.effort]}</span>
            <span style={{ fontSize: "0.67rem", color: "#444" }}>🧠 {ENERGY_LABELS[task.energy]}</span>
            {task.pleasure && <span style={{ fontSize: "0.67rem", color: "#444" }} title={`Pleasure: ${PLEASURE_LABELS[task.pleasure]}`}>{PLEASURE_LABELS[task.pleasure].split(" ")[0]}</span>}
          </div>
          {task.notes && <p style={{ fontSize: "0.74rem", color: "#4a4a4a", margin: "0.4rem 0 0", lineHeight: 1.5 }}>{task.notes}</p>}
          <p style={{ fontSize: "0.65rem", color: "#2e2e2e", margin: "0.5rem 0 0", fontFamily: "'DM Mono', monospace" }}>Added {formatDate(task.addedAt)}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flexShrink: 0 }}>
          <button onClick={() => onMarkDone(task.id)} title="Mark done"
            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: "1rem", transition: "color 0.15s, transform 0.15s" }}
            onMouseEnter={e => { e.target.style.color="#6bffb3"; e.target.style.transform="scale(1.2)"; }}
            onMouseLeave={e => { e.target.style.color="#3a3a3a"; e.target.style.transform="scale(1)"; }}>✓</button>
          <button onClick={() => onSchedule(task)} title="Add to calendar"
            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s, transform 0.15s" }}
            onMouseEnter={e => { e.target.style.color="#6b9fff"; e.target.style.transform="scale(1.2)"; }}
            onMouseLeave={e => { e.target.style.color="#3a3a3a"; e.target.style.transform="scale(1)"; }}>📅</button>
          <button onClick={() => onEdit(task)} title="Edit"
            style={{ background: "none", border: "none", color: "#3a3a3a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#aaa"} onMouseLeave={e => e.target.style.color="#3a3a3a"}>✏️</button>
          <button onClick={() => onDelete(task.id)} title="Delete"
            style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ef4444"} onMouseLeave={e => e.target.style.color="#2a2a2a"}>🗑</button>
        </div>
      </div>
    </div>
  );
}

function DoneCard({ task, onDelete, onRestore }) {
  const [hov, hovProps] = useHover();
  const accent = CAT_ACCENT(task.category);
  return (
    <div {...hovProps} style={{
      ...glass, borderRadius: "16px", padding: "0.9rem 1.2rem",
      opacity: hov ? 0.9 : 0.55,
      borderLeft: `2px solid ${accent}33`,
      transition: "opacity 0.2s ease, transform 0.2s ease",
      transform: hov ? "translateY(-1px)" : "translateY(0)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
            <span style={{ color: "#555", fontSize: "0.88rem", fontWeight: 600, textDecoration: "line-through", lineHeight: 1.4 }}>{task.title}</span>
            <span style={{ fontSize: "0.67rem", padding: "2px 8px", borderRadius: "20px", background: accent + "10", color: accent + "99", border: `1px solid ${accent}20`, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{task.category}</span>
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
            <p style={{ fontSize: "0.64rem", color: "#2e2e2e", fontFamily: "'DM Mono', monospace" }}>Added {formatDate(task.addedAt)}</p>
            <p style={{ fontSize: "0.64rem", color: "#3a3a3a", fontFamily: "'DM Mono', monospace" }}>✓ Done {formatDate(task.doneAt)}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flexShrink: 0 }}>
          <button onClick={() => onRestore(task.id)} title="Restore"
            style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ffb347"} onMouseLeave={e => e.target.style.color="#2a2a2a"}>↩</button>
          <button onClick={() => onDelete(task.id)} title="Delete forever"
            style={{ background: "none", border: "none", color: "#1e1e1e", cursor: "pointer", fontSize: "0.8rem", transition: "color 0.15s" }}
            onMouseEnter={e => e.target.style.color="#ef4444"} onMouseLeave={e => e.target.style.color="#1e1e1e"}>🗑</button>
        </div>
      </div>
    </div>
  );
}

function GlassSlider({ label, value, onChange, sublabels }) {
  return (
    <div style={{ marginBottom: "1.3rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <label style={{ fontSize: "0.75rem", color: "#666", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</label>
        <span style={{ fontSize: "0.78rem", color: "#e8ff5a", fontWeight: 700 }}>{sublabels[value]}</span>
      </div>
      <input type="range" min={1} max={5} value={value} onChange={e => onChange(+e.target.value)} style={{ width: "100%" }} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.2rem" }}>
        <span style={{ fontSize: "0.62rem", color: "#333" }}>{sublabels[1]}</span>
        <span style={{ fontSize: "0.62rem", color: "#333" }}>{sublabels[5]}</span>
      </div>
    </div>
  );
}

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

function TaskModal({ task, onClose, onSave, customCategories = [], onAddCategory }) {
  const [form, setForm] = useState(() => task ? { recurrence: "none", ...task, categories: taskCats(task) } : DEFAULT_FORM);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [newCat, setNewCat] = useState("");
  const toggleCat = (c) => setForm(f => {
    const has = f.categories.includes(c);
    return { ...f, categories: has ? f.categories.filter(x => x !== c) : [...f.categories, c] };
  });
  const addCustom = () => {
    const c = newCat.trim();
    if (!c) return;
    onAddCategory?.(c);
    setForm(f => ({ ...f, categories: f.categories.includes(c) ? f.categories : [...f.categories, c] }));
    setNewCat("");
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.2rem", color: "#fff", margin: 0 }}>{task ? "Edit task" : "New task"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Task title…"
          style={{ width: "100%", ...glass, borderRadius: "10px", padding: "0.85rem 1rem", color: "#e8e8e8", fontSize: "0.9rem", fontFamily: "'DM Mono', monospace", marginBottom: "0.7rem", outline: "none", boxSizing: "border-box" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.2rem" }}>
          <TierBadge task={form} showEst />
          <span style={{ fontSize: "0.66rem", color: "#444" }}>auto-classified from effort & energy</span>
        </div>
        <div style={{ marginBottom: "1.3rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#666", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>Categories <span style={{ textTransform: "none", color: "#444" }}>· pick one or more</span></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {allCategories(customCategories).map(c => {
              const acc = CAT_ACCENT(c); const active = form.categories.includes(c);
              return (
                <button key={c} onClick={() => toggleCat(c)} style={{
                  padding: "0.3rem 0.8rem", borderRadius: "20px",
                  border: `1px solid ${active ? acc + "80" : "rgba(255,255,255,0.08)"}`,
                  background: active ? acc + "18" : "rgba(255,255,255,0.03)",
                  color: active ? acc : "#444", fontSize: "0.75rem", cursor: "pointer",
                  fontFamily: "'Syne', sans-serif", fontWeight: 600,
                  boxShadow: active ? `0 0 10px ${acc}33` : "none",
                  transition: "background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s",
                }}>{active ? "✓ " : ""}{c}</button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
            <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
              placeholder="+ new category…" maxLength={20}
              style={{ flex: 1, ...glass, borderRadius: "10px", padding: "0.5rem 0.75rem", color: "#e8e8e8", fontSize: "0.78rem", fontFamily: "'DM Mono', monospace", outline: "none", boxSizing: "border-box" }} />
            <GlassButton onClick={addCustom} style={{ padding: "0.5rem 0.9rem", fontSize: "0.75rem" }}>Add</GlassButton>
          </div>
        </div>
        <div style={{ marginBottom: "1.3rem" }}>
          <label style={{ fontSize: "0.75rem", color: "#666", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>Repeat</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {Object.entries(RECURRENCE_LABELS).map(([k, label]) => {
              const active = (form.recurrence || "none") === k;
              return (
                <button key={k} onClick={() => set("recurrence", k)} style={{
                  padding: "0.3rem 0.8rem", borderRadius: "20px",
                  border: `1px solid ${active ? "rgba(232,255,90,0.6)" : "rgba(255,255,255,0.08)"}`,
                  background: active ? "rgba(232,255,90,0.14)" : "rgba(255,255,255,0.03)",
                  color: active ? "#e8ff5a" : "#444", fontSize: "0.75rem", cursor: "pointer",
                  fontFamily: "'Syne', sans-serif", fontWeight: 600, transition: "all 0.15s",
                }}>{label}</button>
              );
            })}
          </div>
        </div>
        <GlassSlider label="Urgency" value={form.urgency} onChange={v => set("urgency", v)} sublabels={{ 1: "Someday", 2: "Eventually", 3: "This month", 4: "This week", 5: "TODAY" }} />
        <GlassSlider label="Importance" value={form.importance} onChange={v => set("importance", v)} sublabels={{ 1: "Nice to have", 2: "Low", 3: "Medium", 4: "High", 5: "Critical" }} />
        <GlassSlider label="Effort" value={form.effort} onChange={v => set("effort", v)} sublabels={EFFORT_LABELS} />
        <GlassSlider label="Energy needed" value={form.energy} onChange={v => set("energy", v)} sublabels={ENERGY_LABELS} />
        <GlassSlider label="Pleasure" value={form.pleasure ?? 3} onChange={v => set("pleasure", v)} sublabels={PLEASURE_LABELS} />
        <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notes…"
          style={{ width: "100%", ...glass, borderRadius: "10px", padding: "0.75rem 1rem", color: "#888", fontSize: "0.82rem", fontFamily: "'DM Mono', monospace", resize: "none", height: "64px", outline: "none", marginBottom: "1.2rem", boxSizing: "border-box" }} />
        <GlassButton onClick={() => { if (form.title.trim() && form.categories.length) onSave({ ...form, category: form.categories[0], id: task?.id || Date.now(), done: task?.done || false, addedAt: task?.addedAt || new Date().toISOString(), doneAt: task?.doneAt || null }); }} accent="#e8ff5a" style={{ width: "100%", padding: "0.9rem", fontSize: "0.9rem" }}>
          Save task →
        </GlassButton>
      </div>
    </div>
  );
}

// Compact −/value/+ stepper for tweaking a 1-5 score inline before adding.
function Dim({ label, value, onChange }) {
  const step = (d) => onChange(Math.min(5, Math.max(1, value + d)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.62rem", color: "#555", fontFamily: "'Syne', sans-serif", width: "14px" }}>{label}</span>
      <button onClick={() => step(-1)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: "0 2px" }}>−</button>
      <span style={{ fontSize: "0.7rem", color: "#aaa", width: "10px", textAlign: "center" }}>{value}</span>
      <button onClick={() => step(1)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.85rem", lineHeight: 1, padding: "0 2px" }}>+</button>
    </div>
  );
}

function BrainDumpModal({ onClose, onTasksAdded, apiKey, weights }) {
  const [dump, setDump] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);

  const parseDump = async () => {
    if (!dump.trim()) return;
    if (!apiKey.trim()) { setError("No API key — add one in Settings (⚙️) first."); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey.trim(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: BRAIN_DUMP_MODEL,
          max_tokens: BRAIN_DUMP_MAX_TOKENS,
          system: BRAIN_DUMP_SYSTEM,
          // Structured outputs: the model is constrained to this schema, so the
          // response text is guaranteed-valid JSON — no markdown fences, no
          // regex scraping, no truncation surprises.
          output_config: { format: { type: "json_schema", schema: TASK_LIST_SCHEMA } },
          messages: [{ role: "user", content: dump }],
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
      setParsed(tasks);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const updateTask = (i, patch) => setParsed(p => p.map((t, j) => j === i ? { ...t, ...patch } : t));
  const removeTask = (i) => setParsed(p => p.filter((_, j) => j !== i));

  const confirmAdd = () => {
    const now = new Date().toISOString();
    onTasksAdded(parsed.map((t, i) => ({ ...t, id: Date.now() + i, done: false, addedAt: now, doneAt: null })));
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

function WeightSlider({ label, value, onChange, description }) {
  return (
    <div style={{ marginBottom: "1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <div>
          <span style={{ fontSize: "0.78rem", color: "#aaa", fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: "0.68rem", color: "#444", marginLeft: "0.5rem" }}>{description}</span>
        </div>
        <span style={{ fontSize: "0.8rem", color: "#e8ff5a", fontWeight: 700, fontFamily: "'Syne', sans-serif", minWidth: "32px", textAlign: "right" }}>{value}</span>
      </div>
      <input type="range" min={0} max={100} step={5} value={value} onChange={e => onChange(+e.target.value)}
        style={{ width: "100%" }} />
    </div>
  );
}

function SettingsModal({ apiKey, weights, onSave, onClose }) {
  const [key, setKey] = useState(apiKey);
  const [w, setW] = useState({ ...DEFAULT_WEIGHTS, ...(weights || {}) });
  const setWField = (k, v) => setW(prev => ({ ...prev, [k]: v }));
  const total = w.urgency + w.importance + w.effort + w.energy + (w.pleasure ?? 0);
  const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.2rem", color: "#fff", margin: 0 }}>Settings</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>

        <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: "0.5rem" }}>Anthropic API Key</label>
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-..."
          style={{ width: "100%", ...glass, borderRadius: "10px", padding: "0.85rem 1rem", color: "#e8e8e8", fontSize: "0.87rem", fontFamily: "'DM Mono', monospace", marginBottom: "0.5rem", outline: "none", boxSizing: "border-box" }} />
        <p style={{ color: "#3a3a3a", fontSize: "0.72rem", marginBottom: "1.8rem", lineHeight: 1.6 }}>
          Get your key at <span style={{ color: "#6b9fff" }}>console.anthropic.com</span>. Only used for Brain Dump.
        </p>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "1.5rem", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem" }}>
            <label style={{ fontSize: "0.75rem", color: "#555", fontFamily: "'Syne', sans-serif", textTransform: "uppercase", letterSpacing: "0.07em" }}>Score Weights</label>
            <span style={{ fontSize: "0.68rem", color: total === 100 ? "#6bffb3" : "#ffb347" }}>
              total: {total} {total !== 100 ? "(normalised)" : ""}
            </span>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#333", marginBottom: "1.2rem", lineHeight: 1.6 }}>
            Controls what makes a task rise to the top in 🔥 Do Now. Higher weight = more influence on score.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.4rem", marginBottom: "1.2rem" }}>
            {[["Urgency", w.urgency], ["Importance", w.importance], ["Quick win", w.effort], ["Low energy", w.energy], ["Pleasure", w.pleasure ?? 0]].map(([l, v]) => (
              <div key={l} style={{ ...glass, borderRadius: "10px", padding: "0.6rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.62rem", color: "#444", fontFamily: "'Syne', sans-serif", marginBottom: "0.2rem" }}>{l}</div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#e8ff5a", fontFamily: "'Syne', sans-serif" }}>{pct(v)}%</div>
              </div>
            ))}
          </div>
          <WeightSlider label="Urgency" value={w.urgency} onChange={v => setWField("urgency", v)} description="deadline proximity" />
          <WeightSlider label="Importance" value={w.importance} onChange={v => setWField("importance", v)} description="impact if done" />
          <WeightSlider label="Effort (Quick Win)" value={w.effort} onChange={v => setWField("effort", v)} description="rewards fast tasks" />
          <WeightSlider label="Energy (Low cost)" value={w.energy} onChange={v => setWField("energy", v)} description="rewards easy brain tasks" />
          <WeightSlider label="Pleasure" value={w.pleasure ?? 0} onChange={v => setWField("pleasure", v)} description="rewards tasks you enjoy" />
          <button onClick={() => setW(DEFAULT_WEIGHTS)} style={{
            background: "none", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
            color: "#444", fontSize: "0.72rem", cursor: "pointer", padding: "0.4rem 0.8rem",
            fontFamily: "'Syne', sans-serif", marginBottom: "1.2rem", transition: "color 0.15s",
          }}
            onMouseEnter={e => e.target.style.color="#aaa"} onMouseLeave={e => e.target.style.color="#444"}>
            Reset to defaults
          </button>
        </div>

        <GlassButton onClick={() => { onSave(key, w); onClose(); }} accent="#e8ff5a" style={{ width: "100%", padding: "0.9rem" }}>Save →</GlassButton>
      </div>
    </div>
  );
}

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
function XPBar({ tasks }) {
  const xp = totalXP(tasks);
  const { level, into, need, pct, title } = levelInfo(xp);
  return (
    <div style={{ ...glass, borderRadius: "14px", padding: "0.85rem 0.9rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "0.85rem", color: "#e8ff5a", textShadow: "0 0 14px rgba(232,255,90,0.4)" }}>LV {level}</span>
        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.66rem", color: "#888" }}>{title}</span>
      </div>
      <div style={{ height: "8px", borderRadius: "20px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}
        title={`${xp} XP · ${into}/${need} to LV ${level + 1}`}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "20px", background: "linear-gradient(90deg,#e8ff5a,#6bffb3)", boxShadow: "0 0 12px rgba(232,255,90,0.5)", transition: "width 0.5s cubic-bezier(0.34,1.3,0.64,1)" }} />
      </div>
    </div>
  );
}

function MiniBars({ data, accent = "#e8ff5a", height = 70, showValues = true }) {
  const max = Math.max(1, ...data.map(d => d.count));
  const [hi, setHi] = useState(null);
  const h = hi != null ? data[hi] : null;
  // Plot area and label row are siblings, so each bar's % height resolves cleanly
  // against the fixed-height plot (no flex-shrink squashing them to equal sizes).
  return (
    <div style={{ position: "relative", marginTop: "0.6rem" }}>
      {/* Floating tooltip with the hovered bar's details. */}
      {h && (
        <div style={{ position: "absolute", bottom: "100%", left: `${((hi + 0.5) / data.length) * 100}%`, transform: "translate(-50%, -6px)",
          ...glassStrong, borderRadius: "10px", padding: "0.45rem 0.65rem", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5,
          border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.68rem", color: "#fff" }}>{h.full || h.label}</div>
          <div style={{ fontSize: "0.66rem", color: "#bbb", marginTop: "0.1rem" }}>
            <b style={{ color: "#e8ff5a" }}>{h.count}</b> task{h.count === 1 ? "" : "s"} · <b style={{ color: "#6bffb3" }}>{h.xp}</b> XP
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.25rem", height: `${height}px` }}>
        {data.map((d, i) => (
          <div key={i} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(p => (p === i ? null : p))}
            style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center", cursor: "default" }}>
            <div style={{ width: "100%", height: `${(d.count / max) * 100}%`, minHeight: d.count ? "4px" : "2px",
              background: d.count ? (hi === i ? "#fff" : accent) : "rgba(255,255,255,0.07)", borderRadius: "4px 4px 2px 2px",
              boxShadow: d.count && hi === i ? `0 0 14px ${accent}` : d.count ? `0 0 8px ${accent}55` : "none",
              transition: "height 0.45s cubic-bezier(0.34,1.3,0.64,1), background 0.15s, box-shadow 0.15s",
              display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              {showValues && d.count > 0 && <span style={{ fontSize: "0.5rem", color: hi === i ? "#000" : "#0a0a0f", fontWeight: 700, marginTop: "-0.85rem" }}>{d.count}</span>}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.25rem" }}>
        {data.map((d, i) => (
          <span key={i} style={{ flex: 1, textAlign: "center", fontSize: "0.5rem", color: hi === i ? "#e8ff5a" : "#555", whiteSpace: "nowrap", overflow: "hidden" }}>
            {data.length > 14 && (i % 5 !== 0) ? "" : d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SideSection({ title, children, action }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.55rem" }}>
        <h4 style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.66rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#666", fontWeight: 700 }}>{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

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
function Donut({ donePct }) {
  return (
    <div style={{ width: "128px", height: "128px", borderRadius: "50%", position: "relative", flexShrink: 0,
      background: `conic-gradient(#6bffb3 ${donePct * 3.6}deg, rgba(255,107,107,0.65) 0)`, boxShadow: "0 0 26px rgba(107,255,179,0.22)" }}>
      <div style={{ position: "absolute", inset: "16px", borderRadius: "50%", background: "#0b0b14", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#6bffb3" }}>{donePct}%</div>
          <div style={{ fontSize: "0.58rem", color: "#777" }}>done</div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...glass, borderRadius: "14px", padding: "0.75rem 0.85rem", flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.35rem", color: accent || "#e8e8e8", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.6rem", color: "#777", marginTop: "0.25rem" }}>{label}</div>
    </div>
  );
}

function AnalyticsModal({ tasks, customCategories, onClose }) {
  const [period, setPeriod] = useState("week");
  const active = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const total = tasks.length;
  const donePct = total ? Math.round((done.length / total) * 100) : 0;
  const series = doneSeries(tasks, period);
  const periodCount = series.reduce((s, b) => s + b.count, 0);
  const lvl = levelInfo(totalXP(tasks));
  const cats = allCategories(customCategories).filter(c => tasks.some(t => taskCats(t).includes(c)));
  const pVals = tasks.map(t => t.pleasure).filter(Boolean);
  const avgP = pVals.length ? pVals.reduce((a, b) => a + b, 0) / pVals.length : 0;
  const pEmoji = ["—", "😣", "😕", "😐", "🙂", "😍"][Math.round(avgP)] || "—";

  const Section = ({ title, action, children }) => (
    <div style={{ marginTop: "1.4rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.78rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#888", fontWeight: 700 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 120, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "1.5rem 1rem", backdropFilter: "blur(8px)", overflow: "auto" }}>
      <div onClick={e => e.stopPropagation()} style={{ ...glassStrong, borderRadius: "22px", width: "100%", maxWidth: "660px", padding: "1.8rem", margin: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.3rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.3rem", color: "#fff", margin: 0 }}>📊 Analytics</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "0.6rem" }}>
          <StatCard label="Active tasks" value={active.length} accent="#e8ff5a" />
          <StatCard label="Completed" value={done.length} accent="#6bffb3" />
          <StatCard label={`Level · ${lvl.title}`} value={lvl.level} accent="#e8ff5a" />
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <StatCard label="Done today" value={todayScore(tasks)} accent="#6b9fff" />
          <StatCard label="Done this week" value={weekScore(tasks)} accent="#6b9fff" />
          <StatCard label="Avg pleasure" value={pEmoji} accent="#ff8fd0" />
        </div>

        <Section title="Done vs. to-do">
          <div style={{ display: "flex", alignItems: "center", gap: "1.4rem" }}>
            <Donut donePct={donePct} />
            <div style={{ fontSize: "0.82rem", lineHeight: 2 }}>
              <div><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: "#6bffb3", marginRight: "0.5rem" }} />{done.length} completed</div>
              <div><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: "rgba(255,107,107,0.8)", marginRight: "0.5rem" }} />{active.length} still to do</div>
            </div>
          </div>
        </Section>

        <Section title="Completion by category">
          {cats.length === 0 ? <p style={{ color: "#555", fontSize: "0.8rem" }}>No tasks yet.</p> : cats.map(c => {
            const inCat = tasks.filter(t => taskCats(t).includes(c));
            const d = inCat.filter(t => t.done).length;
            const pct = Math.round((d / inCat.length) * 100);
            const acc = CAT_ACCENT(c);
            return (
              <div key={c} style={{ marginBottom: "0.65rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "0.25rem" }}>
                  <span style={{ color: acc, fontFamily: "'Syne', sans-serif", fontWeight: 600 }}>{c}</span>
                  <span style={{ color: "#777" }}>{d}/{inCat.length} · {pct}%</span>
                </div>
                <div style={{ height: "7px", borderRadius: "20px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: acc, borderRadius: "20px", boxShadow: `0 0 8px ${acc}66`, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </Section>

        <Section title="Completed over time" action={
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {[["week", "This week"], ["month", "This month"]].map(([p, label]) => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "0.25rem 0.7rem", borderRadius: "20px", cursor: "pointer", fontSize: "0.68rem",
                fontFamily: "'Syne', sans-serif", fontWeight: 700,
                border: `1px solid ${period === p ? "rgba(232,255,90,0.6)" : "rgba(255,255,255,0.1)"}`,
                background: period === p ? "rgba(232,255,90,0.14)" : "transparent",
                color: period === p ? "#e8ff5a" : "#777",
              }}>{label}</button>
            ))}
          </div>
        }>
          <div style={{ ...glass, borderRadius: "14px", padding: "0.9rem 1rem" }}>
            <MiniBars data={series} height={96} />
            <p style={{ fontSize: "0.72rem", color: "#888", marginTop: "0.6rem", textAlign: "center" }}>
              <b style={{ color: "#e8ff5a" }}>{periodCount}</b> task{periodCount === 1 ? "" : "s"} completed {period === "week" ? "this week" : "this month"} · score {periodCount}
            </p>
          </div>
        </Section>
      </div>
    </div>
  );
}

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

function FocusRing({ pct, color, big, sub }) {
  return (
    <div style={{ width: "min(72vw, 300px)", height: "min(72vw, 300px)", borderRadius: "50%", position: "relative",
      background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.05) 0)`, boxShadow: `0 0 70px ${color}33`, transition: "background 0.9s linear" }}>
      <div style={{ position: "absolute", inset: "14px", borderRadius: "50%", background: "#060610", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(2.4rem, 9vw, 3.4rem)", color, letterSpacing: "-0.02em" }}>{big}</div>
          {sub && <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.2rem" }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// Ready-made task sets so the user picks a focus in one tap instead of curating.
// `tasks` arrives already active + score-sorted, so "Do Now" is just the top slice.
function buildProposals(tasks) {
  const defs = [
    { id: "donow", icon: "🔥", name: "Do Now", desc: "Top priority right now", pick: ts => ts.slice(0, 4) },
    { id: "quick", icon: "⚡", name: "Quick Wins", desc: "Fast, low-effort momentum", pick: ts => ts.filter(t => t.effort <= 2).slice(0, 5) },
    { id: "deep", icon: "⬣", name: "Deep Work", desc: "Heavy focus, few tasks", pick: ts => ts.filter(t => taskTier(t) === "heavy").slice(0, 3) },
    { id: "easy", icon: "🧠", name: "Low Energy", desc: "Gentle on the brain", pick: ts => ts.filter(t => (t.cognitive_load ?? t.energy ?? 3) <= 2).slice(0, 4) },
  ];
  return defs.map(d => ({ ...d, items: d.pick(tasks) })).filter(d => d.items.length);
}

function SessionStepper({ label, value, set, min, max }) {
  return (
    <div style={{ ...glass, borderRadius: "12px", padding: "0.7rem 0.9rem", flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: "0.62rem", color: "#666", fontFamily: "'Syne', sans-serif", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}>
        <button onClick={() => set(Math.max(min, value - 5))} style={{ background: "none", border: "none", color: "#666", fontSize: "1.1rem", cursor: "pointer" }}>−</button>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.2rem", color: "#e8ff5a", width: "44px" }}>{value}<span style={{ fontSize: "0.7rem", color: "#555" }}>m</span></span>
        <button onClick={() => set(Math.min(max, value + 5))} style={{ background: "none", border: "none", color: "#666", fontSize: "1.1rem", cursor: "pointer" }}>+</button>
      </div>
    </div>
  );
}

function SessionSetupModal({ tasks, onStart, onClose }) {
  const proposals = buildProposals(tasks);
  const [mode, setMode] = useState("sets");           // sets | edit
  const [picked, setPicked] = useState(() => proposals[0]?.id || null);
  const [selectedIds, setSelectedIds] = useState(() => new Set((proposals[0]?.items || []).map(t => t.id)));
  const [work, setWork] = useState(25);
  const [brk, setBrk] = useState(5);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");

  const selectProposal = (p) => { setPicked(p.id); setSelectedIds(new Set(p.items.map(t => t.id))); };
  const toggle = (id) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedTasks = tasks.filter(t => selectedIds.has(t.id));
  const totalMin = selectedTasks.reduce((s, t) => s + (t.est_minutes || 25), 0);
  const cats = ["All", ...new Set(tasks.flatMap(taskCats))];
  const visible = tasks.filter(t =>
    (catFilter === "All" || taskCats(t).includes(catFilter)) &&
    (!search.trim() || t.title.toLowerCase().includes(search.toLowerCase())));
  const start = () => { const ids = [...selectedIds]; if (ids.length) onStart({ taskIds: ids, work, brk }); };

  const taskRow = (t) => {
    const on = selectedIds.has(t.id);
    return (
      <button key={t.id} onClick={() => toggle(t.id)} style={{
        ...glass, borderRadius: "10px", padding: "0.6rem 0.8rem", display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", textAlign: "left", width: "100%",
        border: `1px solid ${on ? "rgba(232,255,90,0.5)" : "rgba(255,255,255,0.07)"}`, background: on ? "rgba(232,255,90,0.1)" : "rgba(255,255,255,0.03)",
      }}>
        <span style={{ color: on ? "#e8ff5a" : "#444", fontSize: "0.95rem" }}>{on ? "✓" : "○"}</span>
        <span style={{ flex: 1, minWidth: 0, color: "#ddd", fontSize: "0.85rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
        <TierBadge task={t} showEst />
      </button>
    );
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem 1rem", backdropFilter: "blur(8px)" }}>
      <div onClick={e => e.stopPropagation()} style={{ ...glassStrong, borderRadius: "24px", width: "100%", maxWidth: "680px", maxHeight: "90vh", overflow: "auto", padding: "2.2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.5rem", color: "#fff", margin: 0 }}>▶ Start a focus session</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.6rem", cursor: "pointer" }}>×</button>
        </div>

        {tasks.length === 0 ? (
          <p style={{ color: "#666", fontSize: "0.9rem", padding: "2rem 0", textAlign: "center" }}>No active tasks yet — add some first.</p>
        ) : mode === "sets" ? (
          <>
            <p style={{ color: "#777", fontSize: "0.86rem", margin: "0.3rem 0 1.4rem" }}>Pick a set and go — tweak it only if you want to.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.7rem", marginBottom: "1.6rem" }}>
              {proposals.map(p => {
                const on = picked === p.id;
                const mins = p.items.reduce((s, t) => s + (t.est_minutes || 25), 0);
                return (
                  <button key={p.id} onClick={() => selectProposal(p)} style={{
                    ...glass, borderRadius: "16px", padding: "1rem 1.1rem", cursor: "pointer", textAlign: "left",
                    border: `1px solid ${on ? "rgba(232,255,90,0.55)" : "rgba(255,255,255,0.08)"}`,
                    background: on ? "rgba(232,255,90,0.09)" : "rgba(255,255,255,0.03)",
                    boxShadow: on ? "0 0 22px rgba(232,255,90,0.12)" : "none", transition: "all 0.18s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "1.05rem", color: on ? "#e8ff5a" : "#eee" }}>{p.icon} {p.name}</span>
                      {on && <span style={{ color: "#e8ff5a", fontSize: "0.9rem" }}>✓</span>}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#888", marginTop: "0.25rem" }}>{p.desc}</div>
                    <div style={{ fontSize: "0.68rem", color: "#555", marginTop: "0.6rem" }}>{p.items.length} task{p.items.length === 1 ? "" : "s"} · ~{fmtDuration(mins)}</div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "0.74rem", color: "#888", fontFamily: "'Syne', sans-serif" }}>
                {selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"} selected · ~{fmtDuration(totalMin)}
              </span>
              <button onClick={() => setMode("edit")} style={{ ...glass, borderRadius: "20px", padding: "0.35rem 0.9rem", color: "#6b9fff", cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.74rem", border: "1px solid rgba(107,159,255,0.3)" }}>✎ Modify set</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.5rem", maxHeight: "180px", overflow: "auto" }}>
              {selectedTasks.length === 0 ? <p style={{ color: "#555", fontSize: "0.8rem" }}>Nothing selected — pick a set or modify.</p> : selectedTasks.map(taskRow)}
            </div>

            <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem" }}>
              <SessionStepper label="Focus" value={work} set={setWork} min={5} max={90} />
              <SessionStepper label="Break" value={brk} set={setBrk} min={5} max={30} />
            </div>
            <GlassButton onClick={start} disabled={!selectedTasks.length} accent="#e8ff5a" style={{ width: "100%", padding: "1rem", fontSize: "0.95rem" }}>Enter focus →</GlassButton>
          </>
        ) : (
          <>
            <p style={{ color: "#777", fontSize: "0.86rem", margin: "0.3rem 0 1rem" }}>Search or filter by category, then tap tasks to add or remove.</p>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…" autoFocus
              style={{ width: "100%", ...glass, borderRadius: "12px", padding: "0.8rem 1rem", color: "#e8e8e8", fontSize: "0.88rem", fontFamily: "'DM Mono', monospace", outline: "none", boxSizing: "border-box", marginBottom: "0.8rem" }} />
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" }}>
              {cats.map(c => {
                const acc = c === "All" ? "#e8ff5a" : CAT_ACCENT(c); const on = catFilter === c;
                return (
                  <button key={c} onClick={() => setCatFilter(c)} style={{
                    padding: "0.28rem 0.75rem", borderRadius: "20px", cursor: "pointer", fontSize: "0.72rem", fontFamily: "'Syne', sans-serif", fontWeight: 600,
                    border: `1px solid ${on ? acc + "70" : "rgba(255,255,255,0.07)"}`, background: on ? acc + "16" : "transparent", color: on ? acc : "#555",
                  }}>{c}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "1.3rem", maxHeight: "300px", overflow: "auto" }}>
              {visible.length === 0 ? <p style={{ color: "#555", fontSize: "0.8rem" }}>No matching tasks.</p> : visible.map(taskRow)}
            </div>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <span style={{ flex: 1, fontSize: "0.74rem", color: "#888", fontFamily: "'Syne', sans-serif" }}>{selectedTasks.length} selected · ~{fmtDuration(totalMin)}</span>
              <GlassButton onClick={() => { setPicked(null); setMode("sets"); }} accent="#e8ff5a" style={{ padding: "0.7rem 1.6rem" }}>Done →</GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

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
      setPhase("break"); setSecondsLeft(session.brk * 60);
    } else {
      chime(880); notify("Back to focus", "Next round — let's go.");
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

  // WORK / BREAK
  const isBreak = phase === "break";
  const total = isBreak ? session.brk * 60 : session.work * 60;
  const pct = total ? ((total - secondsLeft) / total) * 100 : 0;
  const accent = isBreak ? "#6b9fff" : "#e8ff5a";
  return (
    <div style={shell}>
      <button onClick={finish} title="End session"
        style={{ position: "absolute", top: "1.2rem", right: "1.4rem", background: "none", border: "none", color: "#555", fontSize: "1.6rem", cursor: "pointer" }}>×</button>

      <p style={{ fontFamily: "'Syne', sans-serif", color: accent, letterSpacing: "0.3em", textTransform: "uppercase", fontSize: "0.72rem", marginBottom: "0.4rem" }}>
        {isBreak ? "Breathe" : "Focus"}{pomos > 0 ? ` · ${pomos} done` : ""}
      </p>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(1.3rem, 4vw, 2rem)", color: "#fff", margin: "0 0 1.4rem", maxWidth: "640px", lineHeight: 1.25 }}>
        {isBreak ? "Look away from the screen." : (current ? current.title : "All tasks done — wrap up.")}
      </h1>

      <FocusRing pct={pct} color={accent} big={mmss(secondsLeft)} sub={isBreak ? "break" : (current ? `${TIER[taskTier(current)].icon} ${TIER[taskTier(current)].label} · ~${fmtDuration(current.est_minutes || 25)}` : "")} />

      <div style={{ display: "flex", gap: "0.7rem", marginTop: "2rem", flexWrap: "wrap", justifyContent: "center" }}>
        <GlassButton onClick={() => setRunning(r => !r)} style={{ padding: "0.7rem 1.3rem" }}>{running ? "⏸ Pause" : "▶ Resume"}</GlassButton>
        {!isBreak && current && <GlassButton onClick={doneCurrent} accent="#6bffb3" style={{ padding: "0.7rem 1.3rem" }}>✓ Done</GlassButton>}
        {isBreak && <GlassButton onClick={() => { flipping.current = true; chime(880); setPhase("work"); setSecondsLeft(session.work * 60); }} style={{ padding: "0.7rem 1.3rem" }}>Skip break →</GlassButton>}
        <GlassButton onClick={finish} style={{ padding: "0.7rem 1.3rem" }}>End</GlassButton>
      </div>
      {!isBreak && <p style={{ color: "#444", fontSize: "0.74rem", marginTop: "1.2rem" }}>{completed.length} of {session.taskIds.length} done this session</p>}
    </div>
  );
}

// Inline "+ category" pill for the main category bar (Enter or + to add).
function InlineCatAdd({ onAdd }) {
  const [v, setV] = useState("");
  const add = () => { const c = v.trim(); if (c) { onAdd(c); setV(""); } };
  return (
    <span style={{ display: "inline-flex", gap: "0.25rem", alignItems: "center" }}>
      <input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }}
        placeholder="+ new category" maxLength={20}
        style={{ ...glass, borderRadius: "20px", padding: "0.26rem 0.7rem", color: "#e8e8e8", fontSize: "0.72rem", fontFamily: "'DM Mono', monospace", outline: "none", width: "130px", boxSizing: "border-box" }} />
      {v.trim() && <button onClick={add} style={{ ...glass, borderRadius: "20px", padding: "0.26rem 0.6rem", color: "#e8ff5a", cursor: "pointer", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.72rem", border: "1px solid rgba(232,255,90,0.3)" }}>Add</button>}
    </span>
  );
}

function MainApp({ session }) {
  const userId = session.user.id;
  setActiveUser(userId); // ensure row helpers stamp user_id before any task write

  const [state, setState] = useState(() => loadOrAdoptState(userId));
  const { tasks, apiKey, weights = DEFAULT_WEIGHTS, customCategories = [] } = state;
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
    classified.forEach(t => upsertTask(t));
    logEvent("braindump_added", null, { count: classified.length });
  }, [commit]);

  const startSession = useCallback(async ({ taskIds, work, brk }) => {
    setShowSessionSetup(false);
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission(); } catch { /* ignore */ }
    const id = await insertSession(taskIds);
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
        body { background: #060610; }
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
          .bq-lbl { display: none; }
          .bq-actions { gap: 0.35rem; }
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
                <GlassButton onClick={() => setShowSettings(true)} title="Settings" style={{ padding: "0.55rem 0.7rem", fontSize: "0.9rem" }}>⚙️</GlassButton>
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
            <p style={{ fontSize: "0.7rem", color: "#2e2e2e", fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em" }}>
              {viewTasks?.length} TASKS — {viewDescriptions[view].toUpperCase()}
            </p>
          </div>
        </div>

        <div style={{ padding: "0.5rem 1.5rem 5rem", maxWidth: "720px", margin: "0 auto" }}>
          {!viewTasks?.length ? (
            <div style={{ textAlign: "center", padding: "5rem 0", color: "#222" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.3 }}>
                {view === 4 ? "🏆" : "∅"}
              </div>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "0.82rem" }}>
                {view === 4 ? "No completed tasks yet" : "Nothing here yet"}
              </p>
            </div>
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

      {showSettings && <SettingsModal apiKey={apiKey} weights={weights} onSave={(k, w) => update({ apiKey: k, weights: w })} onClose={() => setShowSettings(false)} />}
      {showDump && <BrainDumpModal onClose={() => setShowDump(false)} onTasksAdded={addBulk} apiKey={apiKey} weights={weights} />}
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
function Toast({ toast, onDone }) {
  useEffect(() => { const id = setTimeout(onDone, 4500); return () => clearTimeout(id); }, [toast, onDone]);
  const ok = toast.type === "success";
  return (
    <div onClick={onDone} style={{
      position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 200,
      ...glassStrong, borderRadius: "14px", padding: "0.85rem 1.2rem", maxWidth: "90vw", cursor: "pointer",
      border: `1px solid ${ok ? "rgba(107,255,179,0.4)" : "rgba(255,107,107,0.4)"}`,
      display: "flex", alignItems: "center", gap: "0.6rem",
      animation: "fadeUp 0.3s cubic-bezier(0.34,1.2,0.64,1) both",
    }}>
      <span style={{ fontSize: "1rem" }}>{ok ? "✓" : "⚠️"}</span>
      <span style={{ fontSize: "0.8rem", color: ok ? "#cfe" : "#fcc", fontFamily: "'DM Mono', monospace" }}>{toast.msg}</span>
    </div>
  );
}

function UserChip({ session }) {
  const u = session.user;
  const avatar = u.user_metadata?.avatar_url || u.user_metadata?.picture;
  const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email || "Account";
  return (
    <div title={u.email || name} style={{
      ...glass, display: "flex", alignItems: "center", gap: "0.4rem",
      borderRadius: "20px", padding: "0.25rem 0.7rem 0.25rem 0.3rem", maxWidth: "180px",
    }}>
      {avatar
        ? <img src={avatar} alt="" referrerPolicy="no-referrer" style={{ width: "22px", height: "22px", borderRadius: "50%" }} />
        : <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(232,255,90,0.18)", color: "#e8ff5a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>{(name[0] || "?").toUpperCase()}</span>}
      <span style={{ fontSize: "0.72rem", color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </div>
  );
}

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
