#!/usr/bin/env node
// Blind head-to-head: Claude Sonnet 4.6 vs GPT-4.1 mini on the Brain Dump task.
// Runs every sample in brain-dump-samples/ through BOTH models using the SAME shipped
// prompt + schema, tags each by difficulty, RANDOMLY assigns each model to the left/right
// side, and HIDES which model is which. Open eval/duel.html to rate blind, then reveal.
//
//   node eval/duel.mjs          # needs ANTHROPIC_API_KEY + OPENAI_API_KEY in .env
//
// Output: eval/duel/data.js  (window.DUEL_CASES + window.DUEL_KEY, the key only shown on reveal)
import "dotenv/config";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAIN_DUMP_SYSTEM, TASK_LIST_SCHEMA, sanitizeTask } from "../src/brainDumpSpec.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Match the app: inject today's date so the model resolves relative deadlines (v3).
const SYSTEM = `${BRAIN_DUMP_SYSTEM}\n\nToday's date is ${new Date().toISOString().slice(0, 10)}.`;

// The two contenders.
const A = { id: "sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", model: "claude-sonnet-4-6", price: { in: 3, out: 15 } };
const B = { id: "gpt-4-1-mini", label: "GPT-4.1 mini", provider: "openai", model: "gpt-4.1-mini", price: { in: 0.4, out: 1.6 } };

// Difficulty by sample number (see brain-dump-samples/). easy = clean/short,
// medium = structured/varied, hard = messy/multilingual/noisy/long.
const DIFFICULTY = {
  easy: ["03", "04", "17", "18", "21"],
  medium: ["02", "05", "06", "09", "10", "12", "15", "16", "19", "20", "23", "24", "25"],
  hard: ["01", "07", "08", "11", "13", "14", "22", "26"],
};
const diffOf = (name) => {
  const num = name.slice(0, 2);
  for (const [d, nums] of Object.entries(DIFFICULTY)) if (nums.includes(num)) return d;
  return "medium";
};

async function callAnthropic(m, text) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: m.model, max_tokens: 8000, system: SYSTEM, output_config: { format: { type: "json_schema", schema: TASK_LIST_SCHEMA } }, messages: [{ role: "user", content: text }] }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || ""}`);
  return { text: data.content?.find((b) => b.type === "text")?.text ?? "", inTok: data.usage?.input_tokens ?? 0, outTok: data.usage?.output_tokens ?? 0 };
}
async function callOpenAI(m, text) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: m.model, max_tokens: 8000, temperature: 0, response_format: { type: "json_schema", json_schema: { name: "task_list", strict: true, schema: TASK_LIST_SCHEMA } }, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: text }] }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || ""}`);
  return { text: data.choices?.[0]?.message?.content ?? "", inTok: data.usage?.prompt_tokens ?? 0, outTok: data.usage?.completion_tokens ?? 0 };
}
const call = (m, text) => (m.provider === "anthropic" ? callAnthropic(m, text) : callOpenAI(m, text));

async function run(m, text) {
  const t0 = Date.now();
  const { text: out, inTok, outTok } = await call(m, text);
  const tasks = (JSON.parse(out).tasks || []).map(sanitizeTask);
  const cost = (inTok / 1e6) * m.price.in + (outTok / 1e6) * m.price.out;
  return { tasks, cost: +cost.toFixed(6), ms: Date.now() - t0, nTasks: tasks.length };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error("Need ANTHROPIC_API_KEY and OPENAI_API_KEY in .env"); process.exit(1);
  }
  const dir = join(__dirname, "../brain-dump-samples");
  const samples = readdirSync(dir).filter((f) => /\.(txt|md|csv)$/i.test(f) && f.toLowerCase() !== "readme.md").sort()
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), "utf8"), difficulty: diffOf(f) }));

  console.log(`Dueling ${A.label} vs ${B.label} on ${samples.length} samples (${samples.length * 2} calls)…`);
  const cases = [], key = {};
  let i = 0;
  for (const s of samples) {
    i++;
    process.stdout.write(`  [${i}/${samples.length}] ${s.name} (${s.difficulty})… `);
    try {
      const [ra, rb] = await Promise.all([run(A, s.text), run(B, s.text)]);
      const aLeft = Math.random() < 0.5; // randomize which model is on the left
      const left = aLeft ? { m: A, r: ra } : { m: B, r: rb };
      const right = aLeft ? { m: B, r: rb } : { m: A, r: ra };
      cases.push({ id: s.name, difficulty: s.difficulty, sample_name: s.name, sample_text: s.text, left: { tasks: left.r.tasks }, right: { tasks: right.r.tasks } });
      key[s.name] = { left_model: left.m.label, right_model: right.m.label, left_cost: left.r.cost, right_cost: right.r.cost, a_cost: ra.cost, b_cost: rb.cost };
      console.log(`ok (${ra.nTasks} vs ${rb.nTasks} tasks)`);
    } catch (e) { console.log(`FAILED: ${e.message}`); }
  }

  const outDir = join(__dirname, "duel");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "data.js"), `window.DUEL_CASES = ${JSON.stringify(cases, null, 1)};\nwindow.DUEL_KEY = ${JSON.stringify(key, null, 1)};\n`);
  const aTot = Object.values(key).reduce((s, k) => s + k.a_cost, 0);
  const bTot = Object.values(key).reduce((s, k) => s + k.b_cost, 0);
  console.log(`\nWrote ${cases.length} cases → eval/duel/data.js`);
  console.log(`Total cost this run: ${A.label} $${aTot.toFixed(4)} | ${B.label} $${bTot.toFixed(4)} (per-dump avg: $${(aTot / cases.length).toFixed(5)} vs $${(bTot / cases.length).toFixed(5)})`);
  console.log(`Now open eval/duel.html in a browser and rate blind.`);
}
main();
