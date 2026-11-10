---
name: backlog
description: List what we still need to do next, from docs/BACKLOG.md, as a numbered list (1, 1.1, 1.2, 2, ...). Use when the owner types /backlog or asks what is in the backlog or what to do next.
---

# /backlog

Show the owner what is left to do, as a numbered list they can refer to
("do 3.2").

## Steps

1. Run `git fetch -q` and read `docs/BACKLOG.md` from the latest `staging`
   (`git show origin/staging:docs/BACKLOG.md`), so merged work is not listed.
2. Also run `gh pr list --state open` for work already in review.
3. Build the list:
   - **Top level, `1`, `2`, `3`, …**: one number per `## ` section of the
     backlog that still has open items (`- [ ]` or `- [~]`). Skip sections
     with nothing open. Use the section name, in the order of the file, with
     the open count: `3. Weapons & items (6)`.
   - **Sub level, `1.1`, `1.2`, …**: the open items of that section, in file
     order. One short line each: the bold title, then at most ~12 words of
     detail. Mark in-progress items (`- [~]`) with `(in progress)`. Add
     `(PR #NN)` when an open PR covers it.
   - Never list ticked (`- [x]`) items.
4. Put a short **Next up** line at the end: your recommendation of 1–3
   items by number (e.g. `3.2`), with one reason each. Prefer items that
   unblock others (the simulator unblocks most of the balance items).
5. If an item looks done already (the code or a merged PR covers it) but is
   still unticked, list it under `Probably done, untick?` with the number.
   Don't edit the backlog unless asked.

## Format

```
1. Progression & balance (3)
   1.1 Simulator: headless, same code as the game, `npm run sim`
   1.2 Slow progress down: measure with the sim, agree target times
   1.3 Ascend logic (PR #78 merged, untick?)
2. Active play (5)
   2.1 Roguelike stage picks (PR #79)
   ...

Next up: 1.1 (unblocks 1.2 and the balance items), ...
```

Keep it plain text, no tables. Don't dump whole backlog paragraphs.
