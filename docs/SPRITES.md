# How to make sprites

A step-by-step guide for drawing your own characters, mobs and animations
for the game.

> **Status:** the converter isn't built yet (see [BACKLOG](BACKLOG.md) →
> Sprite converter). Until then, follow [Today](#today-hand-over-a-png) and
> the art thread copies your pixels in by hand. Once the converter lands,
> [With the converter](#with-the-converter) replaces that step. Everything
> you draw now still works then.

## 1. Tools

Any pixel editor that exports PNG works. Recommended:

| Editor          | Price           | Why                                                |
| --------------- | --------------- | -------------------------------------------------- |
| **Aseprite**    | paid            | Best for animation: tags, onion skin, frame timing |
| **LibreSprite** | free            | Fork of an older Aseprite, same file format        |
| **Pixelorama**  | free            | Modern, has tags and onion skin                    |
| **Piskel**      | free, in browser | Quick sketches; exports PNG strips                 |

## 2. Load the palette

The game swaps colours with the site theme (dark/light), so it doesn't
store real colours. Each colour you draw with means a **slot**. Use only
these:

| Colour    | Slot | Use it for                                  |
| --------- | ---- | ------------------------------------------- |
| `#1f1f1f` | `#`  | body, coat, outline (the "ink" colour)      |
| `#ece9e2` | `o`  | cut-outs inside the body: hand, eye whites, folds |
| `#ff6b00` | `O`  | orange accents                              |
| `#eab308` | `Y`  | yellow: gold, buttons, buckles              |
| `#dc2626` | `R`  | red: eyes, scarf, blood                     |
| `#7c3aed` | `P`  | purple                                      |
| `#16a34a` | `G`  | green                                       |
| `#2563eb` | `B`  | blue                                        |
| `#db2777` | `K`  | pink                                        |
| transparent | `.` | background                                 |

In **dark mode** `#` and `o` swap: the ink becomes light and the cut-outs
dark. Accents stay the same. Draw in the light version and the dark one
comes for free.

**Load it:** Aseprite / LibreSprite → Palette menu (☰ above the palette) →
_Load Palette_ → `art/afk-palette.gpl`. Pixelorama: Palette → Import. In
Piskel, add the hex codes by hand.

The palette also has three **marker** colours. They are never drawn in
the game (see [Markers](#5-markers-not-drawn-in-the-game)):

| Colour    | Marker   |
| --------- | -------- |
| `#ff00ff` | `anchor` |
| `#00ffff` | `hit`    |
| `#00ff00` | `fx`     |

## 3. Canvas and size

| What   | Canvas         | Notes                                      |
| ------ | -------------- | ------------------------------------------ |
| Hero   | **32×64**      | Faces **right** (towards the mob)          |
| Mobs   | 32×32 to 48×48 | Face **left** (towards the hero)           |
| Boss   | 64×64 to 96×96 | Faces left                                 |
| Weapon | about 24×8     | One drawing per direction (see below)      |

- **Feet on the bottom row.** The game stands every sprite on its bottom
  row. Empty rows under the feet make the character float.
- **Same canvas for every frame** of a character.
- **1 px = 1 game pixel.** The game scales it up (×4 to ×6) without
  blurring. Never draw at 2× or 3×.
- No anti-aliasing and no soft brushes: pencil tool only.

## 4. Animations

Each animation is a row of frames. In Aseprite, select the frames and
**tag** them with the animation's name.

**Hero:**

| Tag      | Frames | Rules                                                      |
| -------- | ------ | ---------------------------------------------------------- |
| `idle`   | 2–4    | Loops forever. Keep it subtle: breathing, coat, scarf.     |
| `slash`  | 3–6    | The attack. Must finish within **1 s**. Mark the hit frame. |
| `hurt`   | 1–3    | About 0.3 s. A knock-back pose is enough.                  |
| `death`  | 3–6    | Plays once, then **holds the last frame**.                 |
| `intro`, `victory` | any | Optional, used once they exist.                     |

**Mobs and boss:** `idle`, `attack`, `hurt`, `death` with the same rules.

A missing tag falls back to `idle`, so you can add animations one at a time.

**Timing:** set each frame's duration in Aseprite (frame properties). For
example, a quick 60 ms swing followed by a 150 ms hold reads much punchier
than equal frames. Without the converter, write the timing in a note (see
[Today](#today-hand-over-a-png)).

**Tips:**

- Draw the **key poses** first (wind-up, hit, recover), then add
  in-betweens.
- Turn on **onion skin** to see the previous and next frames faintly.
- Exaggerate: the game is small, so a 1 px move is barely visible. Move
  hands, hat and coat by 2–4 px.
- Keep the outline the same thickness on every frame, or it flickers.
- Play it in a loop in the editor before handing it over.

## 5. Markers (not drawn in the game)

Put markers on a **separate layer** with the marker's name, one pixel per
frame:

- **`anchor`** (`#ff00ff`): where the weapon grip sits in the hand. Put one
  on every frame that holds the weapon. Write the blade direction in the
  layer or frame note: `up`, `upFwd`, `fwd`, `downFwd` or `back`.
- **`hit`** (`#00ffff`): one pixel on the frame where the attack lands.
  Damage, the target's flash and the hit sound all happen on that frame.
- **`fx`** (`#00ff00`): where the slash arc or other effect starts.

No markers? That's fine: the art thread places them by eye.

## 6. Where to save

Your own drawings may be **committed publicly**:

```
art/
  afk-palette.gpl
  hero.aseprite          ← your source file (or .png)
  hero.png + hero.json   ← export, once the converter exists
  mobs/mushroom.aseprite
```

Only **other people's** images (inspiration from games and anime) go into
`references/**/_private/`. That folder is gitignored and never published.

## Today: hand over a PNG

1. Draw the frames on one canvas, side by side, as a **horizontal strip**
   (e.g. 4 hero frames = 128×64).
2. Export as PNG: `art/hero-slash.png`, `art/hero-idle.png`, …
3. Optional: add `art/hero-slash.md` with notes:
   ```
   frames: 4
   durations: 100, 60, 150, 120 ms
   hit: frame 3
   weapon grip: frame 1 (12,40) back · frame 3 (28,29) fwd
   ```
4. Tell the planning thread ("new hero slash in art/"). The art thread copies
   the pixels in exactly and shows a preview.

## With the converter

Once it's built:

1. Save your `.aseprite` file in `art/`.
2. Export: _File → Export Sprite Sheet_ → Layout: **horizontal strip**,
   Output: **PNG + JSON data**, tick **Tags** and **Layers**. Save as
   `art/hero.png`. Aseprite remembers this, so next time it's _Ctrl+E_.
3. Run `npm run sprites` (or keep `npm run sprites -- --watch` running and
   just save).
4. The converter checks every pixel against the palette and reports
   problems precisely, e.g.
   `hero slash frame 2 (14,30): #ff00fe is not in the palette`.
5. Open the game (`npm run dev`) or the sprite list
   (`/demo/sprites.html`). With watch mode, the game reloads by itself.

## Checklist before you hand it over

- [ ] Only palette colours, transparent background
- [ ] Right canvas size, same on every frame
- [ ] Feet on the bottom row
- [ ] Facing the right way (hero → right, mobs → left)
- [ ] Animations tagged (or files named `hero-<tag>.png`)
- [ ] `slash`/`attack` finishes within 1 s, hit frame marked or noted
