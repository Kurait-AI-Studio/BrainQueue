// Brain Dump: paste messy notes → an LLM extracts + scores tasks → you edit → add.
// Also the "correction goldmine": logs the model's v1, every edit/removal, and the
// final commit so the learning loop can later improve the generator (Capture Spec §1).
import { useState, useEffect, useRef } from "react";
import { glass, glassStrong } from "./tokens";
import { GlassButton } from "./GlassButton";
import { Dim } from "./misc";
import { TierBadge } from "./TierBadge";
import { getSupabase, logEvent, setSurface } from "../lib/client";
import { CAT_ACCENT, calcScore } from "../lib/tasks";
import {
  CATEGORIES, BRAIN_DUMP_MODEL, BRAIN_DUMP_MODELS, BRAIN_DUMP_PROVIDER,
  BRAIN_DUMP_PROMPT_VERSION, BRAIN_DUMP_MAX_TOKENS, BRAIN_DUMP_SYSTEM,
  TASK_LIST_SCHEMA, sanitizeTask,
} from "../brainDumpSpec";

const DUMP_DIFF_FIELDS = ["title", "category", "urgency", "importance", "effort", "energy", "pleasure", "est_minutes", "cognitive_load", "ai_delegatable", "multi_step", "recurrence"];
// Coarse edit_type tag at capture time (spec: ideally a cheap classification call;
// a heuristic is far better than nothing and lets us filter typos from signal later).
const editTypeFor = (field) =>
  field === "title" ? "reword"
  : field === "category" ? "retag"
  : field === "recurrence" ? "reschedule"
  : ["urgency", "importance", "effort", "energy", "pleasure"].includes(field) ? "reprioritize"
  : "field_edit";
