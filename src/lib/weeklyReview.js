// ─── Weekly review ───────────────────────────────────────────────────────────
// The first feature that *reads* the telemetry/behaviour back to the user. It is a
// pure function over the in-memory tasks (no network, no LLM), so every number is
// exact — an LLM can phrase a stat wrong, this never can. The "feels like an AI"
// quality comes from a seeded phrasing layer: each insight has several warm,
// kindly-worded variants, and we pick deterministically from a seed derived from the
// week + the data. So the copy is stable within a week (not jittery on every open) but
// genuinely changes week to week, the way a thoughtful weekly note would.

import { taskCats, taskTier, calcScore, DEFAULT_WEIGHTS, EST_BY_EFFORT, fmtDuration } from "./tasks";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const s = (n) => (n === 1 ? "" : "s");

// Monday 00:00 (local) of the week containing d.
function weekStart(d = new Date()) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  const dow = (t.getDay() + 6) % 7; // Monday = 0
  t.setDate(t.getDate() - dow);
  return t;
}

const inRange = (iso, from, to) => {
  if (!iso) return false;
  const x = new Date(iso).getTime();
  return x >= from.getTime() && x < to.getTime();
};

const taskMinutes = (t) =>
  Number.isFinite(t.est_minutes) && t.est_minutes > 0 ? t.est_minutes : (EST_BY_EFFORT[(t.effort || 3) - 1] || 30);

