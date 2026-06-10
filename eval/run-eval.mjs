#!/usr/bin/env node
// Brain Dump model benchmark.
//
// Runs every sample in brain-dump-samples/ through every enabled model in
// models.config.json, using the SAME system prompt + JSON schema the app ships
// (imported from ../src/brainDumpSpec.js), and writes a side-by-side report so
// you can decide whether a cheap/old/open-source model is good enough.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node eval/run-eval.mjs
//   OPENROUTER_API_KEY=sk-or-... node eval/run-eval.mjs        (after enabling OSS models)
//   node eval/run-eval.mjs --only haiku-4-5,sonnet-4-6         (subset by id)
//   node eval/run-eval.mjs --samples 01,26                     (subset of samples)
//
// Node 18+ (global fetch). Loads keys from .env via dotenv.

import "dotenv/config";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRAIN_DUMP_SYSTEM,
  TASK_LIST_SCHEMA,
  sanitizeTask,
  CATEGORIES,
} from "../src/brainDumpSpec.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(join(__dirname, "models.config.json"), "utf8"));

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const argVal = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const onlyModels = argVal("--only")?.split(",").map(s => s.trim());
const onlySamples = argVal("--samples")?.split(",").map(s => s.trim());

// ── Load samples ──────────────────────────────────────────────────────────────
const samplesDir = join(__dirname, cfg.samplesDir);
let samples = readdirSync(samplesDir)
  .filter(f => /\.(txt|md|csv)$/i.test(f) && f.toLowerCase() !== "readme.md")
  .sort()
  .map(f => ({ name: f, text: readFileSync(join(samplesDir, f), "utf8") }));
if (onlySamples) samples = samples.filter(s => onlySamples.some(p => s.name.includes(p)));

let models = cfg.models.filter(m => m.enabled);
if (onlyModels) models = cfg.models.filter(m => onlyModels.includes(m.id));

if (!models.length) { console.error("No models selected/enabled. Edit eval/models.config.json or pass --only."); process.exit(1); }
if (!samples.length) { console.error("No samples found in " + samplesDir); process.exit(1); }

console.log(`\nBenchmarking ${models.length} model(s) × ${samples.length} sample(s) = ${models.length * samples.length} calls\n`);

// ── Tolerant JSON extraction (for models without native schema support) ────────
function extractTasks(text) {
  let s = String(text).replace(/```json|```/g, "").trim();
  // Prefer a top-level object with a `tasks` array; fall back to a bare array.
  const obj = s.match(/\{[\s\S]*\}/);
  const arr = s.match(/\[[\s\S]*\]/);
  for (const candidate of [obj?.[0], arr?.[0]]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.tasks)) return parsed.tasks;
    } catch { /* try next */ }
  }
  throw new Error("Could not parse a task list from model output");
}

