// BrainQueue · "brain-dump" Edge Function (Deno, runs on Supabase).
//
// An authenticated proxy to a language-model provider. The provider API keys live
// ONLY here, as Supabase secrets — they are never shipped to the browser. The browser
// sends the dump text plus the prompt/schema (from src/brainDumpSpec.js, the single
// source of truth), the chosen model, and which `provider` to route to, along with the
// user's Supabase session token. This function verifies the caller is a real logged-in
// user, clamps the request, calls the provider with the server-side key, and returns a
// response in ONE shape (Anthropic's) regardless of provider — so the client parses
// every reply the same way and the telemetry (tokens/cost/raw_model_output) is uniform.
//
// Two providers are supported behind the same JSON schema:
//   • anthropic — Messages API. `system` is a top-level field; structured output via
//     output_config.format.json_schema; usage is input_tokens / output_tokens; the
//     text lives in content[].text. We pass its response straight through.
//   • openai    — Chat Completions. The system prompt is the first message
//     ({role:"system"}); structured output via response_format.json_schema (strict);
//     usage is prompt_tokens / completion_tokens; the text lives in
//     choices[0].message.content. We REWRAP it into the Anthropic shape below.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set OPENAI_API_KEY=sk-...        (only needed for the openai route)
//   supabase functions deploy brain-dump
//
// SUPABASE_URL / SUPABASE_ANON_KEY are injected by the platform — no need to set them.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_TOKENS_CAP = 8000; // hard ceiling, ignores oversized client asks
const DAILY_DUMP_CAP = Number(Deno.env.get("DAILY_DUMP_CAP")) || 25; // per-user/day; abuse + free-tier guard

// Per-provider allowlist — no arbitrary model billing, whatever the client sends.
const ALLOWED_MODELS: Record<string, Set<string>> = {
  anthropic: new Set(["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-8"]),
  openai: new Set(["gpt-4o-mini", "gpt-4.1-mini", "gpt-4o"]),
};

// Allowlist of browser origins permitted to call this function. Overridable via the
// ALLOWED_ORIGINS secret (comma-separated) so the real deploy domain can be set without
// a code change. Requests from an unknown origin get the first allowed origin echoed
// back (so their browser blocks the response) instead of a permissive "*".
const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://brainqueue.kuraitstudio.ai,https://app.brainqueue.app,http://localhost:5173,http://localhost:4173"
).split(",").map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // 1. Require a real, logged-in Supabase user (not just the anon key) so this proxy
  //    can't be abused by anonymous callers to burn the project's model credits.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Missing authorization" }, 401);
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: uerr } = await supa.auth.getUser(token);
  if (uerr || !user) return json({ error: "Not authenticated" }, 401);

  // 2. Read the request the client assembled from brainDumpSpec.
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const dump = body.dump;
  const system = body.system;
  const schema = body.schema;
  const provider = (body.provider as string) ?? "anthropic";
  const model = (body.model as string) ?? "claude-sonnet-4-6";
  const maxTokens = Math.min(Number(body.max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);
  if (typeof dump !== "string" || !dump.trim()) return json({ error: "Missing dump text" }, 400);
  if (!ALLOWED_MODELS[provider]) return json({ error: `Provider not allowed: ${provider}` }, 400);
  if (!ALLOWED_MODELS[provider].has(model)) return json({ error: `Model not allowed for ${provider}: ${model}` }, 400);

  // 2b. Reserve one Brain Dump against the user's daily cap BEFORE spending on the model.
  //     The count is server-authoritative (a SECURITY DEFINER function keyed on auth.uid()),
  //     so a client can't bypass it by withholding its own telemetry. If the function isn't
  //     deployed yet (migration 0009 not applied), fail OPEN so the app keeps working — the
  //     cap simply isn't enforced until the migration lands.
  const { data: quota, error: qErr } = await supa.rpc("bump_brain_dump_quota", { p_limit: DAILY_DUMP_CAP });
  if (qErr) {
    console.warn("brain-dump quota check failed open:", qErr.message);
  } else if (quota && quota.allowed === false) {
    return json({ error: `Daily Brain Dump limit reached (${quota.limit} per day). It resets tomorrow.`, code: "daily_limit", quota }, 429);
  }

  // 3. Route to the provider with the SERVER-side key. The browser never sees it.
  try {
    if (provider === "anthropic") {
      if (!ANTHROPIC_KEY) return json({ error: "Server misconfigured: ANTHROPIC_API_KEY not set" }, 500);
      const aRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          output_config: schema ? { format: { type: "json_schema", schema } } : undefined,
          messages: [{ role: "user", content: dump }],
        }),
      });
      // Anthropic's shape is already what the client expects — pass it through unchanged.
      const text = await aRes.text();
      return new Response(text, { status: aRes.status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // provider === "openai"
    if (!OPENAI_KEY) return json({ error: "Server misconfigured: OPENAI_API_KEY not set" }, 500);
    const oRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        // OpenAI takes the system prompt as the first message, not a top-level field.
        // The reminder line is harmless under strict json_schema and steers the
        // json_object fallback if a future model lacks schema support.
        messages: [
          { role: "system", content: `${system ?? ""}\n\nReturn a single JSON object of the form {"tasks": [ ... ]}.` },
          { role: "user", content: dump },
        ],
        response_format: schema
          ? { type: "json_schema", json_schema: { name: "task_list", strict: true, schema } }
          : { type: "json_object" },
      }),
    });
    const oData = await oRes.json();
    if (!oRes.ok || oData.error) {
      const msg = oData?.error?.message || `OpenAI HTTP ${oRes.status}`;
      return json({ error: msg }, oRes.status >= 400 ? oRes.status : 502);
    }
    // 4. Rewrap OpenAI's response into the Anthropic shape the client already parses:
    //    content[].text for the JSON, usage.input_tokens / output_tokens for telemetry.
    return json({
      content: [{ type: "text", text: oData.choices?.[0]?.message?.content ?? "" }],
      usage: {
        input_tokens: oData.usage?.prompt_tokens ?? null,
        output_tokens: oData.usage?.completion_tokens ?? null,
      },
      model: oData.model ?? model,
      stop_reason: oData.choices?.[0]?.finish_reason ?? null,
    });
  } catch (e) {
    return json({ error: `Upstream request failed: ${String(e)}` }, 502);
  }
});
