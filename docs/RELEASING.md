# Releasing BrainQueue

BrainQueue is versioned `vMAJOR.MINOR.PATCH` (e.g. `v2.1.0`). A git tag is the single
trigger: pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`, which publishes a
GitHub Release whose notes are the matching section of `CHANGELOG.md`.

## Which number do I bump?

| Bump | Tag goes from → to | When | Example |
| --- | --- | --- | --- |
| **MAJOR** ("v1", "v2") | `v1.4.2 → v2.0.0` | A milestone: a new core pillar, a redesign, or a breaking change to data/schema/API. Announce it. | The full app, a UI overhaul, a new auth model |
| **MINOR** ("v2.1", "v2.2") | `v2.0.0 → v2.1.0` | A mid-level, backward-compatible feature. Most releases land here. | Multi-provider Brain Dump, weekly review |
| **PATCH** (optional) | `v2.1.0 → v2.1.1` | Bug fixes only, no new features. | A parse crash hotfix |

Rule of thumb matching how we talk about it: **major = v1, v2**; **mid-level = v2.1, v2.2**.
Patch is there for hotfixes when you don't want to imply new features.

## Commit messages decide the bump (so a minor change never fires a v2)

We use [Conventional Commits](https://www.conventionalcommits.org/). The **highest-impact
commit since the last tag** sets the bump — and crucially, **nothing except an explicit
breaking marker bumps MAJOR**:

| Commit prefix | Means | Version impact |
| --- | --- | --- |
| `feat!:` or a `BREAKING CHANGE:` footer | Breaking change | **MAJOR** (v1 → v2) — and *only* this |
| `feat:` | New backward-compatible feature | **MINOR** (v1.0 → v1.1) |
| `fix:` | Bug fix | **PATCH** (v1.1.0 → v1.1.1) |
| `chore:` `docs:` `refactor:` `ci:` `test:` `style:` | Plumbing | **No release on its own** |

So a `feat:` — however large it feels — is a **MINOR**, not a major. Multi-provider Brain
Dump was a `feat:` and correctly shipped as `v1.1.0`, not `v2.0.0`. The only way to reach
`v2.0.0` is to deliberately write `feat!:` / `BREAKING CHANGE:` *and* tag `v2.0.0`. There is
no automatic major bump.

**The atomicity guard:** the release workflow refuses to publish a tag that has no matching
`## [X.Y.Z]` section in `CHANGELOG.md`. So you cannot accidentally push `v2.0.0` and get a
release — you'd first have to write its (major) notes by hand, which is the human checkpoint
that stops a minor change from masquerading as a major.

## Cutting a release

1. **Move the notes.** In `CHANGELOG.md`, turn the `## [Unreleased]` block into
   `## [X.Y.Z] — YYYY-MM-DD`, then add a fresh empty `## [Unreleased]` above it. Keep the
   `### Added / Changed / Fixed` groups and write each entry for a human ("what's new and
   why"), not as a commit dump.
2. **Bump the app version** so it matches the tag:
   ```sh
   npm version X.Y.Z --no-git-tag-version   # updates package.json only
   ```
3. **Commit** the changelog + version bump:
   ```sh
   git commit -am "chore(release): vX.Y.Z"
   ```
4. **Tag and push.** The tag must equal the changelog heading:
   ```sh
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main --follow-tags
   ```
5. The **Release workflow** publishes the GitHub Release automatically. Check it under the
   repo's *Releases* tab.

## Notes

- A pre-release uses a hyphen (e.g. `v2.0.0-rc.1`); the workflow marks those as
  "pre-release" automatically.
- Prefer **annotated** tags (`git tag -a`) so the tag carries a message and date.
- If you'd rather cut a release locally instead of via the Action:
  `gh release create vX.Y.Z --notes-file <(sed -n '/## \[X.Y.Z\]/,/## \[/p' CHANGELOG.md)`.
