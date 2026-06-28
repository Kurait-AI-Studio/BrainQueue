# BrainQueue — Privacy Policy (DRAFT)

> ⚠️ **Not legal advice.** This is a working draft to brief a qualified privacy
> lawyer, not a finished policy. Because you intend to (a) use customer content to
> train models and (b) operate internationally (GDPR/UK GDPR, CCPA/CPRA, and others),
> have a lawyer review and adapt this before publishing. Replace every `[bracket]`.

**Last updated:** [DATE] · **Controller:** [Legal entity name], [address] · **Contact:** [privacy@brainqueue…]

## 1. Who we are
BrainQueue ("BrainQueue", "we") provides a task-capture and focus app at
`https://brainqueue.kuraitstudio.ai`. For people in the EEA/UK, we are the "data
controller" of your personal data. [If you appoint an EU/UK representative or DPO, name them here.]

## 2. What we collect
- **Account data:** your email address (for passwordless sign-in) and authentication metadata.
- **Content you create:** brain dumps, tasks, edits, categories, scores, notes, focus sessions.
- **Usage / telemetry:** events about how you use the app (what you keep, edit, complete, postpone), device/browser, timezone, and a per-event consent flag. This powers personalization and product improvement.
- **Calendar integration (optional):** if you connect Google or Microsoft, a temporary access token used **only** to create the events you ask us to create. We do not read your calendar.
- **Security/anti-abuse:** captcha verification (Cloudflare Turnstile), rate-limit counters, and standard server logs.

## 3. How we use your data, and our legal bases (GDPR Art. 6)
| Purpose | Legal basis |
|---|---|
| Provide the app (sign-in, sync, focus sets) | Performance of a contract (Art. 6(1)(b)) |
| Keep the service secure, prevent abuse | Legitimate interests (Art. 6(1)(f)) |
| Personalize your experience to you | Contract / legitimate interests |
| **Improve and train the models behind BrainQueue** | **Your consent (Art. 6(1)(a))** — see §4 |
| Comply with law, handle disputes | Legal obligation / legitimate interests |

## 4. Using your data to improve and train our models (optional, consent-based)
With your **explicit, opt-in consent**, we use the content you create — your brain
dumps, the tasks you keep or edit, and how you organize and complete them — to
improve and train the systems that power BrainQueue's task extraction, scoring, and
personalization. This is how:

- **It is optional and unbundled.** BrainQueue works fully without it. We do **not**
  make using the app conditional on this consent (GDPR: consent must be freely given).
- **It is granular and reversible.** You turn it on or off any time in Settings.
  Withdrawing stops future use; it does not affect processing already carried out.
- **We de-identify before training.** We strip information that directly identifies
  you wherever feasible, and aggregate where possible.
- **We exclude third-party-sourced data.** We do **not** use data obtained through
  Google or Microsoft services (e.g. calendar data) to train any models. *(Required by
  Google's API Services User Data Policy — see §9.)*
- **No selling, no ad profiling.** We never sell personal data or use it to build
  advertising profiles.
- **Model limitation note.** Data already incorporated into a trained model cannot
  always be individually removed; on request we delete your underlying raw data and
  exclude it from future training.

> Implementation note: this maps to the app's existing `consent_state` flag —
> `full` = personalization **and** model training; `product-only` = run the service
> only; `none` = minimal. Record the consent version + timestamp with each choice.

## 5. AI processing and sub-processors
To turn your brain dumps into tasks, the text you submit is sent to a large-language-model
provider. We use vetted processors and bind them by contract (DPAs):
- **AI extraction:** Anthropic and/or OpenAI (API). API inputs are **not** used by them
  to train their models by default; we send only what's needed for the feature.
- **Hosting / database / auth:** Supabase. **Email delivery:** [your SMTP provider, e.g. Resend].
  **Captcha:** Cloudflare (Turnstile). **App hosting:** Vercel.
A current list is available on request. [Link your sub-processor list.]

## 6. International transfers
Your data may be processed outside your country (including the United States). Where
required, we rely on appropriate safeguards such as the EU Standard Contractual Clauses
and the UK Addendum. [Confirm each processor's transfer mechanism.]

## 7. Retention
We keep account and content data while your account is active. Telemetry is retained for
[X months] to operate and improve the service. You can delete your account at any time,
which deletes your tasks, sessions, and event log. [State concrete periods.]

## 8. Your rights
Depending on where you live (GDPR, UK GDPR, CCPA/CPRA, LGPD, PIPEDA, etc.) you may have
the right to access, correct, delete, port, restrict, or object to processing, and to
**withdraw consent** (including the model-training consent in §4) at any time. To exercise
these, contact [privacy@…]. You may also complain to your local data-protection authority.
We do not sell or "share" personal information as defined by California law.

## 9. Google / Microsoft API limited use
BrainQueue's use and transfer of information received from Google APIs adhere to the
[Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy),
including the **Limited Use** requirements. We use Google/Microsoft data solely to provide
the calendar feature you request, do not transfer it except as needed to provide that
feature, do not use it for advertising, and **do not use it to train models**.

## 10. Children
BrainQueue is not directed to children under [16/13 as applicable]. We do not knowingly
collect their data.

## 11. Security
We protect data with encryption in transit (HTTPS/HSTS), row-level access controls,
server-side secrets, captcha, and rate limiting. No method is perfectly secure.

## 12. Changes & contact
We'll post changes here and, for material changes to §4, ask for fresh consent.
Questions: [privacy@brainqueue…].
