# BrainQueue · Deploy & Security Checklist

Everything that has to be set "in place X" for a secure production deploy. The app
(Vite SPA) and the landing (Next.js) are **separate Vercel projects**.

Production origin: `https://brainqueue.kuraitstudio.ai`

---

## 1. The production origin appears in 5 places — keep them in sync

| # | Where | Set to |
|---|---|---|
| 1 | Supabase → Authentication → URL Configuration (Site URL + Redirect URLs) | `https://brainqueue.kuraitstudio.ai` (+ `http://localhost:5173` for dev) |
| 2 | Supabase → Edge Functions → secret `ALLOWED_ORIGINS` | `https://brainqueue.kuraitstudio.ai,http://localhost:5173` |
| 3 | Cloudflare Turnstile → widget Hostnames | `brainqueue.kuraitstudio.ai` (+ `localhost` for dev) |
| 4 | App env `VITE_CAPTCHA_SITE_KEY` (Vercel + `.env`) | Turnstile **site** key (`0x4AA…`, public) |
| 5 | Supabase → Authentication → Attack Protection → CAPTCHA | Turnstile **secret** key (private) |

> Site key (public) → app. Secret key (private) → Supabase. They are NOT interchangeable.

---

## 2. Environment variables

**App (Vite SPA) — Vercel project + local `.env`:**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_CAPTCHA_SITE_KEY` (Turnstile site key)
- `VITE_CAPTCHA_PROVIDER` (optional; defaults to `turnstile`)

**Landing (Next.js) — its own Vercel project:**
- `NEXT_PUBLIC_APP_URL=https://brainqueue.kuraitstudio.ai` (so CTAs point at the real app)
- also set `site.url` in `landing/config/site.ts`

**Server-only (never `VITE_`-prefixed; Supabase secrets only):**
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `ALLOWED_ORIGINS`, `DAILY_DUMP_CAP` (optional, default 25)
- `SUPABASE_SERVICE_ROLE_KEY` stays local/CI only — never in any client or `VITE_` var.

---

## 3. Apply migrations + deploy the edge function

Migrations live in `supabase/migrations/` and are applied via the SQL editor or the CLI:

```bash
# one-time
brew install supabase/tap/supabase
supabase login
supabase link --project-ref urnmhmagdnuojeludshl

# apply any unapplied migrations (e.g. 0009 brain_dump_quota)
supabase db push

# ship the daily cap + CORS allowlist + (later) any new providers
supabase functions deploy brain-dump

# secrets the function reads
supabase secrets set ALLOWED_ORIGINS="https://brainqueue.kuraitstudio.ai,http://localhost:5173"
supabase secrets set DAILY_DUMP_CAP=25
```

---

## 4. Supabase dashboard hardening (the auth perimeter)

- [x] CAPTCHA on auth (Turnstile) — **enabled**
- [x] Email confirmation required (`mailer_autoconfirm = false`) — **enabled**
- [x] Redirect URL allowlist set to the real origin — **done**
- [ ] Leaked-password protection (HaveIBeenPwned) — Authentication → Password
- [ ] Minimum password length ≥ 10
- [ ] Run **Security Advisor** + **Database Linter**, clear all findings
- [ ] (optional) MFA / TOTP

---

## 5. Post-deploy smoke tests (5 minutes, in a real browser)

1. **Login (magic link):** open login → Turnstile shows a normal challenge (not "unable to connect") → enter email → **receive the magic-link email**. If the email arrives, site key + secret key + Supabase all agree.
2. **Login (Google):** OAuth round-trips and returns signed in.
3. **Brain dump:** paste notes → tasks come back → add them.
4. **Daily cap:** (optional) confirm the 26th dump in a day is refused with a friendly message.
5. **Calendar:** one-click add to Google/Outlook works (or falls back to `.ics`).
6. **Headers:** `curl -sI https://brainqueue.kuraitstudio.ai | grep -i content-security` shows the CSP.

Automated checks that ship in the repo:
- `node test/telemetry-capture.live.mjs` — telemetry round-trip
- `node test/brain-dump-cap.live.mjs` — daily cap enforcement
- `node --test test/telemetry.test.js` — outbox unit tests

---

## 6. Security posture vs OWASP Top 10 (2021)

| Risk | Status | Notes |
|---|---|---|
| A01 Broken Access Control | ✅ Strong | RLS on every table, owner-scoped, `WITH CHECK` on writes; `task_events` immutable; quota writes only via SECURITY DEFINER fn. |
| A02 Cryptographic Failures | ✅ | HTTPS + HSTS (preload); secrets server-side only; anon key is public by design (RLS protects). |
| A03 Injection | ✅ | No SQL string-building (PostgREST parameterised); React escapes output; only `dangerouslySetInnerHTML` is static JSON-LD. |
| A04 Insecure Design | ✅ | Edge function gates the only paid path: auth required + model allowlist + token cap + daily cap + CAPTCHA on signup. |
| A05 Security Misconfiguration | ✅ | Full HTTP header set (CSP/HSTS/frame/nosniff/referrer/permissions) on app + landing; CORS allowlisted. |
| A06 Vulnerable Components | ✅ | `npm audit` = 0; Dependabot + CI audit gate added. |
| A07 Auth Failures | ✅ | Supabase Auth, JWT bearer (CSRF-resistant), CAPTCHA, email confirmation, leaked-password (enable). |
| A08 Integrity Failures | ✅ | Durable idempotent telemetry; immutable event log; versioned prompt/model/schema registries. |
| A09 Logging/Monitoring | ⚠️ Partial | Rich product telemetry, but no security alerting/monitoring yet (post-9 maturity). |
| A10 SSRF | ✅ N/A | Edge function only calls a fixed provider allowlist; no user-supplied URLs are fetched. |

User-facing errors are passed through `src/lib/errors.js#humanizeError`, which hides
SQL / Postgres / raw internal text and shows a calm English sentence instead.
