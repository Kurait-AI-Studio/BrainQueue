// ─── Task domain logic ────────────────────────────────────────────────────────
// Pure, presentation-free helpers and constants for tasks: categories, scoring,
// gamification, analytics, recurrence, and classification. Extracted from App.jsx
// so the app, the UI components, and a preview gallery all share one source.
import { CATEGORIES } from "../brainDumpSpec";

export const CATEGORY_COLORS = {
  Health: { accent: "#ff6b6b", glow: "255,107,107" },
  Work: { accent: "#6b9fff", glow: "107,159,255" },
  Admin: { accent: "#ffb347", glow: "255,179,71" },
  Social: { accent: "#6bffb3", glow: "107,255,179" },
  Finance: { accent: "#c47bff", glow: "196,123,255" },
  Learning: { accent: "#5de8ff", glow: "93,232,255" },
  Personal: { accent: "#ffaa5e", glow: "255,170,94" },
};
// Custom categories get a stable colour derived from their name (hash → palette).
export const CAT_PALETTE = ["#ff6b6b","#6b9fff","#ffb347","#6bffb3","#c47bff","#5de8ff","#ffaa5e","#e8ff5a","#ff8fd0","#7cffb2","#ff7a5c","#a78bff"];
export const hashStr = (s = "") => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
export const CAT_ACCENT = (cat) => CATEGORY_COLORS[cat]?.accent || CAT_PALETTE[hashStr(cat) % CAT_PALETTE.length];
export const hexToRgb = (hex) => { const n = parseInt(hex.replace("#", ""), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
export const CAT_GLOW = (cat) => CATEGORY_COLORS[cat]?.glow || hexToRgb(CAT_ACCENT(cat));

export const ENERGY_LABELS = { 1: "Zombie mode", 2: "Low", 3: "Normal", 4: "Focused", 5: "Peak" };
export const PLEASURE_LABELS = { 1: "😣 Dread", 2: "😕 Meh", 3: "😐 Neutral", 4: "🙂 Enjoy", 5: "😍 Love it" };
export const EFFORT_LABELS = { 1: "2 min", 2: "15 min", 3: "1 hour", 4: "Half day", 5: "Multi-day" };
export const DEFAULT_WEIGHTS = { urgency: 30, importance: 30, effort: 15, energy: 10, pleasure: 15 };

export function calcScore(task, w = DEFAULT_WEIGHTS) {
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
export function getUrgencyLabel(u) {
  if (u >= 5) return "🔴 Today"; if (u >= 4) return "🟠 This week";
  if (u >= 3) return "🟡 This month"; return "⚪ Someday";
}

// ─── Categories: multi + custom ──────────────────────────────────────────────
// A task's categories (array). Falls back to the legacy single `category` field
// so tasks created before multi-category still work.
export const taskCats = (t) => (t.categories?.length ? t.categories : (t.category ? [t.category] : []));
export const allCategories = (custom = []) => [...CATEGORIES, ...custom.filter(c => !CATEGORIES.includes(c))];

// ─── Gamification: XP + levels ───────────────────────────────────────────────
// XP rewards harder, higher-stakes tasks (urgency/importance/effort/energy) and
// gives an on-time bonus when a task is finished within the window its urgency
// implies — so "time taken" matters too.
export const URGENCY_TARGET_HRS = { 1: 336, 2: 168, 3: 72, 4: 24, 5: 8 };
export function taskXP(task) {
  const diff = (task.urgency || 0) + (task.importance || 0) + (task.effort || 0) + (task.energy || 0); // 4..20
  let xp = 10 + diff * 4;
  if (task.doneAt && task.addedAt) {
    const hrs = (new Date(task.doneAt) - new Date(task.addedAt)) / 3.6e6;
    if (hrs <= (URGENCY_TARGET_HRS[task.urgency] ?? 72)) xp += 15; // on-time bonus
  }
  return Math.round(xp);
}
export const totalXP = (tasks) => tasks.filter(t => t.done).reduce((s, t) => s + taskXP(t), 0);

// The XP curve, level titles, and bonus rewards live in ./xp (single source of truth).
export { LEVEL_TITLES, levelInfo, levelForXp, MAX_LEVEL, BONUSES, BONUS, xpToReach, levelCost } from "./xp";

// ─── Analytics: completions over time ────────────────────────────────────────
// Returns buckets [{ label, count, xp }] (oldest → newest) for the chosen period,
// derived entirely from each done task's doneAt — no extra storage needed.
export function doneSeries(tasks, period) {
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
export const countDoneBetween = (tasks, from, to) => tasks.filter(t => t.done && t.doneAt && new Date(t.doneAt) >= from && new Date(t.doneAt) < to).length;
export function todayScore(tasks) { const s = new Date(); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setDate(s.getDate() + 1); return countDoneBetween(tasks, s, e); }
export function weekScore(tasks) { const t = new Date(); t.setHours(0, 0, 0, 0); const dow = (t.getDay() + 6) % 7; const m = new Date(t); m.setDate(t.getDate() - dow); const e = new Date(m); e.setDate(m.getDate() + 7); return countDoneBetween(tasks, m, e); }

// ─── Recurrence ──────────────────────────────────────────────────────────────
export const RECURRENCE_LABELS = { none: "One-time", daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
export const RRULE = { daily: "RRULE:FREQ=DAILY", weekly: "RRULE:FREQ=WEEKLY", monthly: "RRULE:FREQ=MONTHLY" };
// When a recurring task is completed, spawn its next (not-done) occurrence.
export function nextOccurrence(task) {
  return { ...task, id: Date.now() + Math.floor(Math.random() * 1000), done: false, doneAt: null, addedAt: new Date().toISOString() };
}

// ─── Classification: reflex / standard / heavy ───────────────────────────────
// est_minutes / cognitive_load / ai_delegatable / multi_step come free from the
// Brain Dump call; for manual or pre-classification tasks we derive them so every
// task still gets a tier with no extra input.
export const EST_BY_EFFORT = [2, 15, 60, 240, 480]; // minutes, indexed by effort-1
export function withClassification(t) {
  const effort = t.effort || 3;
  return {
    ...t,
    est_minutes: t.est_minutes ?? EST_BY_EFFORT[Math.min(4, Math.max(0, effort - 1))],
    cognitive_load: t.cognitive_load ?? t.energy ?? 3,
    ai_delegatable: t.ai_delegatable ?? false,
    multi_step: t.multi_step ?? effort >= 4,
  };
}
export const TIER = {
  reflex:   { label: "Reflex",   icon: "⚡", color: "#6bffb3" },
  standard: { label: "Standard", icon: "◐", color: "#6b9fff" },
  heavy:    { label: "Heavy",    icon: "⬣", color: "#c47bff" },
};
export function taskTier(t) {
  const load = t.cognitive_load ?? t.energy ?? 3;
  const effort = t.effort || 3;
  const multi = t.multi_step ?? effort >= 4;
  if (effort >= 4 || (load >= 4 && multi)) return "heavy";
  if (effort <= 2 && load <= 2 && !multi) return "reflex";
  return "standard";
}
export const fmtDuration = (m) => (m >= 60 ? `${Math.round((m / 60) * 10) / 10}h`.replace(".0h", "h") : `${m}m`);

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Default new-task form values.
export const DEFAULT_FORM = { title: "", categories: ["Work"], recurrence: "none", urgency: 3, importance: 3, effort: 3, energy: 3, pleasure: 3, notes: "" };

// Ready-made focus-session task sets. `tasks` arrives active + score-sorted, so
// "Do Now" is just the top slice.
export function buildProposals(tasks) {
  const defs = [
    { id: "donow", icon: "🔥", name: "Do Now", desc: "Top priority right now", pick: ts => ts.slice(0, 4) },
    { id: "quick", icon: "⚡", name: "Quick Wins", desc: "Fast, low-effort momentum", pick: ts => ts.filter(t => t.effort <= 2).slice(0, 5) },
    { id: "deep", icon: "⬣", name: "Deep Work", desc: "Heavy focus, few tasks", pick: ts => ts.filter(t => taskTier(t) === "heavy").slice(0, 3) },
    { id: "easy", icon: "🧠", name: "Low Energy", desc: "Gentle on the brain", pick: ts => ts.filter(t => (t.cognitive_load ?? t.energy ?? 3) <= 2).slice(0, 4) },
  ];
  return defs.map(d => ({ ...d, items: d.pick(tasks) })).filter(d => d.items.length);
}
