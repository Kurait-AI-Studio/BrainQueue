// ─── Level 0 adaptation ──────────────────────────────────────────────────────
// The cheapest, most visible personalization: learn from the user's OWN completed
// tasks (no LLM, no network) and nudge the score weights toward what they actually
// finish. Applied only when Memory is on (consent "full"), so "Memory off = generic"
// stays true and personalization is gated on explicit consent.
//
// Revealed preference: a person who keeps completing urgent things values urgency; one
// who clears quick, low-energy wins values those. calcScore rewards high urgency/
// importance/pleasure and LOW effort/energy, so we read each completed task on the same
// reward-aligned axis, average it, and blend the result with the user's base weights for
// stability. Needs a minimum number of completions before it adapts at all (avoids noise).

// Mirrors DEFAULT_WEIGHTS in ./tasks — kept inline so this module has no imports and stays
// trivially testable. Only used as a fallback; the app always passes the user's real base.
const FALLBACK_WEIGHTS = { urgency: 30, importance: 30, effort: 15, energy: 10, pleasure: 15 };

const DIMS = ["urgency", "importance", "effort", "energy", "pleasure"];

export function adaptWeights(tasks, base = FALLBACK_WEIGHTS, { min = 8, alpha = 0.4 } = {}) {
  const done = (tasks || []).filter((t) => t && t.done);
  if (done.length < min) return { weights: base, tuned: false, n: done.length };

  const avg = (f) => done.reduce((s, t) => s + f(t), 0) / done.length;
  // Reward-aligned signal per dimension (effort/energy inverted, matching calcScore), 1..5.
  const signal = {
    urgency: avg((t) => t.urgency ?? 3),
    importance: avg((t) => t.importance ?? 3),
    effort: avg((t) => 6 - (t.effort ?? 3)),
    energy: avg((t) => 6 - (t.energy ?? 3)),
    pleasure: avg((t) => t.pleasure ?? 3),
  };
  const baseTotal = DIMS.reduce((s, k) => s + (base[k] ?? 0), 0) || 100;

  // Scale each base weight by how far this user's completed tasks deviate from neutral (3)
  // on that axis: factor in [1-alpha, 1+alpha]. Then renormalize to keep the total (and so
  // the score scale) stable. A user who finishes urgent things gets urgency weighted up.
  const raw = {};
  for (const k of DIMS) {
    const dev = (signal[k] - 3) / 2; // -1..+1
    raw[k] = Math.max(1e-4, (base[k] ?? 0) * (1 + alpha * dev));
  }
  const rawTotal = DIMS.reduce((s, k) => s + raw[k], 0) || 1;
  const weights = {};
  for (const k of DIMS) weights[k] = Math.max(1, Math.round((raw[k] * baseTotal) / rawTotal));
  return { weights, tuned: true, n: done.length };
}
