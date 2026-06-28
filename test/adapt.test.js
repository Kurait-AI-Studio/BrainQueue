import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptWeights } from "../src/lib/adapt.js";

const DEFAULT_WEIGHTS = { urgency: 30, importance: 30, effort: 15, energy: 10, pleasure: 15 };
const mk = (n, attrs) => Array.from({ length: n }, (_, i) => ({ id: i, done: true, ...attrs }));

test("does not adapt below the minimum completions (stays generic)", () => {
  const r = adaptWeights(mk(4, { urgency: 5, importance: 5 }), DEFAULT_WEIGHTS);
  assert.equal(r.tuned, false);
  assert.deepEqual(r.weights, DEFAULT_WEIGHTS);
});

test("adapts once there are enough completions", () => {
  const r = adaptWeights(mk(12, { urgency: 5, importance: 3, effort: 3, energy: 3, pleasure: 3 }), DEFAULT_WEIGHTS);
  assert.equal(r.tuned, true);
  assert.equal(r.n, 12);
});

test("someone who finishes urgent tasks gets a higher urgency weight", () => {
  const base = DEFAULT_WEIGHTS;
  const urgent = adaptWeights(mk(15, { urgency: 5, importance: 3, effort: 3, energy: 3, pleasure: 3 }), base).weights;
  assert.ok(urgent.urgency > base.urgency, `expected urgency>${base.urgency}, got ${urgent.urgency}`);
});

test("someone who finishes quick, low-energy wins weights effort/energy up", () => {
  const base = DEFAULT_WEIGHTS;
  const quick = adaptWeights(mk(15, { urgency: 3, importance: 3, effort: 1, energy: 1, pleasure: 3 }), base).weights;
  assert.ok(quick.effort > base.effort, `expected effort>${base.effort}, got ${quick.effort}`);
  assert.ok(quick.energy > base.energy, `expected energy>${base.energy}, got ${quick.energy}`);
});

test("weights stay positive and finite", () => {
  const w = adaptWeights(mk(20, { urgency: 1, importance: 1, effort: 5, energy: 5, pleasure: 1 }), DEFAULT_WEIGHTS).weights;
  for (const k of Object.keys(w)) assert.ok(Number.isFinite(w[k]) && w[k] >= 1, `${k}=${w[k]}`);
});
