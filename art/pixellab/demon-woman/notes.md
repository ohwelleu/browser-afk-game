# Demon woman: PixelLab MCP test (2026-11-07)

One enemy character made with the PixelLab MCP, forced onto the game palette.
Tool test only: she is **not** wired into the game.

- Final: `demon-woman.png` (64×64, transparent, 10-colour palette, 9 used).
  Standing fight stance, side view facing left, holding an iron-sword-style
  blade. Feet on the bottom row, horns at row 4 (so about 60 px of figure on
  a 64 px canvas).
- Preview at 3× (hero 32×64, her, 1.1 mushroom mob 24×24): `preview.png`.
- All tries: `candidates/` (sheet: `candidates-sheet.png`, 4×, left to right
  a1 a2 a3 a4 a5 b1 b2 b3).
- References made from the game's own sprite data: `refs/`
  (`export-refs.mjs`).
- Helper scripts: `check-palette.mjs` (off-palette pixels), `zoom.mjs`
  (nearest-neighbour contact sheet / preview), `convert-check.mts` (runs
  the converter's checks on a folder without writing into `src/`).

No token or secret is stored anywhere in this folder. Uploads used PixelLab's
temporary `get_upload_url` (the `upload:<id>` refs expire after 3 days).

## Palette used (`palette` / palette image)

`["#1f1f1f","#ece9e2","#ff6b00","#eab308","#dc2626","#7c3aed","#16a34a","#2563eb","#db2777","#8b5a2b"]`

`refs/palette.png` is the same 10 colours as a 40×4 strip (used as
`color_image_url` for pixflux).

## Balance and spend

| | |
| --- | --- |
| Balance before | 40 generations remaining (trial plan, 0 used, `$0.00` credits) |
| Balance after | 20.90 remaining, 19.10 used |
| Cap from the brief | 30 generations; stopped at 19.1 |

Only **one job runs at a time** on this plan: a second call while one was
running returned `rate limit exceeded (1/1 jobs)` (no charge), so the three
first calls were made one after another.

## Calls (in order)

Common `description` core for the first tries: "demon woman warrior in fight
stance holding a straight sword with cross guard, red skin, curved horns,
tail, curvy figure, confident seductive pose, purple armour-like bikini outfit
with gold buckles, …" (clothed, no nudity).

| # | Tool | Key parameters | Job id | Gens | Time | Result |
| - | ---- | -------------- | ------ | ---- | ---- | ------ |
| a1 | `create_image_pixflux` | 48×64, `no_background`, direction west, view side, outline "single color black outline", shading "basic shading", `color_image_url`=palette strip, seed 11. Description ended "…ink outline, side view facing left" | `f799635d-56f4-4160-bafb-5ab6f48b2c51` | 1 | 22 s | 0 off-palette px. Left-facing, sword points down-left, outline broken, face noisy |
| a2 | `create_image_pixflux` | same, shading "flat shading", seed 22 | `33ee9f32-ba6a-45ee-a427-6f645bf323d0` | 1 | 21 s | 0 off-palette px. Better sword, slim body, still messy red/black noise |
| a3 | `create_image_pixen` | 48×64, `no_background`, direction west, view side, outline black, seed 33, no palette option exists. Description ended "limited colours: red, purple, gold, near-black outline" | `ff149584-c91e-4478-ae28-17f71bf086cf` | 1 | 47 s | Best looking art, but 32 colours (1573 of 1573 px off-palette), front-facing wide stance, sword over the shoulder |
| a4 | `reduce_colors` on a3 | `palette_image_url`=palette strip, dithering none | `dcec5ded-7c79-4ec5-8279-e5be66ac9052` | 0.1 | ~1 s | 0 off-palette px, but the nearest-colour snap turns the shading into blue/yellow speckle. Not usable |
| a5 | `create_image_pixflux` | 48×64, "side profile … facing left … both hands holding a straight steel sword …", shading "medium shading", detail "medium detail", `text_guidance_scale` 10, palette strip, seed 44 | `16bac5e6-8412-4ada-8690-3b0a19ead48f` | 1 | 27 s | 0 off-palette px, but a speckled mess; sword is a thin stick |
| b1 | `create_image_pro_flash` | 64×64, `no_background`, `palette` (10 hex) + `palette_name` "AFK game", `style_image.url`=hero-idle.png (`usage_description`: match ink outline, flat shading, chunky pixel style), seed 55. Description: "demon woman warrior in a fight stance seen from the side, facing left, holding a straight sword with a cross guard …" | `5839eaf9-7779-4d38-86d5-81c4974f3973` (image `23016f3a-3a1f-5180-bd9d-775be6840a77`) | 5 | 19 s | 0 off-palette px, clean profile facing left. Sword hollow/thin |
| b2 | `create_image_pro_flash` | same, description now "gripping a straight iron sword with a pale blade, blue edge and flared cross guard held out in front of her … clothed", seed 56 | `4d61147d-c3de-473a-8104-377f50c8c361` (image `d8a2a424-7a75-5b37-b695-9cf28b1a59ec`) | 5 | 20 s | 0 off-palette px, good sword, but orange noise on the chest |
| b3 | `create_image_pro_flash` | same as b2, seed 57 | `fa210fc9-be6b-4509-baa5-f80dda9bedaf` (image `b9e8e6fd-f754-518f-bea3-4a6e0f460632`) | 5 | 18 s | **Chosen.** 0 off-palette px, clean profile, readable sword, curvy |

Total: 1+1+1+0.1+1+5+5+5 = **19.1** generations (matches `get_balance`).
Reference uploads (`get_upload_url`), `get_pro_flash_capabilities` (quote:
64×64 create = 5 generations), `wait_for_jobs`, `get_image` and `get_balance`
are free.

Not used: `create_character` (pro, 10+ gens, 8 directions): not needed for a
single static left-facing pose, and pro mode ignores style and proportion
hints. `unzoom_image` / `correct_pixelart`: the pixels were already crisp
(no semi-transparent pixels, native grid), so there was nothing to fix.

## Checks on the final

- Own checker (`node art/pixellab/demon-woman/check-palette.mjs art/pixellab/demon-woman/demon-woman.png`): 64×64, 1143 opaque px, 0 semi-transparent,
  **0 off-palette px**. Colours used: ink, bg/cut-out, orange, yellow, red,
  purple, blue, pink, brown (no green).
- Sprite converter (`buildSprites` from `scripts/sprites/build.ts` with
  `--frame 64x64`, run on a temp folder holding only this PNG so nothing is
  written to `src/`): `demon-woman 1f`, **palette check OK, 0 errors**.
- Bounding box: x 1–57, y 4–63 (feet on the last row).

## What worked

- `palette` on `create_image_pro_flash` and `color_image_url` on
  `create_image_pixflux` really do force the colours: every try that used
  them has 0 off-palette pixels and no anti-aliasing.
- Pro Flash with the hero as `style_image` gave a clean, readable side
  profile facing left in a fight stance, with a visible sword, in about 20 s
  per image. The prompt was followed well (horns, tail, curvy figure,
  clothed armour outfit in purple/gold).
- Cheap pixflux tries (1 gen, ~22 s) are good for checking the palette fit and
  rough pose before paying for Pro Flash.

## What failed or is weak

- Pixflux (and the pixen model without palette) are noisy at 48×64: speckled
  skin, broken outlines, a thin stick instead of a sword. The forced palette
  has only one red and no mid-tones, so the model fills the shading with
  random purple/orange/pink pixels.
- Pixen has no `palette` parameter. `reduce_colors` to the palette (0.1)
  gives speckle (see a4). Not an option for good art.
- Pro Flash is 5 gens per image at 64×64 and has no seed-stable edit loop in
  this test: b1/b2/b3 differ a lot, so it is a re-roll game (3 tries, one
  good).
- Style: the hero is a flat ink silhouette with few colours; she has far more
  detail and colour. Next to the hero (`preview.png`) she looks like a
  different game. The `style_image` helped the outline but not the flatness.
- Her sword is not a pixel copy of the game's iron sword: it is longer and the
  blue edge is dotted. Describing it in words worked better than nothing; no
  tool takes the sword as a hard shape reference (Pro Flash allows one style
  image only, `max_reference_images` 0).
- Concurrency: 1 job at a time.

## Recommendation

See the PR body.
