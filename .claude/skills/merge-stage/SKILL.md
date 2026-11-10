---
name: merge-stage
description: Merge all open, ready pull requests that target staging (squash), then update the local checkout and restart the demo. Use when the owner types /merge-stage or asks to merge everything to stage.
---

# /merge-stage

The owner typing `/merge-stage` is their OK to merge every ready PR into
`staging`. It never touches `main` (releases are a separate, explicit step,
see `docs/WORKFLOW.md`).

## Steps

1. `gh pr list --base staging --state open --json number,title,isDraft,mergeable,headRefName,statusCheckRollup,reviewDecision`
2. For each PR decide:
   - **Merge** if: not a draft, `mergeable` is `MERGEABLE`, all checks passed,
     and no "changes requested" review.
   - **Skip** (and say why) if: draft, failing or pending checks, merge
     conflicts, or changes requested. If checks are only pending, wait a
     little (up to ~2 min) and re-check once. Don't force anything and
     never bypass CI.
3. Merge in ascending PR number, with a **squash**: 
   `gh pr merge <n> --squash --delete-branch`.
   Between merges, if the next PR turned `CONFLICTING` because of the
   previous one, skip it and report it. Don't rebase other people's branches
   unasked. A "cannot delete local branch, used by worktree" message is fine
   (the remote branch is deleted).
4. Update the checkout: `git switch staging` and
   `git -c credential.helper='!gh auth git-credential' pull --ff-only`.
5. Restart the demo so it serves the new `staging`:
   `systemctl --user restart afk-demo`, wait a few seconds, check
   `systemctl --user is-active afk-demo` and that
   `curl -s -o /dev/null -w "%{http_code}" "http://localhost:5301/demo/?afkdebug"`
   gives 200. Don't `pkill` vite.
6. Report in a short list: merged (`#NN title`), skipped (`#NN`, reason),
   the new `staging` short SHA, and the demo state.

## Rules

- Targets `staging` only. Ignore PRs aimed at `main` and say they were
  ignored.
- If nothing is ready, say so and don't restart the demo.
- After merging, the planning thread adds the merged PRs' proposed lines to
  `## [Unreleased]` in `CHANGELOG.md` (docs PR). Mention that this is still
  to do if the merged PRs came with proposed changelog lines; don't do it
  here.