const sameVal = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function BrainDumpModal({ onClose, onTasksAdded, weights }) {
  const [dump, setDump] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  // Capture state for the correction goldmine.
  const dumpIdRef = useRef(null);          // ties brain_dump_created → parse_* → final_committed
  const originalRef = useRef(null);        // the AI's untouched v1, to diff against on commit
  const parsedAtRef = useRef(0);           // when the preview appeared (time-to-commit clock)

  // Tag this surface for the envelope while the modal is mounted.
  useEffect(() => { setSurface("web:braindump"); return () => setSurface("web"); }, []);

  const parseDump = async () => {
    if (!dump.trim()) return;
    setLoading(true); setError(null);
    const dumpId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
    dumpIdRef.current = dumpId;
    // Principle 1 (log raw input) + 2 (version the generator).
    logEvent("brain_dump_created", null, { dump_id: dumpId, raw_text: dump, char_count: dump.length, input_method: "typed" });
    logEvent("parse_requested", null, { dump_id: dumpId, prompt_version: BRAIN_DUMP_PROMPT_VERSION, model_id: BRAIN_DUMP_MODEL, provider: BRAIN_DUMP_PROVIDER, params: { max_tokens: BRAIN_DUMP_MAX_TOKENS } });
    const t0 = performance.now();
    try {
      // Call the server-side "brain-dump" edge function (which holds the Anthropic
      // key) with the user's session token — the key is never in the browser.
      const sb = getSupabase();
      const { data: { session } = { session: null } } = sb ? await sb.auth.getSession() : { data: { session: null } };
      if (!session) throw new Error("Please sign in again to run Brain Dump.");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/brain-dump`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          dump,
          system: BRAIN_DUMP_SYSTEM,
          // Structured outputs: the model is constrained to this schema, so the
          // response text is guaranteed-valid JSON — no markdown fences, no
          // regex scraping, no truncation surprises.
          schema: TASK_LIST_SCHEMA,
          provider: BRAIN_DUMP_PROVIDER,
          model: BRAIN_DUMP_MODEL,
          max_tokens: BRAIN_DUMP_MAX_TOKENS,
        })
      });
      const rawText = await response.text();
      if (!response.ok) {
        // Surface the server's clean message (e.g. the daily-cap notice) when present.
        let msg = `HTTP ${response.status}: ${rawText.slice(0, 300)}`;
        try { const j = JSON.parse(rawText); if (j?.error) msg = j.error; } catch { /* keep raw */ }
        throw new Error(msg);
      }
      const data = JSON.parse(rawText);
      if (data.error) throw new Error(`API: ${data.error.message}`);
      const textBlock = data.content?.find(b => b.type === "text");
      if (!textBlock) throw new Error("No text in response");
      const result = JSON.parse(textBlock.text);
      const tasks = (result.tasks || []).map(sanitizeTask);
      if (!tasks.length) throw new Error("No actionable tasks found in that dump.");
      // Stable per-task ref so edits/removals stay matched to the original across the diff.
      const withPid = tasks.map((t, i) => ({ ...t, _pid: `${dumpId}:${i}` }));
      // Principle 1: the raw model output is irreplaceable. Estimate cost from usage,
      // priced per the chosen model (the edge function normalises every provider's
      // token counts into input_tokens / output_tokens, so this is provider-agnostic).
      const usage = data.usage || {};
      const price = BRAIN_DUMP_MODELS[BRAIN_DUMP_MODEL] || { price_in: 0, price_out: 0 };
      const cost_est = usage.input_tokens != null
        ? +(usage.input_tokens / 1e6 * price.price_in + (usage.output_tokens || 0) / 1e6 * price.price_out).toFixed(6) : null;
      logEvent("parse_result", null, {
        dump_id: dumpId, prompt_version: BRAIN_DUMP_PROMPT_VERSION, model_id: BRAIN_DUMP_MODEL, provider: BRAIN_DUMP_PROVIDER,
        raw_model_output: textBlock.text, parsed_tasks: tasks, latency_ms: Math.round(performance.now() - t0),
        tokens_in: usage.input_tokens ?? null, tokens_out: usage.output_tokens ?? null, cost_est,
      });
      originalRef.current = withPid.map(t => ({ ...t }));   // deep-enough snapshot of v1
      parsedAtRef.current = performance.now();
      setParsed(withPid);
    } catch (e) {
      setError(e.message);
      logEvent("parse_failed", null, { dump_id: dumpId, error: String(e.message).slice(0, 300), latency_ms: Math.round(performance.now() - t0) });
    }
    setLoading(false);
  };

  const updateTask = (i, patch) => setParsed(p => p.map((t, j) => j === i ? { ...t, ...patch } : t));
  const removeTask = (i) => setParsed(p => p.filter((_, j) => j !== i));

  // The v1 → final delta. Every kept-unchanged field is a positive label (principle 7),
  // every edit is a preference pair (principle 1) — log both, fully reconstructable.
  // `idMap` (_pid → committed task id) and `finalTasks` (the human-corrected v_final)
  // make final_committed a self-contained training record: the supervised pair is a
  // direct read (parse_result.parsed_tasks → final_tasks) instead of an edit replay,
  // and task_id_map links each model output to the task's downstream outcome
  // (completed / postponed / deleted), the strongest label of all.
  const logCorrections = (idMap, finalTasks) => {
    const dumpId = dumpIdRef.current;
    const orig = originalRef.current || [];
    const finalByPid = new Map(parsed.map(t => [t._pid, t]));
    let nEdits = 0, nRemoved = 0, nAccepted = 0;
    const editTypes = {};
    for (const o of orig) {
      const f = finalByPid.get(o._pid);
      if (!f) {
        nRemoved++; editTypes.delete = (editTypes.delete || 0) + 1;
        logEvent("task_edited", null, { dump_id: dumpId, task_ref: o._pid, edit_type: "delete", field: null });
        continue;
      }
      const changed = DUMP_DIFF_FIELDS.filter(field => !sameVal(o[field], f[field]));
      if (changed.length === 0) {
        nAccepted++;
        logEvent("task_accepted_unchanged", null, { dump_id: dumpId, task_ref: o._pid, fields: DUMP_DIFF_FIELDS });
      } else {
        for (const field of changed) {
          nEdits++;
          const et = editTypeFor(field);
          editTypes[et] = (editTypes[et] || 0) + 1;
          logEvent("task_edited", null, { dump_id: dumpId, task_ref: o._pid, field, before: o[field] ?? null, after: f[field] ?? null, edit_type: et });
        }
      }
    }
    logEvent("final_committed", null, {
      dump_id: dumpId, n_tasks: parsed.length, n_edits: nEdits, n_removed: nRemoved, n_accepted: nAccepted,
      edit_types: editTypes, time_to_commit_ms: Math.round(performance.now() - parsedAtRef.current),
      final_tasks: finalTasks,   // the committed v_final — the supervised label, read directly (no edit replay)
      task_id_map: idMap,        // _pid → committed task id: joins this generation to the task's later outcome
    });
  };

  const confirmAdd = () => {
    const now = new Date().toISOString();
    const baseId = Date.now();
    // Assign committed ids up front so corrections can map _pid → id (the join from
    // "what the model produced" to "what the user did with the task afterwards").
    const idMap = {};
    const committed = parsed.map((t, i) => {
      const id = baseId + i;
      idMap[t._pid] = id;
      const task = { ...t, id, done: false, addedAt: now, doneAt: null };
      delete task._pid;   // strip the internal ref before the task enters the app/db
      return task;
    });
    try { logCorrections(idMap, committed); } catch { /* telemetry must never block the commit */ }
    onTasksAdded(committed);
    onClose();
  };

  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") parseDump(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(8px)" }}>
      <div style={{ ...glassStrong, borderRadius: "20px", width: "100%", maxWidth: "640px", maxHeight: "90vh", overflow: "auto", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "1.3rem", color: "#fff", margin: 0 }}>Brain Dump</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: "1.4rem", cursor: "pointer" }}>×</button>
        </div>
        {!parsed ? (
          <>
            <p style={{ color: "#555", fontSize: "0.82rem", marginBottom: "1rem", lineHeight: 1.7 }}>Paste anything — numbered, prose, checkboxes, any language. The model extracts and scores the tasks; you tweak before adding.</p>
            <textarea value={dump} onChange={e => setDump(e.target.value)} onKeyDown={onKey} autoFocus
              placeholder={"5. Se renseigner sur Runpod\n6. Faire recette Sauce carotte\n7. Entreprise Mansa remplir documents\n8. Create Obsidian vault"}
              style={{ width: "100%", minHeight: "180px", ...glass, borderRadius: "12px", padding: "1rem", color: "#ccc", fontSize: "0.87rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            <GlassButton onClick={parseDump} disabled={loading || !dump.trim()} accent="#bef24a" style={{ marginTop: "1rem", width: "100%", padding: "0.9rem" }}>
              {loading ? "Classifying…" : "Parse & classify →"}
            </GlassButton>
            <p style={{ color: "#2e2e2e", fontSize: "0.65rem", textAlign: "center", marginTop: "0.6rem" }}>⌘/Ctrl + Enter · model: {BRAIN_DUMP_MODEL}</p>
            {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.75rem" }}>❌ {error}</p>}
          </>
        ) : (
          <>
            <p style={{ color: "#555", fontSize: "0.82rem", marginBottom: "1.2rem" }}>Found <strong style={{ color: "#bef24a" }}>{parsed.length} task{parsed.length === 1 ? "" : "s"}</strong>. Edit anything, then add.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1.5rem" }}>
              {parsed.map((t, i) => {
                const acc = CAT_ACCENT(t.category);
                return (
                  <div key={i} style={{ ...glass, borderRadius: "12px", padding: "0.85rem 1rem", borderLeft: `2px solid ${acc}66` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
                      <input value={t.title} onChange={e => updateTask(i, { title: e.target.value })}
                        style={{ flex: 1, minWidth: 0, background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#ddd", fontSize: "0.87rem", fontWeight: 600, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", outline: "none", padding: "2px 0" }} />
                      <span style={{ fontSize: "0.68rem", color: "#bef24a", fontWeight: 700, whiteSpace: "nowrap" }}>Score {calcScore(t, weights)}</span>
                      <button onClick={() => removeTask(i)} title="Remove"
                        style={{ background: "none", border: "none", color: "#2a2a2a", cursor: "pointer", fontSize: "0.85rem" }}
                        onMouseEnter={e => e.target.style.color = "#ef4444"} onMouseLeave={e => e.target.style.color = "#2a2a2a"}>🗑</button>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
                      <select value={t.category} onChange={e => updateTask(i, { category: e.target.value })}
                        style={{ background: acc + "14", border: `1px solid ${acc}33`, borderRadius: "20px", color: acc, fontSize: "0.66rem", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontWeight: 700, padding: "2px 8px", outline: "none", cursor: "pointer", appearance: "none" }}>
                        {CATEGORIES.map(c => <option key={c} value={c} style={{ background: "#101018", color: "#ddd" }}>{c}</option>)}
                      </select>
                      <Dim label="U" value={t.urgency} onChange={v => updateTask(i, { urgency: v })} />
                      <Dim label="I" value={t.importance} onChange={v => updateTask(i, { importance: v })} />
                      <Dim label="E" value={t.effort} onChange={v => updateTask(i, { effort: v })} />
                      <Dim label="⚡" value={t.energy} onChange={v => updateTask(i, { energy: v })} />
                      <TierBadge task={t} showEst />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <GlassButton onClick={() => setParsed(null)} style={{ flex: 1 }}>← Back</GlassButton>
              <GlassButton onClick={confirmAdd} disabled={!parsed.length} accent="#bef24a" style={{ flex: 2 }}>Add {parsed.length} task{parsed.length === 1 ? "" : "s"} →</GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
