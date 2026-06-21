// ─── Reward engine ───────────────────────────────────────────────────────────
// Decides which bonuses fire when a focus set is fully cleared, and tracks the
// per-day set count + daily streak in localStorage (per user). The big celebration
// is reserved for these moments — a whole set done, a 3-set combo, or a streak —
// not individual tasks, so the spike stays special.

import { BONUS } from "./xp";

const key = (uid, name) => `bq_rw_${uid || "anon"}_${name}`;
const dayKey = (d = new Date()) => {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

// Call once when a focus set is fully cleared. Returns the bonuses earned this clear,
// the day's running set count, and the current streak.
export function recordSetClear(userId, now = new Date()) {
  const today = dayKey(now);

  // Sets completed today (drives the combo bonus).
  const setsToday = Number(localStorage.getItem(key(userId, `sets_${today}`)) || 0) + 1;
  try { localStorage.setItem(key(userId, `sets_${today}`), String(setsToday)); } catch { /* ignore */ }

  // Daily streak: +1 if yesterday was active, reset to 1 after a gap. Counted once/day.
  const lastDay = localStorage.getItem(key(userId, "lastDay"));
  let streak = Number(localStorage.getItem(key(userId, "streak")) || 0);
  if (lastDay !== today) {
    const yesterday = dayKey(new Date(now.getTime() - 864e5));
    streak = lastDay === yesterday ? streak + 1 : 1;
    try {
      localStorage.setItem(key(userId, "streak"), String(streak));
      localStorage.setItem(key(userId, "lastDay"), today);
    } catch { /* ignore */ }
  }

  // Which bonuses fire on this clear.
  const earned = [BONUS.set];                       // full set clear — always
  if (setsToday === 3) earned.push(BONUS.combo);     // 3rd set of the day
  if (streak === 7) earned.push(BONUS.streak7);      // hit a 7-day streak
  if (now.getHours() < 12) earned.push(BONUS.early); // finished before noon

  return { earned, totalXp: earned.reduce((s, b) => s + b.xp, 0), setsToday, streak };
}

// Headline for the celebration, escalating with the rarest bonus earned.
export function celebrationTitle({ setsToday, streak, earned }) {
  if (earned.some(b => b.id === "streak7")) return `🔥 ${streak}-day streak!`;
  if (earned.some(b => b.id === "combo")) return `🔗 Combo ×${setsToday}!`;
  return "🎯 Focus set complete!";
}
