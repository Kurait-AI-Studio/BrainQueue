import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { CATEGORIES } from "./brainDumpSpec";
import { GlassButton, ViewTab, TaskCard, DoneCard, MouseGlow, EmptyState, InlineCatAdd, Toast, XpBurst, SetCelebration, AppSidebar } from "./ui";
import { recordSetClear, celebrationTitle } from "./lib/rewards";
import { getSupabase, getUserId, setActiveUser, setConsentState, getConsentState, updateConsent, setActiveSessionId, setSurface, logEvent, flushOutbox, insertSession, finalizeSession, signOut } from "./lib/client";
import { ConsentNudge } from "./ui/ConsentNudge";
import { Onboarding } from "./ui/Onboarding";
import { CaptureScreen } from "./ui/CaptureScreen";
import { FocusMode } from "./ui/FocusMode";
import { BrainDumpModal } from "./ui/BrainDumpModal";
import { WeeklyReviewModal } from "./ui/WeeklyReviewModal";
import { ScheduleModal } from "./ui/ScheduleModal";
import { CAL_BACKENDS, PENDING_CAL_KEY, insertViaProvider, consentWasDenied, clearAuthParamsFromUrl } from "./lib/calendar";

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


import { CAT_ACCENT, DEFAULT_WEIGHTS, calcScore, taskCats, allCategories, URGENCY_TARGET_HRS, taskXP, nextOccurrence, withClassification, taskTier } from "./lib/tasks";
import { adaptWeights } from "./lib/adapt";
import { DEFAULT_REVIEW_TONE } from "./lib/weeklyReview";
import { humanizeError } from "./lib/errors";

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
  due_date: t.due_date || null,
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
  due_date: r.due_date ?? undefined,
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
  const row = toRow(task);
  let { error } = await sb.from("tasks").upsert(row);
  // Graceful fallback if migration 0010 (due_date column) hasn't been applied yet:
  // strip due_date and retry, so task sync never breaks on a pending migration.
  if (error && /due_date/.test(error.message || "")) {
    const { due_date, ...rest } = row; // eslint-disable-line no-unused-vars
    ({ error } = await sb.from("tasks").upsert(rest));
  }
  if (error) console.error("Supabase upsert:", error);
}

async function deleteRemoteTask(id) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("tasks").delete().eq("id", String(id));
  if (error) console.error("Supabase delete:", error);
}

