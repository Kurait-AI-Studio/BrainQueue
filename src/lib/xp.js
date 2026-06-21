// ─── XP curve & rewards (canonical) ──────────────────────────────────────────
// The progression spine. Per-task XP comes from taskXP() in tasks.js; this file owns
// the LEVEL curve and the bonus rewards on top of it.
//
// Design intent: early levels come fast (onboarding dopamine), then the cost grows
// geometrically so that reaching Level 10 represents a genuinely changed life —
// ~4 months of consistent daily focus, not a weekend grind. Cumulative XP to reach
// each level (BASE=300, GROWTH=1.5):
//   L2 300 · L3 750 · L4 1,425 · L5 2,438 · L6 3,957 · L7 6,235 · L8 9,652
//   L9 14,778 · L10 22,467
// At ~250 XP on an active day, L10 lands around 90 active days spread over months.

export const MAX_LEVEL = 10;

// A 10-step identity arc — from first spark to a transformed operator.
export const LEVEL_TITLES = [
  "Spark",       // 1  — first session
  "Starter",     // 2
  "Builder",     // 3
  "Mover",       // 4
  "Operator",    // 5  — a real routine
  "Achiever",    // 6
  "Strategist",  // 7
  "Machine",     // 8
  "Virtuoso",    // 9
  "Transformed", // 10 — life changed
];

const BASE = 300;     // XP to clear level 1
const GROWTH = 1.5;   // each level costs 1.5× the last

// XP needed to advance FROM `level` to `level+1`.
export function levelCost(level) {
  return Math.round(BASE * GROWTH ** (level - 1));
}

// Cumulative XP required to *reach* `level` (level 1 = 0 XP).
export function xpToReach(level) {
  let acc = 0;
  for (let l = 1; l < level; l++) acc += levelCost(l);
  return acc;
}

// Resolve a total-XP figure into the user's level + progress into it.
export function levelForXp(xp = 0) {
  let level = 1, acc = 0, need = levelCost(1);
  while (level < MAX_LEVEL && xp >= acc + need) { acc += need; level++; need = levelCost(level); }
  const maxed = level >= MAX_LEVEL;
  const into = xp - acc;
  return {
    level,
    into,
    need: maxed ? 0 : need,
    pct: maxed ? 100 : Math.round((into / need) * 100),
    toNext: maxed ? 0 : acc + need - xp,
    title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)],
    max: maxed,
  };
}

// Back-compat alias for the old name used around the app.
export const levelInfo = levelForXp;

// ── Bonus rewards — the dopamine layer that fires on top of a set's base XP ──
// Frequent-small (early bird, full set) keep the loop warm; rare-large (streaks,
// combos) are the spikes that pull a user back day after day and actually move the
// needle on the curve above.
export const BONUSES = [
  { id: "set",     icon: "🎯", name: "Full set clear", xp: 50,  desc: "Finish every task in a set",  color: "#bef24a" },
  { id: "combo",   icon: "🔗", name: "Combo ×3",       xp: 150, desc: "Clear 3 sets in one day",     color: "#f5b13a" },
  { id: "streak7", icon: "🔥", name: "7-day streak",   xp: 300, desc: "Show up and focus daily",     color: "#ff6b6b" },
  { id: "early",   icon: "🌅", name: "Early bird",     xp: 25,  desc: "Finish a set before noon",    color: "#6b9fff" },
];
export const BONUS = Object.fromEntries(BONUSES.map(b => [b.id, b]));
