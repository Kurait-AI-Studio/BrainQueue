// ─── Data-use consent ────────────────────────────────────────────────────────
// The legal + technical backbone for using customer data, including (optionally)
// training models on it. Encodes the rules from the privacy policy (§4):
//
//  1. Model training is a SEPARATE, OPTIONAL opt-in — never bundled with signup.
//     GDPR requires consent to be freely given, so the app must work fully at every
//     level. The default is "product-only" (run the service, do NOT train).
//  2. Three levels map to the telemetry `consent_state` flag, stamped on every event:
//       full          → personalize AND train/improve models
//       product-only  → operate the service for the user only (no training)
//       none          → collect only what is strictly necessary
//     Each change is recorded with a consent VERSION + timestamp (see client.updateConsent).
//  3. Training data must be DE-IDENTIFIED first, and data obtained via third-party
//     providers (Google / Microsoft) is EXCLUDED — Google's API policy forbids training
//     on its data, and it's required to pass Google OAuth verification.
//  4. Consent is withdrawable anytime; withdrawal stops future use, and the user's raw
//     training-eligible data is deleted on request (see requestTrainingDataDeletion).

// Bump when the consent wording / scope changes; stored with each consent choice so we
// can prove which version a user agreed to. Keep in sync with the privacy policy date.
export const CONSENT_VERSION = "2026-06-28";

export const DEFAULT_CONSENT = "product-only";

// Shown in Settings. `train` marks the level that permits model training.
export const CONSENT_LEVELS = [
  {
    id: "full",
    label: "Help improve BrainQueue",
    blurb: "Use my data (de-identified) to personalize my experience and to train and improve BrainQueue's models.",
    train: true,
  },
  {
    id: "product-only",
    label: "Run the service only",
    blurb: "Use my data only to operate BrainQueue for me. Do not use it to train models.",
    train: false,
  },
  {
    id: "none",
    label: "Minimal",
    blurb: "Collect only what is strictly necessary to run the app.",
    train: false,
  },
];

const VALID = new Set(CONSENT_LEVELS.map((l) => l.id));

export function normalizeConsent(value) {
  return VALID.has(value) ? value : DEFAULT_CONSENT;
}

// THE training-eligibility gate. The (future) training/export pipeline MUST call this
// for every record and only keep those that pass — this is where rules 1–3 are enforced:
//  - explicit `full` consent, and
//  - the data is not sourced from a third-party provider (Google/Microsoft).
// De-identification is a separate transform applied to the records that pass here, before
// they ever reach a training set (never train on raw, directly-identifying data).
export function isTrainingEligible(event) {
  if (!event || event.consent_state !== "full") return false;
  // `source: "provider"` (or context.source) flags provider-derived data → excluded.
  const source = event.source ?? event.context?.source;
  if (source === "provider" || source === "google" || source === "microsoft") return false;
  return true;
}