// ── Capture inbox sync (best-effort; the inbox works locally if migration 0011 is pending) ──
async function fetchRemoteCaptures(userId) {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from("captures").select("*").eq("user_id", userId).eq("processed", false).order("created_at", { ascending: false });
  if (error) { console.warn("captures fetch:", error.message); return null; }
  return data.map(r => ({ id: r.id, text: r.text, createdAt: r.created_at }));
}
async function insertRemoteCapture(cap) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("captures").insert({ id: cap.id, user_id: getUserId(), text: cap.text, created_at: cap.createdAt });
  if (error) console.warn("captures insert:", error.message);
}
async function deleteRemoteCapture(id) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("captures").delete().eq("id", id);
  if (error) console.warn("captures delete:", error.message);
}
async function markRemoteCaptureProcessed(id) {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("captures").update({ processed: true, processed_at: new Date().toISOString() }).eq("id", id);
  if (error) console.warn("captures processed:", error.message);
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

export function MainApp({ session }) {
  const userId = session.user.id;
  setActiveUser(userId); // ensure row helpers stamp user_id before any task write
  // Load this user's data-use consent (defaults to "product-only" — lawful basis to
  // run BrainQueue, but NOT to train on their data). Every event is tagged with it so a
  // future learning loop can trivially filter to the consented subset (principle 6).
  try { setConsentState(localStorage.getItem(`bq_consent_${userId}`) || "product-only"); } catch { /* default stands */ }

  // React mirror of the consent flag, so the nudge re-renders when it changes.
  const [consentState, setConsentLocal] = useState(() => {
    try { return localStorage.getItem(`bq_consent_${userId}`) || "product-only"; } catch { return "product-only"; }
  });
  const [nudgeHidden, setNudgeHidden] = useState(false); // dismiss for this session only
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem(`bq_onboarded_${userId}`); } catch { return false; }
  });
  const [showCapture, setShowCapture] = useState(false);
  const [dumpSeed, setDumpSeed] = useState("");          // pre-fills the dump when processing a capture
  const [processingCaptureId, setProcessingCaptureId] = useState(null);

  const [state, setState] = useState(() => loadOrAdoptState(userId));
  const { tasks, weights = DEFAULT_WEIGHTS, customCategories = [], reviewTone = DEFAULT_REVIEW_TONE, captures = [] } = state;
  // Level 0 adaptation: when Memory is on, nudge the scoring weights toward what this user
  // actually completes. `weights` stays the user's explicit base (Settings); `effWeights`
  // is what ranking/scoring use. Off = generic, so the Memory promise stays honest.
  const { weights: effWeights, tuned: weightsTuned } = useMemo(
    () => (consentState === "full" ? adaptWeights(tasks, weights) : { weights, tuned: false }),
    [consentState, tasks, weights]
  );
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
  // Capture inbox: raw, unprocessed notes. Persisted locally AND synced to the captures table
  // (best-effort — the inbox keeps working if migration 0011 isn't applied yet).
  const addCapture = (text) => {
    const cap = { id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()), text, createdAt: new Date().toISOString() };
    setState(s => { const n = { ...s, captures: [cap, ...(s.captures || [])] }; saveState(userId, n); return n; });
    insertRemoteCapture(cap);
    return cap;
  };
  const removeCapture = (id) => { // discard from the inbox
    setState(s => { const n = { ...s, captures: (s.captures || []).filter(c => c.id !== id) }; saveState(userId, n); return n; });
    deleteRemoteCapture(id);
  };
  const markCaptureDone = (id) => { // processed → leave the inbox, keep the row flagged processed
    setState(s => { const n = { ...s, captures: (s.captures || []).filter(c => c.id !== id) }; saveState(userId, n); return n; });
    markRemoteCaptureProcessed(id);
  };

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

    // 1b. Capture inbox: pull unprocessed captures from any device, push any local-only ones.
    fetchRemoteCaptures(userId).then(remote => {
      if (!remote) return;
      setState(s => {
        const byId = new Map((s.captures || []).map(c => [c.id, c]));
        remote.forEach(c => byId.set(c.id, c));
        const remoteIds = new Set(remote.map(c => c.id));
        (s.captures || []).forEach(c => { if (!remoteIds.has(c.id)) insertRemoteCapture(c); });
        const n = { ...s, captures: [...byId.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) };
        saveState(userId, n);
        return n;
      });
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
      .catch(e => setToast({ type: "error", msg: `Couldn't add to calendar: ${humanizeError(e, "please try again.")}` }));
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
  const sorted = [...active].sort((a, b) => calcScore(b, effWeights) - calcScore(a, effWeights));

  const viewTasks = view === 4 ? done : [
    sorted.filter(t => calcScore(t, effWeights) >= 60 || t.urgency >= 4),
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

      <AppSidebar session={session} tasks={tasks} active={showCapture ? "capture" : "tasks"} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        onAddTask={() => setShowAdd(true)} onSignOut={() => signOut()} pendingCaptures={captures.length}
        onNav={(id) => {
          if (id === "capture") setShowCapture(true);
          else if (id === "focus") setShowSessionSetup(true);
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

        {!nudgeHidden && consentState !== "full" && (
          <div style={{ padding: "0.8rem 1.5rem 0" }}>
            <div style={{ maxWidth: "720px", margin: "0 auto" }}>
              <ConsentNudge
                consent={consentState}
                onEnable={() => { updateConsent("full"); setConsentLocal("full"); setToast({ type: "success", msg: "Memory on — BrainQueue will start adapting to you ✓" }); }}
                onOpenSettings={() => setShowSettings(true)}
                onDismiss={() => setNudgeHidden(true)}
              />
            </div>
          </div>
        )}

        <div style={{ padding: "0.9rem 1.5rem 0.4rem" }}>
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>
            <p style={{ fontSize: "0.7rem", color: "#3a3a3a", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", letterSpacing: "0.06em" }}>
              <span style={{ color: "#6b6b76", fontWeight: 700 }}>{viewTasks?.length} {viewTasks?.length === 1 ? "TASK" : "TASKS"}</span> · {viewDescriptions[view].toUpperCase()}
              {weightsTuned && <span style={{ color: "#bef24a", fontWeight: 700, marginLeft: 8 }} title="Ordering is adapted to the tasks you actually complete">· TUNED TO YOU</span>}
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
                    : <TaskCard task={t} onOpen={setDetailTask} onAddToSession={addToSession} inSession={sessionDraft.includes(t.id)} onEdit={setEditTask} onMarkDone={markDone} onDelete={deleteTask} onSchedule={setScheduleTask} weights={effWeights} />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showSettings && <Suspense fallback={null}><SettingsModal weights={weights} reviewTone={reviewTone} onSave={(s) => update(s)}
        onReplayOnboarding={() => { try { localStorage.removeItem(`bq_onboarded_${userId}`); } catch { /* ignore */ } setShowSettings(false); setShowOnboarding(true); }}
        onClose={() => { setShowSettings(false); setConsentLocal(getConsentState()); }} /></Suspense>}
      {showDump && <BrainDumpModal initialDump={dumpSeed} captureId={processingCaptureId}
        onClose={() => { setShowDump(false); setDumpSeed(""); setProcessingCaptureId(null); }}
        onTasksAdded={(t) => { addBulk(t); if (processingCaptureId) markCaptureDone(processingCaptureId); }}
        weights={effWeights}
        existingCategories={[...new Set([...syncedCategories, ...tasks.flatMap(taskCats)])].filter(Boolean)}
        existingTaskTitles={tasks.filter(t => !t.done).map(t => t.title).filter(Boolean)} />}
      {showCapture && <CaptureScreen captures={captures} onCapture={addCapture} onDelete={removeCapture}
        onProcess={(cap) => { setDumpSeed(cap.text); setProcessingCaptureId(cap.id); setShowCapture(false); setShowDump(true); }}
        onClose={() => setShowCapture(false)} />}
      {(showAdd || editTask) && <Suspense fallback={null}><TaskModal task={editTask} onClose={() => { setShowAdd(false); setEditTask(null); }} onSave={saveTask} customCategories={syncedCategories} onAddCategory={addCategory} /></Suspense>}
      {scheduleTask && <ScheduleModal task={scheduleTask} session={session} onClose={() => setScheduleTask(null)} onResult={setToast} />}
      {showAnalytics && <Suspense fallback={null}><AnalyticsModal tasks={tasks} customCategories={syncedCategories} onClose={() => setShowAnalytics(false)} /></Suspense>}
      {showReview && <WeeklyReviewModal tasks={tasks} weights={effWeights} tone={reviewTone} onClose={() => setShowReview(false)}
        onView={(r) => logEvent("weekly_review_viewed", null, { week_start: r.range.start.toISOString().slice(0, 10), tone: r.tone, completed: r.stats.completed, added: r.stats.added, capture_rate: r.stats.captureRate, focus_minutes: r.stats.focusMinutes, delta: r.stats.delta, top_category: r.stats.topCategory?.cat ?? null })} />}
      {detailTask && <Suspense fallback={null}><TaskDetailModal task={tasks.find(t => t.id === detailTask.id) || detailTask} weights={effWeights} inSession={sessionDraft.includes(detailTask.id)}
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
      {showOnboarding && <Onboarding onComplete={(choice) => {
        try { localStorage.setItem(`bq_onboarded_${userId}`, "1"); } catch { /* best effort */ }
        if (choice) { updateConsent(choice); setConsentLocal(choice); }
        // Log the explicit Memory choice + whether it's on (the event envelope also carries
        // the resulting consent_state, since updateConsent ran first).
        logEvent("onboarding_completed", null, { memory: choice || "skipped", memory_on: choice === "full", consent_state: getConsentState() });
        setShowOnboarding(false);
        setShowCapture(true); // land in the Capture inbox — invite to capture, no popup
      }} />}
    </>
  );
}

// Brief auto-dismissing notice for calendar add results (and the post-redirect resume).
// Toast now lives in ./ui (imported above).

// UserChip now lives in ./ui (imported above).

