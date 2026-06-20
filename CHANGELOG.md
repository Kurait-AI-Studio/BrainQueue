# Changelog

All notable changes to BrainQueue are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
`vMAJOR.MINOR.PATCH` — see [docs/RELEASING.md](docs/RELEASING.md) for what counts
as a major vs. mid-level release.

## [Unreleased]

## [1.0.0] — 2026-06-20
First tagged release. The core product: capture, prioritize, and focus.

### Added
- **Brain Dump.** Paste freeform notes in any format or language; the model extracts,
  deduplicates, scores (urgency/importance/effort/energy), and classifies tasks via
  structured outputs. Runs server-side through a Supabase edge function so the model API
  key never reaches the browser.
- **Task scoring & prioritization** with adjustable weights, plus task tiers and
  effort/cognitive-load classification.
- **Focus Mode + Pomodoro sessions:** full-screen distraction-free focus, work/break
  cycles, and manual breaks.
- **Telemetry capture v2:** an append-only, immutable event log with a full event
  envelope (session, sequence, schema/app version, surface, consent, tz), a Brain Dump
  "correction goldmine" (raw input, raw model output, per-field edits), and version
  registries for prompts/models/schemas.
- **Supabase backend:** OAuth + magic-link auth, row-level security, realtime sync, and
  per-user localStorage caching.
- **Design system:** components extracted to `src/ui`, synced to Claude Design, with a
  no-auth preview gallery and Playwright screenshot automation.

[Unreleased]: https://github.com/Kurait-AI-Studio/BrainQueue/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Kurait-AI-Studio/BrainQueue/releases/tag/v1.0.0
