// ─── Brain Dump spec ──────────────────────────────────────────────────────────
// Single source of truth for the brain-dump → tasks feature.
// Imported by the app (src/App.jsx) AND the model eval harness (eval/run-eval.mjs)
// so what you benchmark is exactly what ships. Keep all changes here.

export const CATEGORIES = ["Health", "Work", "Admin", "Social", "Finance", "Learning", "Personal"];

// The model that powers Brain Dump in the app. This is a cheap, high-frequency
// classification call — a perfect candidate for a small/old/open-source model.
// Run `node eval/run-eval.mjs` to compare candidates, then set the winner here.
export const BRAIN_DUMP_MODEL = "claude-sonnet-4-6";

// max_tokens for the call. 8000 comfortably fits a long dump's worth of structured
// tasks without truncating (the old 4000 could clip large lists).
export const BRAIN_DUMP_MAX_TOKENS = 8000;

// Best-practice system prompt: role + extraction rules + an explicit scoring rubric.
// Output *shape* is enforced by the JSON schema below (structured outputs), so the
// prompt stays focused on classification quality, not "return only JSON".
export const BRAIN_DUMP_SYSTEM = `You are BrainQueue's task-extraction engine. The user pastes a "brain dump": freeform notes in any format — numbered or bulleted lists, plain prose, to-do checkboxes, Notion or Markdown tables, voice transcripts, mixed languages. Turn it into a clean, deduplicated list of actionable tasks and score each one.

Extraction rules:
- One task per discrete action. Split compound items: "call the bank and email the landlord" becomes two tasks.
- Drop non-actionable lines: section headers, dates, labels, pure notes-to-self with no action, and anything already completed (crossed out, "done", "[x]", a strikethrough).
- Do not invent tasks that the text does not imply. Stay faithful to the user's intent.
- Merge obvious duplicates that refer to the same action.
- Write each title in clear English as an imperative — verb + object — about 60 characters max. Translate non-English input to English.
- Strip list markers, numbering, checkboxes, and decorative emoji from titles.

Score every task with integers 1-5:
- urgency: 5 = today, 4 = this week, 3 = this month, 2 = eventually, 1 = someday. Read deadline cues from the text; default to 3 when there is no signal.
- importance: 5 = critical / high stakes, 3 = medium, 1 = nice to have. Default to 3.
- effort: 1 = 2 minutes or less, 2 = ~15 minutes, 3 = ~1 hour, 4 = half a day, 5 = multi-day. Estimate from the task.
- energy: 1 = doable in "zombie mode", 5 = needs peak focus. Estimate the cognitive load.

category: exactly one of Health, Work, Admin, Social, Finance, Learning, Personal.
notes: a short piece of context taken from the dump, or "" when there is none. Never just repeat the title.

If the input contains no actionable tasks, return an empty list.`;

// JSON schema for structured outputs. enum constraints are allowed by the
// Anthropic structured-outputs validator (numeric min/max are not — so we enum 1-5).
// Wrapped in an object (root arrays aren't accepted) — read the `.tasks` field.
const TASK_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    category: { type: "string", enum: CATEGORIES },
    urgency: { type: "integer", enum: [1, 2, 3, 4, 5] },
    importance: { type: "integer", enum: [1, 2, 3, 4, 5] },
    effort: { type: "integer", enum: [1, 2, 3, 4, 5] },
    energy: { type: "integer", enum: [1, 2, 3, 4, 5] },
    notes: { type: "string" },
  },
  required: ["title", "category", "urgency", "importance", "effort", "energy", "notes"],
  additionalProperties: false,
};

export const TASK_LIST_SCHEMA = {
  type: "object",
  properties: {
    tasks: { type: "array", items: TASK_ITEM_SCHEMA },
  },
  required: ["tasks"],
  additionalProperties: false,
};

// Clamp/repair a model's task object so a stray value can never crash the UI or
// produce a NaN score. Used by both the app and the eval scorer.
export function sanitizeTask(t) {
  const clamp = (v) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
  };
  const category = CATEGORIES.includes(t?.category) ? t.category : "Personal";
  return {
    title: String(t?.title ?? "").trim() || "Untitled task",
    category,
    urgency: clamp(t?.urgency),
    importance: clamp(t?.importance),
    effort: clamp(t?.effort),
    energy: clamp(t?.energy),
    notes: typeof t?.notes === "string" ? t.notes : "",
  };
}
