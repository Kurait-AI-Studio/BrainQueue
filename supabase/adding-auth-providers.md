# Adding more login providers — Apple, Microsoft & enterprise SSO

BrainQueue's auth runs entirely through **Supabase Auth**, so adding a provider is
two steps every time:

1. **Configure the provider** in the Supabase dashboard (and on the provider's own
   developer console).
2. **Expose it in the UI** — for OAuth providers that's one line in
   `OAUTH_PROVIDERS` (`src/App.jsx`); enterprise SSO uses a slightly different
   call (see §3).

The redirect plumbing, PKCE exchange, token storage and refresh, and RLS scoping
are already done and are identical for every provider. Nothing about the security
model changes when you add one.

> **Before you start** — every provider's callback must point at your Supabase
> project's callback URL, and your app origins must be in
> **Authentication → URL Configuration → Redirect URLs** (`http://localhost:5173`
> plus your Vercel preview/production URLs). This is the same allow-list Google
> uses; see [`README.md`](./README.md) §3.

---

## 1. Apple — "Sign in with Apple"

Apple is the fussiest because the OAuth **client secret is a short-lived JWT** that
must be re-signed roughly every 6 months. Supabase generates and rotates it for you
**if** you give it your signing key instead of a static secret — do it that way.

### On the Apple Developer portal (developer.apple.com → Certificates, IDs & Profiles)

You need an Apple Developer Program membership ($99/yr).

1. **App ID** — Identifiers → `+` → *App IDs*. Note the **Team ID** (top-right of
   the portal) — you'll need it.
2. **Services ID** — Identifiers → `+` → *Services IDs*. This string (e.g.
   `com.brainqueue.web`) becomes your **Client ID**.
   - Enable **Sign in with Apple** on it → *Configure*.
   - **Domains**: your production domain (e.g. `brainqueue.vercel.app`).
   - **Return URLs**: the **Callback URL** Supabase shows under
     *Authentication → Providers → Apple* — it looks like
     `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Apple rejects `localhost` and bare IPs here. To test Apple locally, use the
     deployed Supabase callback and tunnel your app, or just test it on the Vercel
     preview.
3. **Sign-in key** — Keys → `+` → enable *Sign in with Apple* → download the
   `.p8` file (**once only**) and note the **Key ID**.

### In Supabase (Authentication → Providers → Apple)

Toggle on and fill in:

| Field | Value |
| --- | --- |
| **Client IDs** | the Services ID (`com.brainqueue.web`) |
| **Secret Key (for OAuth)** | the contents of the `.p8` file |
| **Team ID** | from the portal |
| **Key ID** | from the key you created |

Supabase mints and rotates the JWT secret from these, so you never touch the
6-month expiry again.

### In the app

```js
// src/App.jsx
const OAUTH_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
  { id: "apple",  label: "Continue with Apple" },   // ← add
];
```

That's it — `signInWithProvider("apple")` already works. Apple's brand guidelines
require their logo + the exact wording "Sign in with Apple" or "Continue with
Apple" on a black or white button; add an Apple glyph in `ProviderButton`
(it currently only special-cases the Google mark) to stay compliant.

> Apple only returns the user's name on the **very first** authorization and only
> if you request the `name` scope. The email is always present (often a private
> relay `@privaterelay.appleid.com` address) — treat it as the stable identifier,
> not the name.

---

## 2. Microsoft — Entra ID (formerly Azure AD)

In Supabase the Microsoft provider is named **`azure`**.

### In the Azure / Entra portal (portal.azure.com → Microsoft Entra ID → App registrations)

1. **New registration**.
   - **Supported account types**: pick **"Accounts in any organizational
     directory and personal Microsoft accounts"** for consumer + work/school
     sign-in (this is the `common` tenant). Choose single-tenant only if you're
     locking the app to one organization.
   - **Redirect URI**: platform *Web*, value = the Supabase **Callback URL** from
     *Authentication → Providers → Azure*
     (`https://<project-ref>.supabase.co/auth/v1/callback`).
2. **Certificates & secrets → New client secret** → copy the **Value** (not the
   Secret ID) immediately.
3. Note the **Application (client) ID** from the *Overview* page.
4. **API permissions** → ensure `openid`, `email`, `profile` (Microsoft Graph,
   delegated) are present — they're the default.

### In Supabase (Authentication → Providers → Azure)

| Field | Value |
| --- | --- |
| **Client ID** | Application (client) ID |
| **Secret Value** | the client secret value |
| **Azure Tenant URL** | leave blank for multi-tenant (`common`), or `https://login.microsoftonline.com/<tenant-id>` to restrict to one org |