// ── Providers ─────────────────────────────────────────────────────────────────
async function callAnthropic(m, userText) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: m.model,
      max_tokens: m.maxTokens || 8000,
      system: BRAIN_DUMP_SYSTEM,
      output_config: { format: { type: "json_schema", schema: TASK_LIST_SCHEMA } },
      messages: [{ role: "user", content: userText }],
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 200)}`);
  const text = data.content?.find(b => b.type === "text")?.text ?? "";
  return { text, inTok: data.usage?.input_tokens ?? 0, outTok: data.usage?.output_tokens ?? 0 };
}

async function callOpenAICompatible(m, userText) {
  const key = process.env[m.apiKeyEnv] || "x";
  const body = {
    model: m.model,
    max_tokens: m.maxTokens || 8000,
    temperature: m.temperature ?? 0,
    messages: [
      { role: "system", content: BRAIN_DUMP_SYSTEM + "\n\nReturn a JSON object: { \"tasks\": [ ... ] }." },
      { role: "user", content: userText },
    ],
  };
  if (m.jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: { name: "task_list", strict: true, schema: TASK_LIST_SCHEMA } };
  } else {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch(m.baseUrl.replace(/\/$/, "") + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`HTTP ${res.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 200)}`);
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text, inTok: data.usage?.prompt_tokens ?? 0, outTok: data.usage?.completion_tokens ?? 0 };
}

async function runCell(m, sample) {
  const t0 = performance.now();
  try {
    const { text, inTok, outTok } = m.provider === "anthropic"
      ? await callAnthropic(m, sample.text)
      : await callOpenAICompatible(m, sample.text);
    const rawTasks = extractTasks(text);
    const tasks = rawTasks.map(sanitizeTask);
    const ms = Math.round(performance.now() - t0);
    const cost = (inTok / 1e6) * (m.price?.in ?? 0) + (outTok / 1e6) * (m.price?.out ?? 0);
    return { ok: true, ms, inTok, outTok, cost, nTasks: tasks.length, tasks };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - t0), error: e.message, nTasks: 0, tasks: [], inTok: 0, outTok: 0, cost: 0 };
  }
}

// ── Simple concurrency pool ────────────────────────────────────────────────────
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx], idx); }
  }));
  return out;
}

// ── Run ─────────────────────────────────────────────────────────────────────--
const jobs = [];
for (const m of models) for (const s of samples) jobs.push({ m, s });

let done = 0;
const cells = await pool(jobs, cfg.concurrency || 4, async ({ m, s }) => {
  const r = await runCell(m, s);
  done++;
  const status = r.ok ? `${String(r.nTasks).padStart(2)} tasks  ${String(r.ms).padStart(5)}ms  $${r.cost.toFixed(5)}` : `FAIL: ${r.error}`;
  console.log(`[${String(done).padStart(3)}/${jobs.length}] ${m.label.padEnd(22)} ${s.name.padEnd(34)} ${status}`);
  return { modelId: m.id, label: m.label, sample: s.name, ...r };
});

// ── Aggregate ──────────────────────────────────────────────────────────────────
const byModel = new Map(models.map(m => [m.id, { m, cells: [] }]));
for (const c of cells) byModel.get(c.modelId).cells.push(c);

const summary = [...byModel.values()].map(({ m, cells }) => {
  const ok = cells.filter(c => c.ok);
  const totalCost = cells.reduce((a, c) => a + c.cost, 0);
  const totalTasks = ok.reduce((a, c) => a + c.nTasks, 0);
  const avgMs = ok.length ? Math.round(ok.reduce((a, c) => a + c.ms, 0) / ok.length) : 0;
  return {
    id: m.id, label: m.label, provider: m.provider, model: m.model,
    runs: cells.length, failures: cells.length - ok.length,
    totalTasks, avgMs, totalCost,
    costPer1k: totalCost ? (totalCost / cells.length) * 1000 : 0,
  };
});

// ── Write results ───────────────────────────────────────────────────────────---
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = join(__dirname, "results", stamp);
mkdirSync(outDir, { recursive: true });

// Per-model full output (tasks for every sample) for eyeballing quality.
for (const { m, cells } of byModel.values()) {
  writeFileSync(join(outDir, `${m.id}.json`), JSON.stringify({ model: m, cells }, null, 2));
}
writeFileSync(join(outDir, "cells.json"), JSON.stringify(cells, null, 2));

// Markdown report.
const fmt$ = (n) => "$" + n.toFixed(n < 0.01 ? 5 : 4);
let md = `# Brain Dump model benchmark — ${stamp}\n\n`;
md += `Same system prompt + JSON schema as the app. ${samples.length} samples per model.\n\n`;
md += `## Summary\n\n`;
md += `| Model | Provider | Failures | Tasks (total) | Avg latency | Total cost | Cost / 1k dumps |\n`;
md += `| --- | --- | --- | --- | --- | --- | --- |\n`;
for (const s of summary.sort((a, b) => a.totalCost - b.totalCost)) {
  md += `| ${s.label} | ${s.provider} | ${s.failures} | ${s.totalTasks} | ${s.avgMs}ms | ${fmt$(s.totalCost)} | ${fmt$(s.costPer1k)} |\n`;
}

// Per-sample task-count matrix (quick way to spot a model under/over-extracting).
md += `\n## Tasks extracted per sample\n\n`;
md += `| Sample | ${summary.map(s => s.label).join(" | ")} |\n`;
md += `| --- | ${summary.map(() => "---").join(" | ")} |\n`;
for (const s of samples) {
  const row = summary.map(sm => {
    const c = cells.find(x => x.modelId === sm.id && x.sample === s.name);
    return c?.ok ? String(c.nTasks) : "✗";
  });
  md += `| ${s.name} | ${row.join(" | ")} |\n`;
}

md += `\n## How to read this\n\n`;
md += `- **Failures** = calls that errored or returned unparseable output. A non-zero count for a model means it can't reliably hold the format.\n`;
md += `- **Cost / 1k dumps** = projected spend if you ran 1,000 brain dumps through that model. This is your "is it cheap enough" number.\n`;
md += `- **Tasks per sample** — compare columns. Wildly higher counts often mean over-splitting or failing to drop completed/noise lines; much lower counts mean missed tasks. Open the per-model \`<id>.json\` to read the actual titles + scores and judge quality.\n`;
md += `- Categories the schema allows: ${CATEGORIES.join(", ")}.\n`;

const reportPath = join(outDir, "report.md");
writeFileSync(reportPath, md);

console.log(`\n${"─".repeat(70)}`);
console.log("Summary (cheapest first):\n");
for (const s of summary.sort((a, b) => a.totalCost - b.totalCost)) {
  console.log(`  ${s.label.padEnd(24)} fails:${s.failures}  tasks:${s.totalTasks}  ${s.avgMs}ms  ${fmt$(s.totalCost)}  (${fmt$(s.costPer1k)}/1k)`);
}
console.log(`\nFull report + per-model outputs: ${reportPath.replace(process.cwd() + "/", "")}\n`);
