import { test } from "node:test";
import assert from "node:assert/strict";
import { similarity, findSimilar } from "../src/lib/similar.js";

test("identical text scores 1", () => {
  assert.equal(similarity("call the bank", "call the bank"), 1);
});

test("near-duplicates score high", () => {
  assert.ok(similarity("Call the bank about the card", "call bank about card") >= 0.5);
});

test("unrelated text scores low", () => {
  assert.ok(similarity("Buy groceries", "Finish the quarterly report") < 0.2);
});

test("findSimilar returns a match above threshold", () => {
  const m = findSimilar("Pay the electricity bill", ["Buy batteries", "pay electricity bill now"], 0.5);
  assert.ok(m && /electricity/.test(typeof m.match === "string" ? m.match : m.match.title));
});

test("findSimilar returns null when nothing is similar", () => {
  assert.equal(findSimilar("Water the plants", ["Refactor the auth module"], 0.5), null);
});