// ── seeded RNG so phrasing is stable within a week but varies across weeks/data ──
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export function buildReview(tasks = [], weights = DEFAULT_WEIGHTS, now = new Date()) {
  const thisStart = weekStart(now);
  const lastStart = new Date(thisStart); lastStart.setDate(thisStart.getDate() - 7);
  const end = now;

  const doneThisWeek = tasks.filter((t) => t.done && inRange(t.doneAt, thisStart, new Date(thisStart.getTime() + 7 * 864e5)) && new Date(t.doneAt) <= end);
  const doneLastWeek = tasks.filter((t) => t.done && inRange(t.doneAt, lastStart, thisStart));
  const addedThisWeek = tasks.filter((t) => inRange(t.addedAt, thisStart, new Date(thisStart.getTime() + 7 * 864e5)));
  const addedDone = addedThisWeek.filter((t) => t.done);
  const openNow = tasks.filter((t) => !t.done);

  // Per-category completions (by primary category).
  const catCounts = {};
  for (const t of doneThisWeek) { const c = taskCats(t)[0] || "Uncategorised"; catCounts[c] = (catCounts[c] || 0) + 1; }
  const perCategory = Object.entries(catCounts).map(([cat, count]) => ({ cat, count })).sort((a, b) => b.count - a.count);

  // Completions per weekday.
  const byDay = Array(7).fill(0);
  for (const t of doneThisWeek) { const d = (new Date(t.doneAt).getDay() + 6) % 7; byDay[d]++; }
  const bestDayIdx = byDay.some((n) => n > 0) ? byDay.indexOf(Math.max(...byDay)) : -1;

  const focusMinutes = doneThisWeek.reduce((m, t) => m + taskMinutes(t), 0);
  const heavyDone = doneThisWeek.filter((t) => taskTier(t) === "heavy").length;
  const pleasures = doneThisWeek.map((t) => t.pleasure).filter((p) => Number.isFinite(p) && p > 0);
  const avgPleasure = pleasures.length ? pleasures.reduce((a, b) => a + b, 0) / pleasures.length : null;
  const biggestWin = doneThisWeek.length
    ? doneThisWeek.reduce((best, t) => (calcScore(t, weights) > calcScore(best, weights) ? t : best))
    : null;

  const stats = {
    completed: doneThisWeek.length,
    completedLastWeek: doneLastWeek.length,
    delta: doneThisWeek.length - doneLastWeek.length,
    added: addedThisWeek.length,
    captureRate: addedThisWeek.length ? Math.round((addedDone.length / addedThisWeek.length) * 100) : null,
    openNow: openNow.length,
    focusMinutes,
    focusLabel: fmtDuration(focusMinutes),
    heavyDone,
    avgPleasure,
    topCategory: perCategory[0] || null,
    bestDay: bestDayIdx >= 0 ? { name: DAY_NAMES[bestDayIdx], count: byDay[bestDayIdx] } : null,
    biggestWin: biggestWin ? { title: biggestWin.title, score: calcScore(biggestWin, weights) } : null,
  };

  const rng = mulberry32(hash(`${thisStart.toISOString().slice(0, 10)}|${stats.completed}|${stats.added}|${stats.focusMinutes}`));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const range = {
    start: thisStart,
    end,
    label: `${thisStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
  };

  if (stats.completed === 0) {
    // Kind, non-shaming empty state.
    const greeting = pick([
      "A fresh week, a clean slate.",
      "Here's where your week stands.",
      "Quiet week so far — and that's completely okay.",
    ]);
    const body = pick([
      stats.added > 0
        ? `You've captured ${stats.added} task${s(stats.added)} this week — that's the hardest part done. Whenever you're ready, picking just one to finish is a great start.`
        : "Nothing logged yet this week. No pressure at all — drop a few thoughts into Brain Dump and I'll help you sort them.",
      "Some weeks are for resting and resetting. When you feel like easing back in, even one small task counts.",
      "There's no completion to report yet, and that's a perfectly fine place to be. Start tiny — momentum follows.",
    ]);
    return { hasData: false, range, stats, perCategory, byDay, greeting, insights: [body], closing: "" };
  }

  // ── Varied, kind insight sentences ──────────────────────────────────────────
  const insights = [];

  // 1. Completion headline
  insights.push(pick([
    `You completed ${stats.completed} task${s(stats.completed)} this week — really nice work.`,
    `${stats.completed} task${s(stats.completed)} crossed off this week. That's real progress.`,
    `This week you saw ${stats.completed} task${s(stats.completed)} through to done. Well done.`,
    `${stats.completed} thing${s(stats.completed)} finished this week — you showed up for yourself.`,
  ]));

  // 2. Momentum vs last week
  if (stats.completedLastWeek > 0 || stats.delta !== 0) {
    if (stats.delta > 0) {
      insights.push(pick([
        `That's ${stats.delta} more than last week — your momentum is building.`,
        `You're up ${stats.delta} on last week. Whatever you're doing, it's working.`,
        `${stats.delta} more than the week before — a lovely upward trend.`,
      ]));
    } else if (stats.delta < 0) {
      insights.push(pick([
        `It's a little quieter than last week, and that's okay — weeks have their own rhythm.`,
        `Slightly fewer than last week. Be gentle with yourself; consistency beats any single week.`,
        `A touch lighter than last week — no judgment here, just a marker to glance at.`,
      ]));
    } else {
      insights.push(pick([
        `That's right in step with last week — steady and dependable.`,
        `Same pace as last week. Quietly consistent, which is underrated.`,
      ]));
    }
  }

  // 3. Capture → completion rate
  if (stats.captureRate != null && stats.added >= 2) {
    insights.push(pick([
      `Of the ${stats.added} task${s(stats.added)} you captured this week, you've already finished ${stats.captureRate}% — you're turning intentions into action.`,
      `You've cleared ${stats.captureRate}% of what you added this week. Capturing and closing the loop is the whole game.`,
      `${stats.captureRate}% of this week's new task${s(stats.added)} are already done — a healthy ratio.`,
    ]));
  }

  // 4. Top category
  if (stats.topCategory && stats.topCategory.count >= 2) {
    insights.push(pick([
      `Most of your energy went to ${stats.topCategory.cat} (${stats.topCategory.count} done) — that's clearly where your focus lives right now.`,
      `${stats.topCategory.cat} led the way with ${stats.topCategory.count} completed. Nice to see where your effort is landing.`,
      `You leaned into ${stats.topCategory.cat} this week — ${stats.topCategory.count} task${s(stats.topCategory.count)} there alone.`,
    ]));
  }

  // 5. Best day
  if (stats.bestDay && stats.bestDay.count >= 2) {
    insights.push(pick([
      `${stats.bestDay.name} was your strongest day (${stats.bestDay.count} done) — worth protecting that kind of momentum.`,
      `You really hit your stride on ${stats.bestDay.name}, finishing ${stats.bestDay.count}. A good day to guard for deep work.`,
      `${stats.bestDay.name} stood out — ${stats.bestDay.count} task${s(stats.bestDay.count)} done in a single day.`,
    ]));
  }

  // 6. Focus time / heavy work
  if (stats.focusMinutes >= 30) {
    insights.push(heavyDone > 0
      ? pick([
        `That adds up to roughly ${stats.focusLabel} of focused effort, including ${heavyDone} heavier task${s(heavyDone)} you didn't shy away from.`,
        `About ${stats.focusLabel} of real work — and ${heavyDone} of those ${heavyDone === 1 ? "was a heavy one" : "were heavy ones"} you didn't shy away from. That takes resolve.`,
      ])
      : pick([
        `That's around ${stats.focusLabel} of focused work — meaningful time, well spent.`,
        `Roughly ${stats.focusLabel} of effort went into this week. It counts.`,
      ]));
  }

  // 7. Pleasure / sustainability
  if (stats.avgPleasure != null) {
    if (stats.avgPleasure >= 3.5) {
      insights.push(pick([
        `And you enjoyed a good share of it — your tasks skewed toward things you actually like doing. That's a sustainable kind of productive.`,
        `Encouragingly, much of what you did was stuff you enjoy. Doing well and feeling good don't have to trade off.`,
      ]));
    } else if (stats.avgPleasure <= 2.2) {
      insights.push(pick([
        `A lot of this week was the less-fun, necessary stuff — so extra credit to you for pushing through it. Maybe slot in one task you enjoy next week.`,
        `This week leaned into the chores more than the joys. You handled it; consider gifting yourself a pleasant task or two next week.`,
      ]));
    }
  }

  // Closing
  const closing = pick([
    "Whatever next week brings, you're building something real here. See you then. 🌱",
    "Small, steady weeks compound. Proud of the work — take a breath, then carry on.",
    "That's your week. Rest where you can, and I'll be here when you're ready for the next one.",
    "Keep going at your own pace — it's clearly working. Until next week.",
  ]);

  return { hasData: true, range, stats, perCategory, byDay, insights, closing };
}
