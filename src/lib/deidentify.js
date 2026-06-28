// ─── De-identification for training data ─────────────────────────────────────
// Removes direct identifiers from FREE-TEXT before any record enters a training set.
// Called by the (future) training export on records that pass consent.isTrainingEligible.
//
// Which data needs attention? Free-text fields can contain names, contacts, account
// numbers — high risk. Structured fields (scores, category, booleans) carry no direct
// identifiers — low risk, kept as-is. FIELD_ATTENTION makes that explicit and auditable.
//
// LIMITATION: regex catches *direct* identifiers (email, phone, card, IBAN, IDs, URLs,
// handles). It does NOT reliably catch names or addresses — for thorough scrubbing of
// those, run a NER / LLM pass on the "high" fields before training. This is a strong first
// layer, not a guarantee of full anonymization.

// Ordered so the most specific patterns run first (emails before generic number runs).
const PATTERNS = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[EMAIL]"],
  [/https?:\/\/\S+/g, "[URL]"],
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, "[IBAN]"],
  [/\b(?:\d[ -]?){13,19}\b/g, "[CARD]"],                       // 13–19 digit card-like runs
  [/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4}/g, "[PHONE]"], // loose phone
  [/@[A-Za-z0-9_]{2,}/g, "[HANDLE]"],
  [/\b\d{6,}\b/g, "[NUMBER]"],                                  // long IDs / account numbers
];

// Replace direct identifiers in a string. Over-redaction is acceptable here — privacy wins.
export function redactPII(text) {
  if (typeof text !== "string" || !text) return text;
  let out = text;
  for (const [re, repl] of PATTERNS) out = out.replace(re, repl);
  return out;
}

// Per-field attention level. "high" = free text, must be scrubbed. "low" = structured, safe.
export const FIELD_ATTENTION = {
  title: "high",
  notes: "high",
  category: "low",
  urgency: "low",
  importance: "low",
  effort: "low",
  energy: "low",
  pleasure: "low",
  est_minutes: "low",
  cognitive_load: "low",
  ai_delegatable: "low",
  multi_step: "low",
};

const HIGH_FIELDS = Object.entries(FIELD_ATTENTION)
  .filter(([, level]) => level === "high")
  .map(([field]) => field);

// De-identify a single task object: scrub the free-text fields, keep structured ones.
export function deidentifyTask(task) {
  if (!task || typeof task !== "object") return task;
  const out = { ...task };
  for (const f of HIGH_FIELDS) if (typeof out[f] === "string") out[f] = redactPII(out[f]);
  return out;
}

// Raw brain-dump text is the highest-risk field (unstructured user prose).
export const deidentifyDumpText = redactPII;