### In the app

```js
const OAUTH_PROVIDERS = [
  // ...
  { id: "azure", label: "Continue with Microsoft" },   // ← add
];
```

You can request extra scopes per-call if you ever need Graph data:

```js
await sb.auth.signInWithOAuth({
  provider: "azure",
  options: { scopes: "email profile", redirectTo: window.location.origin },
});
```

---

## 3. Enterprise SSO (SAML 2.0) — for selling to organizations

This is different from social OAuth. Enterprise customers want to log in with
**their own** identity provider (Okta, Entra ID, Google Workspace, OneLogin…) so
their IT controls provisioning and de-provisioning. Supabase supports this via
**SAML 2.0 single sign-on**, keyed off the user's email **domain**.

> SAML SSO requires the Supabase **Pro plan or above** and is enabled per-project.

### Enable SAML on the project (one-time)

```bash
# Turn on the SAML 2.0 feature for the project
supabase sso enable --project-ref <project-ref>
```

### Register each customer's identity provider

You do this once per organization, using either the metadata URL their IT gives
you or an uploaded metadata XML file:

```bash
supabase sso add \
  --project-ref <project-ref> \
  --type saml \
  --metadata-url "https://customer-okta.example.com/app/abc/sso/saml/metadata" \
  --domains acme.com
```

The `--domains` flag is the magic: any user whose email ends in `@acme.com` gets
routed to Acme's IdP automatically.

### In the app — a separate call, not the OAuth list

SSO doesn't go in `OAUTH_PROVIDERS`. Add a small helper alongside the others in
`src/App.jsx`:

```js
async function signInWithSSO(email) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase is not configured.");
  const domain = email.split("@")[1];
  const { data, error } = await sb.auth.signInWithSSO({ domain });
  if (error) throw error;
  // signInWithSSO returns the IdP URL — you redirect to it yourself.
  if (data?.url) window.location.assign(data.url);
}
```

The clean UX (and the 2026 norm) is **one email field** that decides the path: if
the domain matches a registered SSO org, send them to SSO; otherwise fall back to
the magic link / social buttons you already have. You can detect "is this an SSO
domain" by attempting `signInWithSSO` and handling the "no SSO provider for
domain" error, or by keeping a small allow-list of enterprise domains client-side.

Supabase handles the SAML assertion exchange and drops the user into the same
session + RLS model as everyone else — `session.user.id` is still the key your
`tasks` rows are scoped to.

---

## 4. Best-practice hardening (turn these on regardless of provider)

These are project-level settings, not per-provider, and they're what separates a
toy login from 2026 standards. All under **Authentication** in the dashboard:

- **PKCE flow** — already in use. `supabase-js` defaults to PKCE (not the legacy
  implicit flow), so the authorization code never rides in the URL fragment. No
  action needed; just don't switch it off.
- **Refresh token rotation + reuse detection** — *Settings → Sessions*. Rotating
  refresh tokens and revoking the family on reuse limits the blast radius of a
  stolen token. On by default; keep it.
- **Leaked password protection** — *Settings → Password*. Checks new passwords
  against HaveIBeenPwned. (BrainQueue has no password sign-up today, but enable it
  before you ever add one.)
- **Email enumeration protection** — *Settings* — makes sign-in/sign-up responses
  indistinguishable so attackers can't probe which emails are registered.
- **MFA / TOTP** — *Settings → Multi-Factor*. Enable so users (especially SSO
  admins) can add a second factor; `supabase-js` exposes `auth.mfa.*` to enroll
  and challenge.
- **Session timebox** — set a max session length and inactivity timeout so a
  forgotten open tab doesn't stay authenticated forever.
- **Short JWT expiry** — keep the access-token TTL short (default ~1h); the SDK
  refreshes silently, and RLS re-checks `auth.uid()` on every request anyway.

None of these require app code changes — they tighten the same session every
provider funnels into.

---

## Quick reference — adding an OAuth provider

1. Provider console: create the OAuth app, set the callback to Supabase's
   `…/auth/v1/callback`, copy Client ID + secret.
2. Supabase → Authentication → Providers → toggle on, paste credentials.
3. Supabase → URL Configuration → confirm your app origins are in Redirect URLs.
4. `src/App.jsx` → add `{ id, label }` to `OAUTH_PROVIDERS` (and an icon in
   `ProviderButton` if you want the brand mark).
5. Done — `signInWithProvider(id)` already handles the rest.
