import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONSENT_VERSION, DEFAULT_CONSENT, CONSENT_LEVELS, normalizeConsent, isTrainingEligible,
} from "../src/lib/consent.js";

test("default consent is product-only (training is opt-in, never the default)", () => {
  assert.equal(DEFAULT_CONSENT, "product-only");
  const trainDefault = CONSENT_LEVELS.find((l) => l.id === DEFAULT_CONSENT);
  assert.equal(trainDefault.train, false);
});

test("exactly one level enables training, and it is 'full'", () => {
  const training = CONSENT_LEVELS.filter((l) => l.train);
  assert.equal(training.length, 1);
  assert.equal(training[0].id, "full");
});

test("normalizeConsent rejects unknown values and falls back to the default", () => {
  assert.equal(normalizeConsent("full"), "full");
  assert.equal(normalizeConsent("product-only"), "product-only");
  assert.equal(normalizeConsent("none"), "none");
  assert.equal(normalizeConsent("yes-train-everything"), "product-only");
  assert.equal(normalizeConsent(undefined), "product-only");
});

test("training eligibility requires explicit 'full' consent", () => {
  assert.equal(isTrainingEligible({ consent_state: "full" }), true);
  assert.equal(isTrainingEligible({ consent_state: "product-only" }), false);
  assert.equal(isTrainingEligible({ consent_state: "none" }), false);
  assert.equal(isTrainingEligible({}), false);
  assert.equal(isTrainingEligible(null), false);
});

test("provider-sourced data is excluded from training even with full consent", () => {
  assert.equal(isTrainingEligible({ consent_state: "full", source: "google" }), false);
  assert.equal(isTrainingEligible({ consent_state: "full", source: "microsoft" }), false);
  assert.equal(isTrainingEligible({ consent_state: "full", source: "provider" }), false);
  assert.equal(isTrainingEligible({ consent_state: "full", context: { source: "google" } }), false);
  assert.equal(isTrainingEligible({ consent_state: "full", source: "user" }), true);
});

test("a consent version is set (so each choice is auditable to a wording)", () => {
  assert.match(CONSENT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
});
