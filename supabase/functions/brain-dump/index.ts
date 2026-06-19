// BrainQueue · "brain-dump" Edge Function (Deno, runs on Supabase).
//
// An authenticated proxy to Anthropic. The Anthropic API key lives ONLY here, as a
// Supabase secret — it is never shipped to the browser. The browser sends the dump
// text plus the prompt/schema (from src/brainDumpSpec.js, the single source of truth)
// with the user's Supabase session token; this function verifies the caller is a real
// logged-in user, clamps the request, calls Anthropic with the server-side key, and
// streams the response straight back.
//
// Deploy:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy brain-dump
//
// SUPABASE_URL / SUPABASE_ANON_KEY are injected by the platform — no need to set them.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const MAX_TOKENS_CAP = 8000;                       // hard ceiling, ignores oversized client asks
const ALLOWED_MODELS = new Set(["claude-sonnet-4-6"]); // allowlist — no arbitrary model billing

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ANTHROPIC_KEY) return json({ error: "Server misconfigured: ANTHROPIC_API_KEY not set" }, 500);

  // 1. Require a real, logged-in Supabase user (not just the anon key) so this proxy
  //    can't be abused by anonymous callers to burn the project's Anthropic credits.
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
  const model = (body.model as string) ?? "claude-sonnet-4-6";
  const maxTokens = Number(body.max_tokens) || MAX_TOKENS_CAP;
  if (typeof dump !== "string" || !dump.trim()) return json({ error: "Missing dump text" }, 400);
  if (!ALLOWED_MODELS.has(model)) return json({ error: `Model not allowed: ${model}` }, 400);

  // 3. Call Anthropic with the SERVER-side key. The browser never sees it.
  let aRes: Response;
  try {
    aRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: Math.min(maxTokens, MAX_TOKENS_CAP),
        system,
        output_config: schema ? { format: { type: "json_schema", schema } } : undefined,
        messages: [{ role: "user", content: dump }],
      }),
    });
  } catch (e) {
    return json({ error: `Upstream request failed: ${String(e)}` }, 502);
  }

  // 4. Pass Anthropic's response through unchanged, so the client parses it exactly
  //    as before (the `tokens`/`cost`/`raw_model_output` telemetry still works).
  const text = await aRes.text();
  return new Response(text, { status: aRes.status, headers: { ...cors, "Content-Type": "application/json" } });
});
