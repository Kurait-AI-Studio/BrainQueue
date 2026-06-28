# Telemetry change checklist (read before changing what we capture)

The event log feeds — optionally, and only with consent — model training. So **any** change
to telemetry (a new `event_type`, a new field in `context`, a new piece of data captured, or
a new data source) can change our legal and privacy posture. Before merging such a change,
confirm every box:

- [ ] **Consent stamping** — the event still carries the correct `consent_state` (stamped
      automatically by `logEvent`; never write events around `logEvent`).
- [ ] **Provenance / source** — is the new data user-authored or third-party-derived? Pass
      the right `source` to `logEvent` (4th arg). Data from Google / Microsoft APIs MUST be
      tagged `"google"` / `"microsoft"` — never `"user"`.
- [ ] **Training gate** — `src/lib/consent.js#isTrainingEligible` still excludes everything
      that must not be trained on (non-`full` consent, provider-sourced data).
- [ ] **Google policy** — confirm no Google-derived data can reach a training set. Google's
      API Services User Data Policy forbids training on its data, and this is required to keep
      OAuth verification.
- [ ] **De-identification** — does the new field carry free-text PII? If so add it to
      `src/lib/deidentify.js#FIELD_ATTENTION` (level `high`) so it gets scrubbed.
- [ ] **Schema version** — if the envelope shape changes, bump `SCHEMA_VERSION` and add a
      `schema_registry` row.
- [ ] **Docs** — update `docs/legal/privacy-policy.md` (§2 data inventory, §4 training) and
      the cookie notice if a new *category* of data is collected.
- [ ] **Tests** — extend `test/consent.test.js` / `test/deidentify.test.js` if the rules move.

**Why this file exists:** the friendly "Memory" framing and the consent toggle only stay
*valid* if what we actually capture keeps matching what we told users (privacy policy) and
what the law (GDPR) and Google require. **Capture and disclosure must never drift apart.**
