#!/usr/bin/env node
// Blind rating server for Brain Dump eval runs.
//
// Serves a small UI that shows each sample's model outputs ANONYMIZED (stable
// blind labels, shuffled position) so you rate quality without knowing which
// model produced what. Ratings auto-save; finishing writes a timestamped file
// and reveals the mapping + an aggregate ranking joined with cost/latency.
//
//   node eval/rate-server.mjs          → http://localhost:4321
//
// No external deps — Node 18+ built-ins only.

import { createServer } from "node:http";
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, "results");
const RATINGS_DIR = join(__dirname, "ratings");
const SESS_DIR = join(RATINGS_DIR, "_sessions");
const SAMPLES_DIR = join(__dirname, "..", "brain-dump-samples");
mkdirSync(SESS_DIR, { recursive: true });

// ── The metrics the user rates (1-5 each). Edit here to change the rubric. ─────
const METRICS = [
  { key: "coverage", label: "Coverage", help: "Caught every real task — nothing important missed." },
  { key: "precision", label: "Precision", help: "No junk — dropped headers, dates, done items and noise; invented nothing." },
  { key: "titles", label: "Titles", help: "Clean imperative wording, translated to English, deduped, list markers stripped." },
  { key: "attributes", label: "Attributes", help: "Category + urgency / importance / effort / energy are sensible." },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const blindCode = (i) => "Model " + String.fromCharCode(65 + i); // Model A, B, C…

function listRuns() {
  if (!existsSync(RESULTS_DIR)) return [];
  return readdirSync(RESULTS_DIR)
    .filter(d => existsSync(join(RESULTS_DIR, d, "cells.json")))
    .sort().reverse()
    .map(id => {
      const cells = JSON.parse(readFileSync(join(RESULTS_DIR, id, "cells.json"), "utf8"));
      const models = [...new Set(cells.map(c => c.modelId))];
      const samples = [...new Set(cells.map(c => c.sample))];
      return { id, models: models.length, samples: samples.length };
    });
}

function loadCells(runId) {
  return JSON.parse(readFileSync(join(RESULTS_DIR, runId, "cells.json"), "utf8"));
}

function dumpText(sample) {
  try { return readFileSync(join(SAMPLES_DIR, sample), "utf8"); } catch { return ""; }
}

// Build an anonymized session from a results run.
function startSession(runId) {
  const cells = loadCells(runId);
  const modelIds = [...new Set(cells.map(c => c.modelId))];
  const labels = Object.fromEntries(cells.map(c => [c.modelId, c.label]));

  // Stable blind label per model for this session, assigned in random order.
  const order = shuffle(modelIds);
  const mapping = Object.fromEntries(order.map((id, i) => [blindCode(i), { modelId: id, label: labels[id] }]));
  const codeOf = Object.fromEntries(order.map((id, i) => [id, blindCode(i)]));

  const samples = [...new Set(cells.map(c => c.sample))].sort();
  const anonSamples = samples.map(name => {
    const outs = cells.filter(c => c.sample === name).map(c => ({
      code: codeOf[c.modelId], ok: c.ok, error: c.error || null, tasks: c.tasks || [],
    }));
    return { name, dump: dumpText(name), outputs: shuffle(outs) }; // shuffle display order
  });

  const sessionId = randomUUID().slice(0, 8);
  const session = {
    sessionId, runId, createdAt: new Date().toISOString(),
    blindCodes: Object.keys(mapping), metrics: METRICS,
    mapping,                       // server-side only — never sent before finish
    ratings: {},                   // ratings[sample][code] = {metrics:{}, note}
    best: {},                      // best[sample] = code
  };
  writeFileSync(join(SESS_DIR, sessionId + ".json"), JSON.stringify(session, null, 2));
  return { session, anonSamples };
}

const sessionPath = (id) => join(SESS_DIR, id + ".json");
const loadSession = (id) => existsSync(sessionPath(id)) ? JSON.parse(readFileSync(sessionPath(id), "utf8")) : null;
const saveSession = (s) => writeFileSync(sessionPath(s.sessionId), JSON.stringify(s, null, 2));

// Public (blind) view of a session — strips the mapping.
function anonView(s) {
  const cells = loadCells(s.runId);
  const codeOf = Object.fromEntries(Object.entries(s.mapping).map(([code, m]) => [m.modelId, code]));
  const samples = [...new Set(cells.map(c => c.sample))].sort();
  // Re-derive a stable per-sample display order from saved ratings if present,
  // else shuffle fresh (only matters on resume; harmless).
  const anonSamples = samples.map(name => {
    const outs = cells.filter(c => c.sample === name).map(c => ({
      code: codeOf[c.modelId], ok: c.ok, error: c.error || null, tasks: c.tasks || [],
    }));
    return { name, dump: dumpText(name), outputs: shuffle(outs) };
  });
  return {
    sessionId: s.sessionId, runId: s.runId, metrics: s.metrics, blindCodes: s.blindCodes,
    samples: anonSamples, ratings: s.ratings, best: s.best,
  };
}

function finish(s) {
  const cells = loadCells(s.runId);
  // Per-model aggregates joined with cost/latency from the eval run.
  const perModel = {};
  for (const [code, m] of Object.entries(s.mapping)) {
    const mCells = cells.filter(c => c.modelId === m.modelId);
    const ok = mCells.filter(c => c.ok);
    const avgMs = ok.length ? Math.round(ok.reduce((a, c) => a + c.ms, 0) / ok.length) : 0;
    const totalCost = mCells.reduce((a, c) => a + (c.cost || 0), 0);
    const costPer1k = mCells.length ? (totalCost / mCells.length) * 1000 : 0;

    // Average each metric across rated samples.
    const metricSums = {}, metricN = {};
    let bestPicks = 0;
    for (const sample of Object.keys(s.ratings)) {
      const r = s.ratings[sample]?.[code];
      if (r?.metrics) for (const mk of Object.keys(r.metrics)) {
        const v = Number(r.metrics[mk]);
        if (v) { metricSums[mk] = (metricSums[mk] || 0) + v; metricN[mk] = (metricN[mk] || 0) + 1; }
      }
    }
    for (const sample of Object.keys(s.best)) if (s.best[sample] === code) bestPicks++;
    const metricAvg = {};
    for (const mk of METRICS.map(x => x.key)) metricAvg[mk] = metricN[mk] ? +(metricSums[mk] / metricN[mk]).toFixed(2) : null;
    const rated = Object.values(metricAvg).filter(v => v != null);
    const quality = rated.length ? +(rated.reduce((a, b) => a + b, 0) / rated.length).toFixed(2) : null;

    perModel[code] = { code, modelId: m.modelId, label: m.label, avgMs, costPer1k, metricAvg, quality, bestPicks };
  }

  const ranking = Object.values(perModel).sort((a, b) => (b.quality ?? -1) - (a.quality ?? -1));
  s.finishedAt = new Date().toISOString();
  s.aggregates = { perModel, ranking };
  saveSession(s);

  // Permanent timestamped record (includes mapping + ratings + aggregates).
  const stamp = s.finishedAt.replace(/[:.]/g, "-").slice(0, 19);
  const outPath = join(RATINGS_DIR, `${stamp}__${s.runId}.json`);
  writeFileSync(outPath, JSON.stringify({
    ratedAt: s.finishedAt, runId: s.runId, sessionId: s.sessionId,
    metrics: s.metrics, mapping: s.mapping, ratings: s.ratings, best: s.best, aggregates: s.aggregates,
  }, null, 2));
  return { mapping: s.mapping, aggregates: s.aggregates, savedAs: `eval/ratings/${stamp}__${s.runId}.json` };
}

function listFinished() {
  if (!existsSync(RATINGS_DIR)) return [];
  return readdirSync(RATINGS_DIR)
    .filter(f => f.endsWith(".json") && !f.startsWith("draft"))
    .sort().reverse()
    .map(f => ({ file: f, mtime: statSync(join(RATINGS_DIR, f)).mtime.toISOString() }));
}

// ── HTTP ────────────────────────────────────────────────────────────────────---
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise(r => { let d = ""; req.on("data", c => d += c); req.on("end", () => r(d ? JSON.parse(d) : {})); });

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;

    if (p === "/" || p === "/index.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(readFileSync(join(__dirname, "rater.html")));
    }
    if (p === "/api/runs") return json(res, 200, listRuns());
    if (p === "/api/sessions") return json(res, 200, listFinished());

    if (p === "/api/session/start" && req.method === "POST") {
      const { runId } = await readBody(req);
      if (!existsSync(join(RESULTS_DIR, runId, "cells.json"))) return json(res, 404, { error: "run not found" });
      const { session, anonSamples } = startSession(runId);
      return json(res, 200, {
        sessionId: session.sessionId, runId, metrics: session.metrics,
        blindCodes: session.blindCodes, samples: anonSamples, ratings: {}, best: {},
      });
    }

    const m = p.match(/^\/api\/session\/([\w-]+)\/(\w+)$/);
    if (m) {
      const s = loadSession(m[1]);
      if (!s) return json(res, 404, { error: "session not found" });
      const action = m[2];
      if (action === "state") return json(res, 200, anonView(s));
      if (action === "rating" && req.method === "POST") {
        const b = await readBody(req);
        if (b.best !== undefined) { s.best[b.sample] = b.best; }
        else {
          s.ratings[b.sample] = s.ratings[b.sample] || {};
          s.ratings[b.sample][b.code] = { metrics: b.metrics || {}, note: b.note || "" };
        }
        saveSession(s);
        return json(res, 200, { ok: true });
      }
      if (action === "finish" && req.method === "POST") return json(res, 200, finish(s));
    }

    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

const PORT = process.env.PORT || 4321;
server.listen(PORT, () => {
  console.log(`\n  Blind rating UI → http://localhost:${PORT}\n`);
  const runs = listRuns();
  if (runs.length) console.log(`  Latest eval run: ${runs[0].id} (${runs[0].models} models × ${runs[0].samples} samples)\n`);
  else console.log(`  No eval runs yet — run \`node eval/run-eval.mjs\` first.\n`);
});
