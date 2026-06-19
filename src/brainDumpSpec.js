// ─── Brain Dump spec ──────────────────────────────────────────────────────────
// Single source of truth for the brain-dump → tasks feature.
// Imported by the app (src/App.jsx) AND the model eval harness (eval/run-eval.mjs)
// so what you benchmark is exactly what ships. Keep all changes here.

export const CATEGORIES = ["Health", "Work", "Admin", "Social", "Finance", "Learning", "Personal"];

// The model that powers Brain Dump in the app. This is a cheap, high-frequency
// classification call — a perfect candidate for a small/old/open-source model.
// Run `node eval/run-eval.mjs` to compare candidates, then set the winner here.
export const BRAIN_DUMP_MODEL = "claude-sonnet-4-6";

// Version stamp for the prompt + schema below. Bump whenever BRAIN_DUMP_SYSTEM or
// the schema changes — telemetry stamps it on every parse event so we can ask, months
// later, "was prompt v2 better than v1?" (Telemetry Capture Spec, principle 2). The
// matching row lives in the prompt_registry table (migration 0006).
export const BRAIN_DUMP_PROMPT_VERSION = "braindump-v1";

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

Also classify how the task will be worked:
- est_minutes: a single best estimate of focused minutes to finish (e.g. 5, 25, 90). Keep it realistic.
- cognitive_load: 1 = mindless, 5 = deep concentration. Estimate the mental demand.
- ai_delegatable: true if an AI assistant could do most of the work (drafting, summarising, research, coding), false for physical/in-person/decision-only tasks.
- multi_step: true if the task clearly involves several distinct sub-steps, false if it is a single action.

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
    est_minutes: { type: "integer" },
    cognitive_load: { type: "integer", enum: [1, 2, 3, 4, 5] },
    ai_delegatable: { type: "boolean" },
    multi_step: { type: "boolean" },
  },
  required: ["title", "category", "urgency", "importance", "effort", "energy", "notes", "est_minutes", "cognitive_load", "ai_delegatable", "multi_step"],
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
  const effort = clamp(t?.effort);
  const estFromEffort = [2, 15, 60, 240, 480][effort - 1];
  const est = Math.round(Number(t?.est_minutes));
  return {
    title: String(t?.title ?? "").trim() || "Untitled task",
    category,
    urgency: clamp(t?.urgency),
    importance: clamp(t?.importance),
    effort,
    energy: clamp(t?.energy),
    notes: typeof t?.notes === "string" ? t.notes : "",
    est_minutes: Number.isFinite(est) && est > 0 ? Math.min(est, 2880) : estFromEffort,
    cognitive_load: clamp(t?.cognitive_load),
    ai_delegatable: !!t?.ai_delegatable,
    multi_step: t?.multi_step != null ? !!t.multi_step : effort >= 4,
  };
}
