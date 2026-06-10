# Supabase setup

BrainQueue uses Supabase for auth (OAuth2 + email magic link) and task storage.
Two things to do once: run the migration, and turn on the login providers.

## 1. Run the migration

Supabase dashboard → **SQL Editor** → paste
[`migrations/0001_user_auth_rls.sql`](migrations/0001_user_auth_rls.sql) → Run.

It adds `user_id` to `tasks`, enables Row-Level Security so each user only ever
reads/writes their own rows, and wires up realtime. If you had tasks before auth,
see the backfill note at the bottom of the SQL.

## 2. Enable login providers

Dashboard → **Authentication → Providers**:

- **Email** — on by default (powers the magic link). Nothing to do.
- **Google** — toggle on, paste an OAuth **Client ID** + **Client secret** from
  the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
  (create an "OAuth client ID", type *Web application*). Copy the **Callback URL**
  Supabase shows you into Google's *Authorized redirect URIs*.
- **GitHub** — toggle on, create an OAuth App at
  github.com → Settings → Developer settings → OAuth Apps, paste Client ID +
  secret, and set the callback to the URL Supabase shows.

To add more providers later, flip them on here and append to `OAUTH_PROVIDERS`
in `src/App.jsx`. For step-by-step **Apple**, **Microsoft (Entra ID)** and
**enterprise SSO (SAML)** setup — plus 2026 auth hardening (PKCE, refresh-token
rotation, MFA, leaked-password protection) — see
[`adding-auth-providers.md`](./adding-auth-providers.md).

## 3. Redirect URLs

Dashboard → **Authentication → URL Configuration** → add every origin the app
runs on to **Redirect URLs**:

- `http://localhost:5173` (Vite dev)
- your Vercel preview + production URLs (e.g. `https://brainqueue.vercel.app`)

The app passes `redirectTo: window.location.origin`, so the current origin must
be in this allow-list or the provider round-trip is rejected.

## How the security works

- The browser only ever holds the **anon public key** + a short-lived user JWT
  (auto-refreshed by the SDK). The anon key is safe to ship — it can't bypass RLS.
- Every `tasks` row is stamped with `user_id`; the RLS policies make
  `auth.uid() = user_id` a hard requirement for select/insert/update/delete, so a
  user physically cannot read or modify anyone else's tasks, even by crafting raw
  API calls.
- Realtime subscriptions are filtered server-side to the user's rows and respect
  the same RLS.
- No passwords are stored or handled by our code — Supabase/Google/GitHub own that.
