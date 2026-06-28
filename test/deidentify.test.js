import { test } from "node:test";
import assert from "node:assert/strict";
import { redactPII, deidentifyTask, FIELD_ATTENTION } from "../src/lib/deidentify.js";

test("redacts emails", () => {
  assert.equal(redactPII("email john.doe@gmail.com about it"), "email [EMAIL] about it");
});

test("redacts URLs (incl. tokens)", () => {
  assert.equal(redactPII("see https://x.com/reset?token=abc123"), "see [URL]");
});

test("redacts card-like and long ID numbers", () => {
  assert.equal(redactPII("card 4111 1111 1111 1111"), "card [CARD]");
  // A bare 10-digit run is ambiguous (phone vs account); either way it must be redacted.
  assert.match(redactPII("account 1234567890"), /\[(NUMBER|PHONE)\]/);
});

test("redacts IBAN", () => {
  assert.equal(redactPII("iban FR7630006000011234567890189"), "iban [IBAN]");
});

test("keeps ordinary task prose untouched", () => {
  assert.equal(redactPII("Write the project research brief"), "Write the project research brief");
});

test("deidentifyTask scrubs free-text fields, keeps structured ones", () => {
  const t = {
    title: "Call mom at 06 12 34 56 78",
    notes: "she's at jane@work.com",
    category: "Personal",
    urgency: 4,
    ai_delegatable: false,
  };
  const out = deidentifyTask(t);
  assert.match(out.title, /\[PHONE\]/);
  assert.equal(out.notes, "she's at [EMAIL]");
  assert.equal(out.category, "Personal"); // structured, untouched
  assert.equal(out.urgency, 4);
  assert.equal(out.ai_delegatable, false);
});

test("free-text fields are the ones flagged high attention", () => {
  assert.equal(FIELD_ATTENTION.title, "high");
  assert.equal(FIELD_ATTENTION.notes, "high");
  assert.equal(FIELD_ATTENTION.category, "low");
  assert.equal(FIELD_ATTENTION.urgency, "low");
});
