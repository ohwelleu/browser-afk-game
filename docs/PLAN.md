# v1 plan (concept)

Goal: a playable concept of the core loop. Kill mobs → earn coins → buy
upgrades → push stages. Numbers below are **placeholders** to tune with the
debug panel.

## Core flow

1. The page loads with a still scene and the hint "click to start". After the
   first start, the game remembers it and auto-starts next time (unless
   `prefers-reduced-motion`).
2. Mobs spawn on the right and walk left until they reach the hero.
3. The hero attacks the nearest mob in range on his own (sword slash animation).
4. Each kill drops coins, which fly to the coin counter.
5. After `KILLS_PER_STAGE` kills the stage is cleared → next stage.
6. Stages are numbered `world.stage`: `1.1 … 1.5` are normal and `1.6` is the
   **boss**. Killing the boss → `2.1`, and so on, forever.
7. No resets. The hero keeps all weapons and upgrades as he goes.

## Hero

- Stands on the left; idle bob animation plus a 3–4 frame slash.
- Stats: `damage`, `attackInterval`, `maxHp`.
- Mobs touching the hero deal contact damage per second.
- The hero heals to full when a stage starts.

### Death & auto-advance

- **Auto-advance** toggle in the menu (default ON).
- ON: clearing a stage moves to the next stage.
- When the hero **dies**: roll back one stage (`2.1 → 1.6`, `1.1` stays
  `1.1`), turn **auto-advance OFF** and farm that stage in a loop.
- The player buys upgrades and turns auto-advance back ON → the hero moves to
  the next stage right away.

## Mobs

All mobs have a walk cycle (2–4 frames) and an HP bar above them.

| Mob      | HP mult | Speed | Damage mult | Appears from |
| -------- | ------- | ----- | ----------- | ------------ |
| Mushroom | 1.0     | slow  | 1.0         | x.1          |
| Flower   | 1.5     | mid   | 1.2         | x.2          |
| Chicken  | 0.6     | fast  | 0.8         | x.3          |
| Boss     | 10×     | slow  | 3×          | x.6 only     |

- Boss in v1 = a bigger mushroom (2–3× sprite scale). The boss stage is a
  single boss and is cleared by killing it.

## Scaling (placeholder formulas)

`L = (world - 1) * 6 + stage` (1.1 → 1, 1.6 → 6, 2.1 → 7)

| Value       | Formula                             |
| ----------- | ----------------------------------- |
| Mob HP      | `5 × hpMult × 1.25^(L-1)`           |
| Mob damage  | `2 × dmgMult × 1.18^(L-1)` per sec  |
| Coin drop   | `1 × 1.20^(L-1)` (boss ×10)         |
| Kills/stage | `10`                                |

## Economy & upgrades

Menu is a DOM overlay inside the game box (crisp text, keyboard accessible).

| Upgrade       | Effect                                  | Cost                    |
| ------------- | --------------------------------------- | ----------------------- |
| Buy weapon    | next tier, sets base damage, new sprite | fixed per tier          |
| Damage +      | `damage = base × (1 + 0.10 × level)`    | `10 × 1.15^level`       |
| Speed +       | `interval = 1.0s × 0.95^level`, ≥ 0.25s | `15 × 1.20^level`       |

| Weapon       | Base damage | Cost |
| ------------ | ----------- | ---- |
| Stick        | 1           | –    |
| Wooden sword | 3           | 50   |
| Stone sword  | 8           | 300  |
| Iron sword   | 20          | 1500 |
| Gold sword   | 50          | 8000 |

Damage/speed levels are kept when you buy a new weapon.

## Save

- `localStorage`, plain JSON with a `version` field (for migrations).
- Autosaves every 5 s and on `visibilitychange` / `pagehide`.
- Saved: coins, weapon tier, upgrade levels, current stage, auto-advance,
  "has started" flag.

## Runtime behaviour

- Fixed-timestep simulation (e.g. 60 ticks/s), rendering on
  `requestAnimationFrame`.
- Pauses when the element is off-screen (`IntersectionObserver`) or the tab
  is hidden. **No offline progress.** Time only counts while it is running.
- Canvas scales by whole numbers with `imageSmoothingEnabled = false` and
  respects `devicePixelRatio`.

## Pixel art

- Sprites are defined in code as small character grids plus a palette
  (e.g. 16×16), rendered once to offscreen canvases and cached. No image
  files.
- Hero/UI use the host theme colours (`--afk-fg`, `--afk-accent`, …). Mobs
  keep their own colours.

## Debug panel

Enabled with the `debug` attribute or the `?afkdebug` URL param:

- +coins (×10 / ×1000), set stage, kill all mobs, god mode
- game speed ×1 / ×5 / ×20
- show stats (DPS, incoming DPS, mob HP at current stage)
- reset save

## Tech

- TypeScript, Vite library mode, zero runtime dependencies.
- Output: `dist/afk-game.js` (registers `<afk-game>`, also exports `mount`).
- `demo/index.html` for development.
- GitHub Action deploys the build + demo to Pages at
  `ohwelleu.github.io/afk-game/`.

## Milestones

1. **Scaffold**: Vite lib build, demo page, `<afk-game>` + `mount/destroy`,
   resizable canvas, fixed-timestep loop, Pages deploy.
2. **Sprites**: hero idle + slash, mushroom/flower/chicken walk, boss, coin.
3. **Combat**: spawn, walk, range, HP bars, damage numbers, death, coins,
   hero HP.
4. **Stages**: `world.stage` progression, boss at x.6, scaling, rollback on
   death, auto-advance toggle.
5. **Shop**: weapons, damage, speed. Save/load.
6. **Debug panel**.
7. **Blog integration**: script tag + `<afk-game>` in the home hero of
   ohwelleu.github.io (en + lt), theme vars mapped to the site palette.
