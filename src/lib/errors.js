// ─── User-facing error formatting ────────────────────────────────────────────
// Turn any thrown/returned error into a calm, English, user-safe sentence. Never
// let SQL, Postgres codes, stack traces, internal table/column names, or raw HTTP
// dumps reach the UI — those are for logs, not users. Use humanizeError() at every
// place an error is shown to a person (toasts, inline form errors).

// Friendly copy for known Postgres SQLSTATE / PostgREST / HTTP codes.
const BY_CODE = {
  "23505": "That already exists.",
  "23503": "That refers to something that no longer exists.",
  "23502": "Something required was missing. Please try again.",
  "23514": "That value is not allowed.",
  "42501": "You do not have permission to do that.",
  "42P01": "Something went wrong on our end. Please try again.",
  PGRST301: "Your session expired. Please sign in again.",
  PGRST116: "We could not find that.",
  "401": "Your session expired. Please sign in again.",
  "403": "You do not have permission to do that.",
  "429": "Too many requests. Please wait a moment and try again.",
  "500": "Something went wrong on our end. Please try again.",
  "503": "The service is briefly unavailable. Please try again.",
};

// Keyword → friendly message for common, recognisable cases (checked before passthrough).
const BY_KEYWORD = [
  [/captcha/i, "Captcha check failed. Please complete it and try again."],
  [/rate limit|too many/i, "Too many attempts. Please wait a moment and try again."],
  [/invalid login|invalid credentials/i, "Those sign-in details are not correct."],
  [/network|failed to fetch|load failed/i, "Network problem. Check your connection and try again."],
];

// Anything matching this is a raw database / internal error → never shown verbatim.
const LEAKY = /(\bselect\b|\binsert\b|\bupdate\b|\bdelete\s+from\b|\bfrom\s+\w|relation\s|column\s|constraint\b|row-level security|violates|syntax error|pg_|sqlstate|null value|duplicate key|\bschema\b)/i;

export function humanizeError(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  const code = err.code ?? err.status ?? err.statusCode;
  if (code != null && BY_CODE[String(code)]) return BY_CODE[String(code)];

  const msg = (typeof err === "string" ? err : err.message || "").trim();
  if (!msg) return fallback;

  for (const [re, friendly] of BY_KEYWORD) if (re.test(msg)) return friendly;
  if (LEAKY.test(msg)) return fallback;   // looks like raw DB/internal output → hide it
  if (msg.length > 160) return fallback;  // overly long/technical → hide it
  return msg;                             // short, clean, human-readable → safe to show
}
