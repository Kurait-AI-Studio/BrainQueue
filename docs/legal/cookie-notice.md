# BrainQueue — Cookie & Local Storage Notice (DRAFT)

> ⚠️ **Not legal advice.** Draft for review. The good news: BrainQueue currently uses
> **only strictly-necessary** storage (no advertising or third-party analytics cookies),
> so under EU ePrivacy/CNIL rules a blocking consent banner is generally **not required** —
> but confirm with counsel, and re-check if you ever add analytics/ads. Replace `[brackets]`.

**Last updated:** [DATE]

## What we store, and why
BrainQueue uses a small amount of browser storage, all of it **essential** to run the app:

| Item | Type | Purpose | Category |
|---|---|---|---|
| Supabase auth session | Local storage | Keep you signed in | Strictly necessary |
| `bq_event_outbox`, `bq_seq_*` | Local storage | Reliable, no-loss delivery of your activity events | Strictly necessary |
| `bq_consent_*`, `bq_consent_meta_*` | Local storage | Remember your data-use consent choice + version | Strictly necessary |
| App state / settings (`bq_state_*`) | Local storage | Your tasks, weights, and preferences on this device | Strictly necessary |
| Cloudflare Turnstile | Cookie/token | Bot protection on sign-in (security) | Strictly necessary |

We do **not** use advertising cookies, cross-site trackers, or third-party analytics
cookies. Our product analytics are **first-party** (your own event log, used to operate and,
only with your consent, improve the service — see [Privacy Policy §4](./privacy-policy.md)).

## Third parties that may set storage
- **Cloudflare (Turnstile):** security/anti-abuse during sign-in.
- **Supabase:** authentication/session.
- **Stripe** *(if/when checkout is enabled):* fraud prevention on payment pages.

These are limited to providing the features you use and are covered by their own policies.

## Managing storage
You can clear cookies and local storage in your browser settings at any time; doing so will
sign you out and reset on-device preferences. Blocking strictly-necessary storage may break
sign-in or sync.

## Changes
If we ever add non-essential cookies (e.g. analytics or marketing), we will update this
notice and present a proper consent banner with opt-in **before** setting them.

## Contact
[privacy@brainqueue…]
