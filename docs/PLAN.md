# v1 plan (concept)

Goal: a playable concept of the core loop. Kill mobs → earn coins → buy
upgrades → push stages. Numbers below are **placeholders** to tune with the
debug panel.

## Core flow (duel)

The game is a series of **1-on-1 duels**. Nobody walks. Each stage is one fight.

1. The page shows a still scene with a **Start** button (or "Continue · W.S"
   when a save exists). Nothing runs or plays before the click, which also
   unlocks audio.
2. The **hero** appears on the left and the **mob** on the right, far apart.
   Both are large (see [Layout](#layout)).
3. After a **2 s intro** the duel starts. Neither side moves. Each side plays
   its attack animation on its own timer:
   - hero: every `heroInterval` (1.0 s, upgradable later), first hit at 2.0 s
   - mob: every `mobInterval` (1.0 s, per mob type), first hit at **2.5 s**.
     The half-interval offset stops both from landing on the same tick at
     the start.
   - Each landed hit: a damage number pops up, the target's HP bar drops,
     and the hit effect (slash arc) plays.
4. The duel ends when one side reaches 0 HP.

**Mob dies:**
- The mob plays its death animation and drops coins (they fly to the counter).
- Auto-advance **on**: go to the next stage. The next mob just appears (no
  walk-in).
- Auto-advance **off**: stay on the same stage and a new mob of that stage
  appears (farming).

**Hero dies:**
- The hero plays his death animation.
- Go back one stage (`2.1 → 1.6`, `1.1` stays `1.1`) and turn
  auto-advance **off**.
- Turning auto-advance back on moves to the next stage right after the
  current fight.

**Stages:** `world.stage`. `x.1 … x.5` are normal mobs, `x.6` is the
**boss**. After the boss comes `(world+1).1`. It goes on forever, with no
resets in v1 (prestige later).

**Hero HP:** full heal at the start of every duel.

**World 1 is a tutorial:** mobs have half HP and half damage until `2.1`,
so a new player can't really lose there.

## Attacks are data (future-proofing)

v1 has a single weapon type (sword) and a single attack (horizontal slash).
Code must still model an attack as **data**, not a hardcoded slash, so
weapon types (crossbow, large sword) and upgradable skills can be added
later without a rewrite:

```ts
type AttackDef = {
  id: string;            // "slash"
  heroAnim: string;      // hero animation to play
  effect?: string;       // effect sprite (slash arc, projectile, …)
  hitFrame: number;      // animation frame where damage lands
  interval: number;      // seconds between attacks (1.0 in v1)
  targets: "single" | "all" | "projectile"; // v1: single (the duel mob)
  damageMult: number;
};
```

Weapons point to a weapon type, and a type lists the attacks it can use.
See [ROADMAP.md](ROADMAP.md#weapon-types).

## Layout

The game box is about **546 px tall** (full container width). Large
characters, far apart.

```
┌────────────────────────────────────────────────────────────────┐
│ ♥ ████████░░ 82/100      STAGE 1.3        [⏸] [♪] [🔇] [☰]    │
│ ● 1,240                                                         │
│                                                                 │
│      HERO (32×64 art px,                       MOB              │
│      drawn at 4× ≈ 256 px)                  (HP bar above)      │
│                                                                 │
│ ─────────────────────────── ground ──────────────────────────── │
└────────────────────────────────────────────────────────────────┘
```

- **Top-left:** hero HP bar (with numbers) and coins. Later: mana bar and
  auras.
- **Top-centre:** the stage (`1.3`, with a boss marker on `x.6`).
- **Top-right:** pause, music switch (Medieval → Synthwave → Off), mute,
  menu (☰).
- **Mob HP bar** sits above the mob.
- Art scale is a whole number (4× on desktop). On narrow or mobile
  screens it drops to 3× or 2× and the box gets shorter. It never scales by
  fractions.
- **Pixel-art font** for all text (see [Font](#font)).

## Menus & modals

All popups are modals inside the game box. Each one has a **square [X]
close button** in the top-right corner. `Esc` also closes them, focus is
trapped inside while one is open, and only one modal is open at a time.
The game keeps running behind a modal (it's an AFK game). Only the pause
button stops it.

- **☰ Menu**
  - **Upgrades**: upgrade the **equipped weapon's** damage. Shows current
    → next damage and the cost. v1: buy ×1. Later: ×10, ×100, MAX buttons
    (bulk cost formula below).
  - **Weapons (shop)**: buy the next weapon. A new weapon starts at level 1,
    so a well-upgraded old weapon can still be better than a new one.
  - **Inventory**: owned weapons with their level and damage. **Equip**
    switches instantly (damage changes immediately, even mid-duel). Later:
    misc items.
  - **Auto-advance** toggle.
  - **Save**: copy/paste the save string, download/upload `.txt` (see
    [Save](#save)).
  - **Help & credits**: how to play, version, credits (ZzFX MIT, font
    licence, music).
- Damage upgrades and equipping apply **instantly**: the next hit uses the
  new damage.

## Weapons & upgrades

Upgrades are **per weapon**: each owned weapon has its own level.

| Weapon       | Base dmg | Buy price | Upgrade base cost |
| ------------ | -------- | --------- | ----------------- |
| Stick        | 1        | –         | 5                 |
| Wooden sword | 6        | 100       | 60                |
| Stone sword  | 36       | 3,000     | 1,800             |
| Iron sword   | 216      | 90,000    | 54,000            |
| Gold sword   | 1,296    | 2,700,000 | 1,600,000         |

- `damage = baseDmg × level`
- `upgradeCost(level) = upgradeBase × 1.15^(level-1)`
- Bulk buy (for ×10 / ×100 / MAX later), using the standard geometric sum
  from idle-game design:
  - cost of `n` levels from level `k`:
    `upgradeBase × 1.15^(k-1) × (1.15^n − 1) / 0.15`
  - max affordable `n` with `c` coins:
    `floor( log( c × 0.15 / (upgradeBase × 1.15^(k-1)) + 1 ) / log 1.15 )`
- A stick at level 6+ already beats a fresh wooden sword (6 dmg), as wanted.

## Balance (v1 placeholders)

`L = (world − 1) × 6 + stage` (`1.1 → 1`, `1.6 → 6`, `2.1 → 7`)

| Value              | Formula                          | Boss (`x.6`) |
| ------------------ | -------------------------------- | ------------ |
| Mob HP             | `ceil(10 × 1.28^(L−1))`          | ×5           |
| Mob damage per hit | `ceil(4 × 1.05^(L−1))`           | ×2           |
| Coins per kill     | `ceil(4 × 1.30^(L−1))`           | ×5           |
| World 1            | HP and damage ×0.5               |              |
| Hero HP            | 100 (no HP upgrades in v1)       |              |

This follows the usual idle-game pattern: enemy HP and upgrade costs grow
**exponentially**, and the player's damage grows with **levels × weapon
multipliers**. Progress keeps slowing down, and new weapons are the big
jumps. Reference: Kongregate's "The Math of Idle Games" series.

**Mob damage grows slowly (1.05) on purpose.** Hero HP is fixed in v1, so
fast-growing mob damage would hit a wall that damage upgrades can't fix.
Revisit when HP upgrades arrive.

Quick simulation (greedy buyer, 1 s attacks, 2 s intro): world 2 at about
1 min, world 3 at about 9 min, world 4 at about 45 min, then slowing.
Tune with the in-game simulator.

All numbers live in one `src/game/balance.ts` so they can be tuned
without touching logic.

## Safeguards

### Combat & animation

- **One state machine per duel**: `intro → fighting → (mobDying |
  heroDying) → transition → intro`. Each transition happens **once**, so
  there's no double coin drop, double stage advance or double rollback.
- **Fixed timestep** (60 ticks/s). Attacks are scheduled by time and
  resolved in time order inside a tick. Long frames are capped (0.25 s) and
  never "caught up" in a burst.
- **Damage lands on the attack's hit frame**, not at animation start.
- **Dead can't hit.** Once HP ≤ 0, that side's pending attacks are
  cancelled.
- **Same-tick double KO:** the hero wins (player-favouring rule).
- **Animation priority** (standard approach: an animation state machine
  with priorities, plus a separate "hit flash" overlay):
  `death > attack > hurt > idle`.
  - Getting hit **never interrupts** an attack animation. Hurt is shown as
    an **overlay**: a 1–2 frame flash (sprite drawn in a flash colour) plus a
    1–2 px knockback offset and the damage number. The full hurt animation
    only plays when the character is idle.
  - Death overrides everything.
- **Sound priority:** the same rules for audio. The hero's hit sound beats
  the "get hit" sound when both land in the same ~50 ms. Each SFX has a
  per-sound cooldown (no stacking the same sound within 50 ms) and a max
  of about 6 voices at once. Low-priority sounds (coin) drop first.

### Economy & numbers

- Purchases are pure state transitions that check `coins ≥ cost` inside the
  same step. Buttons disable until the state updates (no double-click
  double-buy). Coins can never go negative.
- Integers only for HP, damage and coins (`Math.floor`/`ceil`). Guard every
  number against `NaN` and `Infinity`. Display large numbers with suffixes
  (`1.2K`, `3.4M`, then `1.2e15`).

### Runtime

- Pause button, plus an auto-pause when off-screen or the tab is hidden.
  **No offline progress.**
- **One tab at a time:** if the game is open in two tabs, only one runs
  (`BroadcastChannel`). The other shows "Running in another tab" with a
  take-over button. This stops two tabs overwriting each other's save.

### Save

See [Save](#save): checksum, backup slot, validation, migrations.

## Save

- Stored in `localStorage` as one **save string**:
  `AFK1.<base64url(JSON)>.<checksum>`
  - `AFK1` = format version (for migrations)
  - checksum = a fast hash (e.g. FNV-1a/CRC32) of the payload. It catches
    corruption and casual edits. **Not real anti-cheat** (the key is in the
    JS); see the roadmap.
- Saved: game version, stage, auto-advance, coins, owned weapons + levels,
  equipped weapon, audio settings (track, mute, volumes), stats (kills,
  deaths, play time).
- **Autosave** every 5 s, after every purchase and stage change, and on
  `visibilitychange` / `pagehide`.
- **Backup slot**: the previous good save is kept under `<save-key>.bak`.
  - On load: check the format, checksum and schema (types, ranges, no
    NaN). If it fails, try the backup. If that fails too, start a new game
    and show a notice. Never crash.
- **Export / import** (Menu → Save, for players too):
  - copy the string, or download it as `afk-save-<date>.txt`
  - paste a string, or upload a `.txt`. It is validated, shows a preview
    ("Stage 3.4, 12,400 coins"), and asks for confirmation before it
    overwrites.

## Runtime behaviour

- Fixed-timestep simulation (60 ticks/s), rendering on
  `requestAnimationFrame`.
- Pauses when the element is off-screen (`IntersectionObserver`), the tab
  is hidden, or the player presses pause. **No offline progress.**
- Canvas scales by whole numbers with `imageSmoothingEnabled = false` and
  respects `devicePixelRatio`.

## Font

A pixel-art font for all UI text. It is embedded in the bundle as a subset
WOFF2 (about 10–20 KB) so the one-file embed still works.

- Candidates (all SIL OFL, free to embed): **Pixelify Sans**, **Silkscreen**,
  **Press Start 2P**. Pick the one that is readable at small sizes and has
  the Lithuanian letters (ą č ę ė į š ų ū ž) for i18n later.
- `@font-face` doesn't apply from inside Shadow DOM in every browser, so it
  is registered once on the host `document` under a unique family name
  (`afk-pixel`).

## Audio

- **Music engine:** a `Track` interface with two kinds of source:
  - `synth`: generated with the Web Audio API (oscillators, noise drums, a tiny
    step sequencer, notes defined in code). No files.
  - `file`: a looping audio file (OGG/MP3), for styles that need real
    instruments.
  Swapping or adding tracks (per world, boss theme) never touches game code.
- **v1 tracks:** prototype two short `synth` loops and pick by ear:
  - *medieval ambient*: plucked lute/harp (Karplus-Strong), recorder,
    drone, modal scale
  - *retro synthwave chill*: soft pads, arpeggio, light beat
- **Final music style is undecided.** See
  [DECISIONS.md](DECISIONS.md#open-music-style).
- **SFX:** made with [ZzFX](https://github.com/KilledByAPixel/ZzFX) (~1 KB,
  MIT, each sound is a list of numbers). Sword swing, hit, mob death, coin
  pickup, purchase, hero death, boss appears, stage clear.
- Starts only after the Start button. Pauses with the game (off-screen or tab
  hidden).
- Menu: mute toggle and separate music and SFX volume sliders, saved.
- Default volume is low. Respect the page being a blog, not a game site.

## Pixel art

### Colours

**Base (2 colours):** everything structural uses only these two. They swap
with the theme:

| Use                                  | Dark theme | Light theme |
| ------------------------------------ | ---------- | ----------- |
| Background                           | `#1f1f1f`  | `#ece9e2`   |
| Hero, mobs, ground, text, borders    | `#ece9e2`  | `#1f1f1f`   |

**Item / gadget colours:** for weapons, coins, badges, HP bars, hit flashes
and small sprite details. These are the personal site's button accents plus
yellow, red and pink. Each has a light and a dark shade, like the site:

| Name   | Light theme | Dark theme | Typical use (draft)           |
| ------ | ----------- | ---------- | ----------------------------- |
| orange | `#ff6b00`   | `#ff7a1a`  | coins, fire, site accent      |
| purple | `#7c3aed`   | `#9b6bff`  | magic, rare items, bosses     |
| green  | `#16a34a`   | `#22c55e`  | HP bar, poison, heal          |
| blue   | `#2563eb`   | `#4f8bff`  | steel glint, speed upgrade    |
| yellow | `#eab308`   | `#facc15`  | gold, crits, stage clear      |
| red    | `#dc2626`   | `#ef4444`  | damage numbers, low HP, blood |
| pink   | `#db2777`   | `#f472b6`  | flower mob, special badges    |

Yellow/red/pink hex values are proposals (Tailwind 600/400-ish, to sit next
to the site's colours). Tune them on the demo page.

- The theme comes from the `theme` attribute: `dark`, `light` or `auto`
  (default). `auto` follows the host page (`html.dark` class), then
  `prefers-color-scheme`.
- Every colour can be overridden with CSS vars (`--afk-bg`, `--afk-fg`,
  `--afk-orange`, …).

### Sprite palette slots

| Slot | Colour                                                    |
| ---- | --------------------------------------------------------- |
| `.`  | transparent                                               |
| `#`  | fg (`#ece9e2` / `#1f1f1f`)                                |
| `o`  | bg (eyes, cut-outs, highlights inside a silhouette)       |
| `O Y R P G B K` | orange, yellow, red, purple, green, blue, pink |

Sprites are mostly `#` silhouettes with a few colour pixels. A theme change
rebuilds the cached sprites (cheap).

### Resolution & look

- Reference: the Chrome "no internet" dino, but **a bit more detailed**.
  The dino is about 20×22 art pixels. We go up to:
  - hero: **32×64** art grid (tall and slim; redesign in progress, see
    `references/hero/`)
  - mobs: **24×24** for now. The art thread will propose bigger sizes
    (e.g. 32–48) to suit the duel layout.
  - boss: **48×48** for now (64–96 proposed)
  - coins, icons, badges: **8×8 / 12×12**
- Drawn at a whole-number scale (4× in the ~546 px box, smaller on
  mobile), with no smoothing, so edges stay crisp.
- Flat colours, no gradients, no anti-aliasing, 1px outlines only where
  needed.

### Hero: vampire hunter

A gothic monster-hunter archetype (our own design, not a copy of any film
or game character):

- wide-brim hat, face mostly shaded, maybe glinting eyes (colour pixel)
- long coat flowing at the back, high collar or scarf
- belt with stakes / vials (small colour pixels)
- weapon in hand; the weapon sprite changes per tier (stick → swords → …)
- animations: idle (breathing, coat sways), slash (3–4 frames), hurt
  (flash), death

Fits the mobs too: in later worlds the mushroom/flower/chicken can give way
to bats, ghouls and vampires (see roadmap).

### Storage

Sprites are defined in code as character grids (one char = one pixel, slots
above), rendered once to offscreen canvases and cached. No image files. If
32×32 frames get too painful to hand-edit, switch to indexed-colour PNG
sprite sheets (Piskel/Aseprite), using the same palette slots, so recolouring
still works.

## Debug panel & simulator

Enabled with the `debug` attribute or the `?afkdebug` URL param:

- +coins (×10 / ×1000), set stage, kill mob, god mode
- game speed ×1 / ×5 / ×20
- live stats: hero DPS vs mob DPS, time-to-kill vs time-to-die, mob HP and
  damage for the current stage
- **save as `.txt` / load from `.txt`**, reset save
- **Simulator**: enter weapon, weapon levels and start stage. It outputs
  the stage where the hero will die next, coins earned on the way, and the
  time it takes. Option: "keep buying upgrades greedily" on/off.
  - It runs the **same pure combat and balance code** as the game,
    headless and fast, so it can't drift from the real game.
  - Also available as a CLI for balancing:
    `npm run sim -- --weapon 1 --levels 12,3 --stage 2.1`

## Tech

- **Vanilla TypeScript + Canvas 2D**, no game engine (the scene is tiny;
  Phaser/PixiJS would be 10–50× the size for nothing we need).
- **Vite** library mode for the build, **Vitest** for logic tests,
  **Prettier** for formatting.
- **No runtime dependencies.** ZzFX's sound generator is vendored in
  `src/audio/vendor/zzfx.ts` (MIT header kept).
- Game logic as pure functions (`update(state, dt)`) kept apart from
  rendering, audio and DOM. That makes it testable and debuggable, and leaves
  room for seeded RNG / save hashing later.
- `<afk-game>` uses **Shadow DOM** so host CSS and game CSS never clash.
- Output: `dist/afk-game.js` (registers `<afk-game>`, also exports `mount`).

## Versioning

- [Semantic versioning](https://semver.org): `MAJOR.MINOR.PATCH`, e.g.
  `1.0.1`.
  - PATCH: bug fixes, balance tweaks (`1.0.0 → 1.0.1`)
  - MINOR: new features/content, saves stay compatible (`1.0.1 → 1.1.0`)
  - MAJOR: breaking changes to the embed API or save format without a
    migration (`1.1.0 → 2.0.0`)
- `package.json` `version` is the single source of truth. The build injects
  it, so it is shown in the menu footer and available as
  `AfkGame.version`.
- Every release adds an entry to [CHANGELOG.md](../CHANGELOG.md) and gets a
  git tag `vX.Y.Z` plus a GitHub Release with the changelog notes.
- `0.x.y` while it is a concept. `1.0.0` = first version embedded on the
  blog.
- `demo/index.html` for development.
- GitHub Action deploys the build + demo to Pages at
  `ohwelleu.github.io/browser-afk-game/`.

## Milestones

Done: 1 scaffold, 2 sprites v1, audio module (music + SFX).

3. **Duel core (pure logic)**: duel state machine, timers, damage on hit
   frame, death/advance/rollback, auto-advance, world-1 tutorial rule,
   `balance.ts`, weapons/upgrades/inventory state, all safeguards from
   [Safeguards](#safeguards). Vitest tests plus the `npm run sim` CLI.
4. **Scene & HUD**: 546 px layout, real sprites, animation priority + hit
   flash, damage numbers, coin fly, top bar (HP, coins, stage), pause /
   music switch / mute buttons, pixel font.
5. **Menus**: ☰ menu, Upgrades, Weapons shop, Inventory, Auto-advance,
   Help & credits. Modals with a square [X], Esc and focus trap.
6. **Save v2**: save string with checksum, backup slot, validation,
   export/import (text + `.txt`), one-tab guard.
7. **Debug panel + simulator UI**.
8. **Art & music final**: hero v2 (32×64) from `references/`, mob/boss
   resize, music style pick.
9. **Release `1.0.0`** + **blog integration**: script tag + `<afk-game>`
   in the home hero of ohwelleu.github.io (en + lt), theme vars mapped to
   the site palette.
