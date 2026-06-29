// ─── Near-duplicate detection (no deps) ──────────────────────────────────────
// Normalizes text and compares word overlap (Jaccard), so "Call the bank about the card"
// and "call bank re card" read as similar. Used to warn — never to block — when a captured
// task looks like one the user already has, or a capture repeats an earlier one.

export function normalize(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const tokenSet = (s) => new Set(normalize(s).split(" ").filter((w) => w.length > 2));

// Jaccard similarity, 0..1.
export function similarity(a, b) {
  const A = tokenSet(a), B = tokenSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// Best candidate at or above `threshold`, else null. Candidates may be strings or objects
// with a `text`/`title` field.
export function findSimilar(text, candidates = [], threshold = 0.5) {
  let best = null, bestScore = threshold;
  for (const c of candidates) {
    const other = typeof c === "string" ? c : (c.text ?? c.title ?? "");
    const s = similarity(text, other);
    if (s >= bestScore) { best = c; bestScore = s; }
  }
  return best ? { match: best, score: bestScore } : null;
}
