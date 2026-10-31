# References

Images the art thread works from. Drawing your own sprites? See
[docs/SPRITES.md](../docs/SPRITES.md); your own art goes in `art/`.
 **Owned by the user.** Implementation
threads read these but never edit them.

## Folders

| Folder     | For                                         |
| ---------- | ------------------------------------------- |
| `hero/`    | the vampire hunter, poses, weapons in hand  |
| `mobs/`    | mushroom, flower, chicken, boss, later mobs |
| `effects/` | slash arcs, hits, coins, particles          |
| `ui/`      | menu, buttons, icons, badges                |

## Two kinds of reference

Put the kind in the file name:

- **`*.mood.png`**: loose inspiration (style, proportions, vibe). The art
  thread interprets it.
- **`*.spec.png`**: exact pixels. Drawn at the real sprite size (e.g. hero
  32×64, mobs 24×24) with **only** the colours below. The art thread converts
  it 1:1 into a sprite and does not redraw it.

Add a short `<name>.md` next to an image when you have notes: what to take,
what to ignore, which animation frame it is.

### Colours for `*.spec.png`

Transparent background. Use these exact hex values (light-theme values; the
game swaps fg/bg for dark mode automatically):

| Slot | Meaning                       | Hex       |
| ---- | ----------------------------- | --------- |
| `#`  | fg (body, outline)            | `#1f1f1f` |
| `o`  | bg (cut-outs, inner lines)    | `#ece9e2` |
| `O`  | orange                        | `#ff6b00` |
| `Y`  | yellow                        | `#eab308` |
| `R`  | red                           | `#dc2626` |
| `P`  | purple                        | `#7c3aed` |
| `G`  | green                         | `#16a34a` |
| `B`  | blue                          | `#2563eb` |
| `K`  | pink                          | `#db2777` |

Animations: put frames side by side in one image (a horizontal strip), all
the same size, e.g. `hero-slash.spec.png` = 4 frames × 32×64 = 128×64.

Tools: [Piskel](https://www.piskelapp.com) (free, in the browser) or
Aseprite. Turn off anti-aliasing.

## Workflow

1. Create a branch: `git switch -c ref/<topic>` (e.g. `ref/hero-v2`).
2. Add or edit images in the right folder and commit.
3. Open a PR titled `ref: <topic>`. Say in the description what you want
   done with it.
4. The planning thread merges it and sends the art thread a task that points
   at the files.

## Copyright

The repo is public. Only commit **your own** drawings and edits. For images
of existing characters or other people's art, either describe them in a
`.md` with a link, or keep them in a `_private/` folder (gitignored, so it
stays on your machine only).
