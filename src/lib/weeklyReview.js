// ─── Weekly review ───────────────────────────────────────────────────────────
// The first feature that *reads* the telemetry/behaviour back to the user. It is a
// pure function over the in-memory tasks (no network, no LLM), so every number is
// exact — an LLM can phrase a stat wrong, this never can. The "feels like an AI"
// quality comes from a seeded phrasing layer: each insight has several worded variants
// per tone, and we pick deterministically from a seed derived from the week + the data.
// So the copy is stable within a week (not jittery on every open) but genuinely changes
// week to week, the way a thoughtful weekly note would. The user picks the tone in
// Settings (kind / motivational / direct / tough love) — see REVIEW_TONES.

import { taskCats, taskTier, calcScore, DEFAULT_WEIGHTS, EST_BY_EFFORT, fmtDuration } from "./tasks";

// The tones the user can choose in Settings. `key` is what's stored in state and
// stamped on the weekly_review_viewed telemetry event.
export const REVIEW_TONES = {
  kind:         { label: "Kind",         emoji: "🌱", hint: "Warm and gentle. Celebrates effort, never shames a quiet week." },
  motivational: { label: "Motivational", emoji: "🔥", hint: "High-energy. Hypes your wins and pushes the streak forward." },
  direct:       { label: "Direct",       emoji: "🎯", hint: "Concise and factual. The signal, lightly coached, no fluff." },
  tough:        { label: "Tough love",   emoji: "🥊", hint: "Blunt and challenging. Names the slippage, doesn't coddle." },
};
const TONE_KEYS = Object.keys(REVIEW_TONES);
export const DEFAULT_REVIEW_TONE = "kind";

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

