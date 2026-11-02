# Workflow

How work is split between threads (AI sessions) and the owner.

## Threads

- **Planning thread**: plans, writes briefs, reviews and merges PRs, keeps
  `docs/` and `CHANGELOG.md` up to date.
- **One thread = one small, separate task.** One backlog item (or a small
  slice of one), one branch, one PR. When it's merged, the thread is done.
  The next task gets a new thread. Big items are split into small tasks
  first (e.g. the sprite tool: PNG import → Aseprite JSON → markers → watch
  mode).
- Branch names by area: `code/*`, `art/*`, `audio/*`, `ui/*`, `docs/*`.
- Each brief is self-contained: the goal, the files the thread owns, and
  what's out of scope. Threads working at the same time never own the same
  files.
- Implementation threads don't edit `docs/` or `CHANGELOG.md`. They propose
  lines in the PR body.

## Branches and releases

Project rule: **features go to `staging`, only releases go to `main`.**

- `staging` is where all features are merged and tested together. It
  replaces the old `integrate/wave*` branches.
- Every task branch (`code/*`, `ui/*`, …) starts from `staging`, and its PR
  targets `staging`.
- As PRs land on `staging`, the planning thread adds their proposed lines to
  `## [Unreleased]` in `CHANGELOG.md` (on `staging`).
- `main` only changes through a **release**. Nothing else is merged into
  `main`. `main` deploys the live site, so it always equals the last
  release.

### Release (staging → main)

When the owner says `staging` is good:

1. On `staging`, one release commit (`Release vX.Y.Z`):
   - bump `version` in `package.json` (and `package-lock.json`) by semver
     (see [PLAN.md → Versioning](PLAN.md#versioning)): PATCH for fixes and
     balance, MINOR for new features/content;
   - rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a fresh
     empty `## [Unreleased]` above it, and update the compare links at the
     bottom. These are the update notes.
2. Open a PR `staging → main` titled `Release vX.Y.Z`, with the new
   changelog section as its body.
3. The owner approves. Merge with a **merge commit** (no squash, no rebase).
4. Tag the merge commit `vX.Y.Z`, push the tag, and create a GitHub Release
   with the same notes.
5. Fast-forward `staging` to `main` so both start the next cycle equal.

Hotfix: a `fix/*` branch from `main` gets its own PATCH release straight to
`main`, then `main` is merged back into `staging`.

## Pull requests

- Use the [PR template](../.github/pull_request_template.md). Every PR has a
  **How to review locally** section.
- Feature PRs target `staging`. Only release PRs (and hotfixes) target
  `main`.
- The owner reviews and approves. Nothing is merged to `main`, and nothing
  touches the live site, without the owner's OK.
- Screenshots go on one shared `pr-assets` branch.

## Demo ports

- `npx vite --port 5301`: game (`/demo/?afkdebug`)
- `5302`: sprites (`/demo/sprites.html`)
- `5303`: audio (`/demo/audio.html`)

## Copyright

Third-party references go only in gitignored `references/**/_private/`.
Take style and proportions, never someone else's character or pixels. No
ripped audio.
