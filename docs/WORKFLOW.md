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

## Pull requests

- Use the [PR template](../.github/pull_request_template.md). Every PR has a
  **How to review locally** section.
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