// ── Per-tone phrasing banks ─────────────────────────────────────────────────
// Each slot returns an array of variants for the given tone; the caller picks one
// with the seeded RNG. `st` is the computed stats object.
const VOICES = {
  kind: {
    headline: (st) => [
      `You completed ${st.completed} task${s(st.completed)} this week — really nice work.`,
      `${st.completed} task${s(st.completed)} crossed off this week. That's real progress.`,
      `This week you saw ${st.completed} task${s(st.completed)} through to done. Well done.`,
    ],
    up: (st) => [
      `That's ${st.delta} more than last week — your momentum is building.`,
      `You're up ${st.delta} on last week. Whatever you're doing, it's working.`,
    ],
    down: () => [
      `It's a little quieter than last week, and that's okay — weeks have their own rhythm.`,
      `Slightly fewer than last week. Be gentle with yourself; consistency beats any single week.`,
    ],
    flat: () => [
      `That's right in step with last week — steady and dependable.`,
      `Same pace as last week. Quietly consistent, which is underrated.`,
    ],
    capture: (st) => [
      `Of the ${st.added} task${s(st.added)} you captured this week, you've already finished ${st.captureRate}% — you're turning intentions into action.`,
      `You've cleared ${st.captureRate}% of what you added this week. Closing the loop is the whole game.`,
    ],
    category: (st) => [
      `Most of your energy went to ${st.topCategory.cat} (${st.topCategory.count} done) — clearly where your focus lives right now.`,
      `${st.topCategory.cat} led the way with ${st.topCategory.count} completed. Nice to see where your effort is landing.`,
    ],
    bestDay: (st) => [
      `${st.bestDay.name} was your strongest day (${st.bestDay.count} done) — worth protecting that kind of momentum.`,
      `You hit your stride on ${st.bestDay.name}, finishing ${st.bestDay.count}. A good day to guard for deep work.`,
    ],
    focus: (st) => [
      `That's around ${st.focusLabel} of focused work — meaningful time, well spent.`,
      `Roughly ${st.focusLabel} of effort went into this week. It counts.`,
    ],
    focusHeavy: (st) => [
      `That adds up to roughly ${st.focusLabel} of focused effort, including ${st.heavyDone} heavier task${s(st.heavyDone)} you didn't shy away from.`,
      `About ${st.focusLabel} of real work — and ${st.heavyDone} of those ${st.heavyDone === 1 ? "was a heavy one" : "were heavy ones"} you pushed through. That takes resolve.`,
    ],
    pleasureHigh: () => [
      `And you enjoyed a good share of it — your tasks skewed toward things you actually like. That's a sustainable kind of productive.`,
      `Encouragingly, much of what you did was stuff you enjoy. Doing well and feeling good don't have to trade off.`,
    ],
    pleasureLow: () => [
      `A lot of this week was the less-fun, necessary stuff — extra credit for pushing through. Maybe slot in one task you enjoy next week.`,
      `This week leaned into the chores more than the joys. You handled it; consider gifting yourself a pleasant task or two next week.`,
    ],
    closing: () => [
      `Whatever next week brings, you're building something real here. See you then. 🌱`,
      `Small, steady weeks compound. Proud of the work — take a breath, then carry on.`,
      `That's your week. Rest where you can, and I'll be here when you're ready for the next one.`,
    ],
    emptyGreeting: () => [`A fresh week, a clean slate.`, `Quiet week so far — and that's completely okay.`],
    emptyBody: (st) => [
      st.added > 0
        ? `You've captured ${st.added} task${s(st.added)} this week — that's the hardest part done. Whenever you're ready, finishing just one is a great start.`
        : `Nothing logged yet this week. No pressure at all — drop a few thoughts into Brain Dump and I'll help you sort them.`,
      `Some weeks are for resting and resetting. When you feel like easing back in, even one small task counts.`,
    ],
  },

  motivational: {
    headline: (st) => [
      `${st.completed} task${s(st.completed)} down this week — let's keep that fire going! 🔥`,
      `Boom — ${st.completed} done this week. You're building serious momentum.`,
      `${st.completed} wins on the board this week. That's how it's done.`,
    ],
    up: (st) => [
      `Up ${st.delta} on last week — you're accelerating. Don't let off the gas.`,
      `${st.delta} more than last week! The trend line is pointing straight up.`,
    ],
    down: () => [
      `Dipped a little from last week — no problem. Next week is yours to take back.`,
      `Slower week, but every champ has them. Time to reload and come out swinging.`,
    ],
    flat: () => [
      `Matched last week — rock-solid consistency. Now let's break through it.`,
      `Same as last week. Steady is good; next move is to level up.`,
    ],
    capture: (st) => [
      `You crushed ${st.captureRate}% of everything you captured this week. Keep closing the loop!`,
      `${st.captureRate}% of this week's new task${s(st.added)} already done — that's a finisher's ratio.`,
    ],
    category: (st) => [
      `You went all-in on ${st.topCategory.cat} — ${st.topCategory.count} done. That's where you're dominating.`,
      `${st.topCategory.cat} was your battleground this week: ${st.topCategory.count} knocked out.`,
    ],
    bestDay: (st) => [
      `${st.bestDay.name} was a monster — ${st.bestDay.count} done in one day. Bottle that energy.`,
      `Your peak was ${st.bestDay.name} with ${st.bestDay.count}. Make every day look a little more like that.`,
    ],
    focus: (st) => [
      `About ${st.focusLabel} of pure focus this week. That's the grind paying off.`,
      `${st.focusLabel} of work logged. Effort like that compounds — keep stacking it.`,
    ],
    focusHeavy: (st) => [
      `~${st.focusLabel} of focus, and you took on ${st.heavyDone} heavy hitter${s(st.heavyDone)}. You don't dodge the hard stuff. 💪`,
      `${st.focusLabel} in, including ${st.heavyDone} of the brutal one${s(st.heavyDone)}. That's championship effort.`,
    ],
    pleasureHigh: () => [
      `And you actually enjoyed the ride — winning while having fun. Unstoppable combo.`,
      `Bonus: you liked most of what you did. That's the kind of momentum that lasts.`,
    ],
    pleasureLow: () => [
      `Most of this was grind-it-out work — and you did it anyway. That's discipline. Reward yourself next week.`,
      `Heavy on the chores this week, but you didn't flinch. Respect. Now go schedule something fun.`,
    ],
    closing: () => [
      `Next week, let's beat this one. You've got it. 🔥`,
      `Momentum is a muscle — you're building it. See you at the top.`,
      `Rest up, then come back hungry. The streak continues.`,
    ],
    emptyGreeting: () => [`Clean slate — time to make a move.`, `Fresh week, fresh chance to go off.`],
    emptyBody: (st) => [
      st.added > 0
        ? `You've already loaded up ${st.added} task${s(st.added)} — now go knock the first one out. Momentum starts with one rep.`
        : `Empty board so far. Brain Dump a few things and let's get the first win on the scoreboard.`,
      `Every streak starts at one. Pick the easiest task and just start — the rest follows.`,
    ],
  },

  direct: {
    headline: (st) => [
      `${st.completed} task${s(st.completed)} completed this week.`,
      `This week: ${st.completed} done.`,
      `Throughput: ${st.completed} task${s(st.completed)} closed.`,
    ],
    up: (st) => [`+${st.delta} vs last week.`, `Up ${st.delta} from last week.`],
    down: (st) => [`${Math.abs(st.delta)} fewer than last week.`, `Down ${Math.abs(st.delta)} from last week.`],
    flat: () => [`Same count as last week.`, `Flat vs last week.`],
    capture: (st) => [
      `${st.captureRate}% of this week's ${st.added} new task${s(st.added)} are already done.`,
      `Capture-to-done rate: ${st.captureRate}%.`,
    ],
    category: (st) => [
      `Top category: ${st.topCategory.cat} (${st.topCategory.count} of ${st.completed}).`,
      `Most completions in ${st.topCategory.cat}: ${st.topCategory.count}.`,
    ],
    bestDay: (st) => [
      `Best day: ${st.bestDay.name} (${st.bestDay.count}).`,
      `Peak day was ${st.bestDay.name} with ${st.bestDay.count} done.`,
    ],
    focus: (st) => [`~${st.focusLabel} of estimated focused work.`, `Focused effort: about ${st.focusLabel}.`],
    focusHeavy: (st) => [
      `~${st.focusLabel} of work, ${st.heavyDone} of it heavy-tier.`,
      `About ${st.focusLabel} total; ${st.heavyDone} heavy task${s(st.heavyDone)} completed.`,
    ],
    pleasureHigh: () => [`Most completed tasks were high-pleasure — sustainable mix.`, `Tasks skewed toward enjoyable work this week.`],
    pleasureLow: () => [`Most completed tasks were low-pleasure — chore-heavy week.`, `Workload skewed toward low-enjoyment tasks.`],
    closing: () => [`That's the week. Next.`, `Snapshot complete.`, `Logged. See you next week.`],
    emptyGreeting: () => [`No completions yet this week.`, `Week in progress.`],
    emptyBody: (st) => [
      st.added > 0
        ? `${st.added} task${s(st.added)} captured, 0 completed. Pick one to close.`
        : `No tasks logged this week. Add some via Brain Dump to start tracking.`,
      `Nothing done yet. One completion starts the data.`,
    ],
  },

  tough: {
    headline: (st) => [
      `${st.completed} task${s(st.completed)} done this week. Fine — but you know there's more in the tank.`,
      `${st.completed} finished. Not bad. Not your ceiling either.`,
      `${st.completed} closed out. Decent. Now stop reading and go beat it.`,
    ],
    up: (st) => [
      `+${st.delta} on last week. Good — that's the bare minimum: keep climbing, don't coast.`,
      `Up ${st.delta}. Progress. Don't you dare slow down now.`,
    ],
    down: (st) => [
      `Down ${Math.abs(st.delta)} from last week. That's slippage. Own it and fix it next week.`,
      `${Math.abs(st.delta)} fewer than last week. You can do better, and you know it.`,
    ],
    flat: () => [
      `Same as last week. Plateaus are where people quietly stall. Break it.`,
      `Flat. Treading water isn't winning. Pick it up.`,
    ],
    capture: (st) => [
      `Only ${st.captureRate}% of what you captured this week is done. The rest is just a wish list until you finish it.`,
      `${st.captureRate}% capture-to-done. The other ${100 - st.captureRate}% is staring at you.`,
    ],
    category: (st) => [
      `${st.topCategory.cat} got most of your effort (${st.topCategory.count}). Make sure that's where it actually mattered.`,
      `You poured into ${st.topCategory.cat} — ${st.topCategory.count} done. Was that the priority, or the comfortable choice?`,
    ],
    bestDay: (st) => [
      `${st.bestDay.name} you did ${st.bestDay.count}. Proof you've got the gear — so why not every day?`,
      `Best day: ${st.bestDay.name}, ${st.bestDay.count} done. That's your real capacity. Hit it more often.`,
    ],
    focus: (st) => [
      `About ${st.focusLabel} of actual focused work. Be honest — could it have been more?`,
      `${st.focusLabel} of focus this week. Respectable. Not remarkable. Push it.`,
    ],
    focusHeavy: (st) => [
      `~${st.focusLabel} in, ${st.heavyDone} heavy task${s(st.heavyDone)} cleared. Good — the hard ones are the ones that count. Keep taking them.`,
      `${st.focusLabel} of work, ${st.heavyDone} of it heavy. That's the right target. Don't retreat to easy tasks next week.`,
    ],
    pleasureHigh: () => [
      `Most of it was stuff you enjoy. Nice — now prove you'll grind the boring essentials too.`,
      `You leaned into the fun work. Fine. The growth is in the tasks you keep avoiding.`,
    ],
    pleasureLow: () => [
      `Mostly joyless grind this week — and you still showed up. That's the discipline that separates people. More of that.`,
      `Heavy on the chores. Good. That's where the discipline gets built. Don't go soft next week.`,
    ],
    closing: () => [
      `Next week: beat this. No excuses.`,
      `You've got more in you. Prove it.`,
      `Stop reading the recap. Go make next week's better.`,
    ],
    emptyGreeting: () => [`Nothing done this week. Yet.`, `Empty board. That's on you to change.`],
    emptyBody: (st) => [
      st.added > 0
        ? `${st.added} task${s(st.added)} captured, none finished. Capturing isn't doing. Pick one and close it — today.`
        : `Zero tasks, zero done. The list won't build itself. Brain Dump something and start.`,
      `Nothing finished. The tasks won't complete themselves. Go.`,
    ],
  },
};

export function buildReview(tasks = [], weights = DEFAULT_WEIGHTS, tone = DEFAULT_REVIEW_TONE, now = new Date()) {
  const voice = VOICES[TONE_KEYS.includes(tone) ? tone : DEFAULT_REVIEW_TONE];
  const toneKey = TONE_KEYS.includes(tone) ? tone : DEFAULT_REVIEW_TONE;

  const thisStart = weekStart(now);
  const lastStart = new Date(thisStart); lastStart.setDate(thisStart.getDate() - 7);
  const weekEnd = new Date(thisStart.getTime() + 7 * 864e5);
  const end = now;

  const doneThisWeek = tasks.filter((t) => t.done && inRange(t.doneAt, thisStart, weekEnd) && new Date(t.doneAt) <= end);
  const doneLastWeek = tasks.filter((t) => t.done && inRange(t.doneAt, lastStart, thisStart));
  const addedThisWeek = tasks.filter((t) => inRange(t.addedAt, thisStart, weekEnd));
  const addedDone = addedThisWeek.filter((t) => t.done);
  const openNow = tasks.filter((t) => !t.done);

  const catCounts = {};
  for (const t of doneThisWeek) { const c = taskCats(t)[0] || "Uncategorised"; catCounts[c] = (catCounts[c] || 0) + 1; }
  const perCategory = Object.entries(catCounts).map(([cat, count]) => ({ cat, count })).sort((a, b) => b.count - a.count);

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
    tone: toneKey,
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

  const rng = mulberry32(hash(`${toneKey}|${thisStart.toISOString().slice(0, 10)}|${stats.completed}|${stats.added}|${stats.focusMinutes}`));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];

  const range = {
    start: thisStart,
    end,
    label: `${thisStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
  };

  if (stats.completed === 0) {
    return { hasData: false, tone: toneKey, range, stats, perCategory, byDay, greeting: pick(voice.emptyGreeting()), insights: [pick(voice.emptyBody(stats))], closing: "" };
  }

  const insights = [];
  insights.push(pick(voice.headline(stats)));

  if (stats.completedLastWeek > 0 || stats.delta !== 0) {
    if (stats.delta > 0) insights.push(pick(voice.up(stats)));
    else if (stats.delta < 0) insights.push(pick(voice.down(stats)));
    else insights.push(pick(voice.flat(stats)));
  }
  if (stats.captureRate != null && stats.added >= 2) insights.push(pick(voice.capture(stats)));
  if (stats.topCategory && stats.topCategory.count >= 2) insights.push(pick(voice.category(stats)));
  if (stats.bestDay && stats.bestDay.count >= 2) insights.push(pick(voice.bestDay(stats)));
  if (stats.focusMinutes >= 30) insights.push(pick(heavyDone > 0 ? voice.focusHeavy(stats) : voice.focus(stats)));
  if (stats.avgPleasure != null) {
    if (stats.avgPleasure >= 3.5) insights.push(pick(voice.pleasureHigh()));
    else if (stats.avgPleasure <= 2.2) insights.push(pick(voice.pleasureLow()));
  }

  return { hasData: true, tone: toneKey, range, stats, perCategory, byDay, insights, closing: pick(voice.closing()) };
}
