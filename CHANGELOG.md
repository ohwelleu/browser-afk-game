# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Critical chance**: an upgrade in Shop → Character and an item stat,
  with their own crit damage numbers (#51).
- **Character stats window**: click the HP bar to see DPS, crit chance,
  best weapon and highest stage (#54).
- Animated **rainbow** colour (flowing gradient for frame, fill, text),
  with a demo in the debug panel (#50, #55).

### Changed

- The crow's damage now adds a share of the hero's hit, so it stays useful
  later on (#49).

## [0.4.0] - 2026-11-08

### Added

- **Music: "Gaming Time" by Otrebil**, used with the author's written
  permission. It is the default track for new players and plays as the full
  song with a seamless loop. Credit and link: in the sound popover, in
  Menu → Credits and in the README.
- **Bulk buy**: one amount button (×1 / ×10 / ×100 / MAX) with a popover
  next to every Buy and Upgrade button.
- **Share link**: copy a link ending in `#save=AFK1…` that loads your save
  on another device, with a preview and a confirm first. The UI now says
  plainly that a save can be edited by anyone who reads the code.
- **One-tab guard**: only one browser tab runs the game and writes the save,
  so two open tabs can't overwrite each other.
- Demo pages link to each other (game, sprites, music & SFX); the music page
  lists every track in the registry.
- Art test: a PixelLab demon-woman boss sprite in `art/pixellab/` (not used
  in the game yet).

### Changed

- **Upgrades are bought in the Shop** for weapons and the crow, not only
  in Inventory.
- **Help is a small pixel (i) button** instead of a menu tab; it opens
  Credits.
- Docs: owner decisions, plan and backlog updates.

### Fixed

- The sound popover's close button no longer overlaps the on/off button.

## [0.3.0] - 2026-11-02

### Added

- **Crow companion**: unlocks in the Weapons tab after 1.1 is cleared (25
  coins) and pecks the mob when you click or tap the game (0.5 s cooldown).
  Upgrades: damage, auto attack (150, every 3.0 s) and speed (down to
  1.0 s). Crow damage numbers have their own colour. It sits on the hero's
  hat and uses its own sprites (idle, fly-out, peck with an impact spark,
  fly-back).
- Clicking or tapping the game shows a small pixel burst, even while the
  crow is on cooldown.
- **Rings and pendants** (tiers C/B/A/S) drop from monsters, with damage,
  defence, speed and item find. 20-slot bag, equip/unequip/sell in
  Inventory, a drop toast, and a sparkle for S items.
- **Shop → Character** with a **Defence** upgrade bought with coins. Each
  level makes mob hits weaker.
- **Save and load in Menu → Help**: copy or download the save string, paste
  or upload one to continue elsewhere. A preview and a confirm come first,
  and the replaced game is kept as the backup.
- Item sprites: ring and pendant icons, tier frames C/B/A/S (S glows and
  sparkles), empty slot frame. Crow sprites (idle, fly-out, peck, fly-back),
  shop icon and peck effect.
- Max DPS stat (highest hero damage per second), saved with kills/deaths
  and shown in the debug panel.
- `npm run sprites`: converts PNG strips in `art/` into text sprites in
  `src/sprites/generated/`, with exact palette errors (frame, x, y,
  colour). Not used by the game yet.
- Design doc `docs/design/active-play.md` (crow, items).
- Debugger: crow fields, Give item (slot + tier), Force drop on next kill,
  Clear bag; live crow DPS, item totals and drop chance; the save string
  with a copy button, main/backup status and a "corrupt main save" button
  to test the backup.
- Debug: font picker (`?afkdebug` → Font, and Compare all fonts) to try
  17 pixel fonts live; candidates load from `demo/fonts/`, not the bundle.
- Sprite converter reads Aseprite sprite sheets (PNG + JSON, Array or Hash):
  each tag becomes an animation, frame durations are kept.
- Palette: new brown accent (slot `N`, `--afk-brown`), also in the PNG
  converter and `art/afk-palette.gpl`.
- Docs: `docs/COLORS.md` lists every colour in both themes, with swatches
  and sprite pictures. `npm run colors-doc` regenerates the colour images
  and table from the code.

### Fixed

- Sword icons in the menu no longer spill out of their box.

### Changed

- Buying a weapon equips it right away if it hits at least as hard as the
  current one.
- **Menu**: the Upgrades tab is gone; weapons and the crow are upgraded in
  Inventory. The Weapons tab is now **Shop** with sub tabs Weapons ·
  Companions · Ascend (coming soon), and shows when the crow unlocks.
  Inventory has sub tabs Weapons · Companions · Accessories.
- **Bigger swords**: about twice as long to match the 32×64 hero, each tier
  with its own guard, grip and pommel. The wind-up raises the sword overhead,
  and slash arcs grow with the tier.
- **Save string**: saves are stored as a checksummed `AFK1.…` string with a
  backup slot (`<save-key>.bak`). A damaged save falls back to the backup,
  then to a new game, and never crashes. Old plain-JSON saves load as before
  and are converted on the next save.
- **Defence** (upgrade and rings/pendants) cuts mob hits by a percentage:
  `dmg × 100 / (100 + defence)`, at least 1.
- Save data version 4 (2 adds `items`, 3 `companion`, 4
  `character.defenceLevel`). Old saves load with an empty bag, an empty
  companion slot and defence level 0.
- **Pixel font**: all UI text (HUD, menus, buttons, damage numbers, stage
  banner) uses Press Start 2P (for now; the debug font picker compares
  others), embedded as a 4 KB WOFF2 subset (Latin + Lithuanian) renamed
  "AFK Start" as its licence requires. Sizes snap to its 8 px grid (8 px
  text, 16 px menu titles), so text is crisp. No bold face, so bold is
  never faked.
- **Synthwave** is now the default music for new players; the music switch
  cycles Synthwave → Medieval → Off. Existing saves keep their chosen track.
- Shop → Weapons shows a weapon only when you have 90 % of its price. Once
  shown it stays, and a long AFK can reveal several at once.
- Save data version 5 adds `revealedWeapons`. Old saves keep every weapon
  you own plus anything you can nearly afford.
- Wooden sword and its slash arc are now brown wood instead of orange.
- `art/hero-idle.png` re-exported in the exact palette colours, feet on the
  bottom row.
- Plan and backlog updated: milestones marked done; new items for the sprite
  tool, defence and speed upgrades, crossbow and more weapons, item rarity
  tiers, auras, clicker, skills, ascend, shop tabs, save sharing, Firebase
  ranking, new music and a simulation blog post. New `docs/WORKFLOW.md`.

## [0.2.0] - 2026-11-01

### Added

- Project scaffold: TypeScript + Vite library build, Vitest, Prettier.
- `<afk-game>` custom element (Shadow DOM) with `save-key`, `theme` and
  `debug` attributes; `mount(el, opts)` / `destroy()` and `version` exports.
- `dist/afk-game.js` (script tag, `window.AfkGame`) and `dist/afk-game.mjs`
  (ES module).
- Resizable canvas with whole-number pixel scaling, fixed-timestep loop,
  pause when off-screen or in a hidden tab.
- Start/Continue button; nothing runs before it is pressed.
- Theme colours with `--afk-*` CSS var overrides; `auto` follows the host
  page.
- Demo page with theme toggle; CI and GitHub Pages deploy.
- Sprite set defined in code: hero, 5 weapon tiers as overlays, per-tier
  slash arcs, mushroom/flower/chicken mobs, boss mushroom, coin and menu
  icons. Sprite preview page (`demo/sprites.html`) and a sprite validator
  test.
- Audio module: music and SFX buses, master mute and limiter, starts only
  after Start. Pluggable music tracks: `synth` (step sequencer) and `file`
  (looping OGG/MP3).
- Two prototype loops: medieval ambient (D Dorian) and synthwave chill
  (A minor). 8 retro sound effects made with ZzFX (vendored, MIT).
  `demo/audio.html` to listen to them.
- Playable duel demo: the hero and one mob per stage fight 1-on-1 (hits
  every second, damage on the hit frame). A 2 s intro with a stage banner
  the first time a stage is reached; other fights start after a short beat.
- Stages `W.S` with a boss at `x.6`, auto-advance, step back one stage on
  death, easier world 1.
- Coins, per-weapon damage upgrades, weapon shop (Stick → Gold sword),
  inventory with instant equip.
- HUD: hero HP, coins, stage, pause, music switch (Medieval / Synthwave /
  Off), sound settings (mute, music and effects volume, saved), menu, and an
  always-visible auto-advance toggle.
- Floating damage numbers, hit flash, mob HP bar, intro banner.
- Sound effect mixing (priority, cooldown, voice cap).
- Autosave to `localStorage` (every 5 s, after purchases and stage changes,
  on tab hide); Continue restores progress and audio settings.
- Debugger panel (`debug` / `?afkdebug`): live stats, reset all progress,
  and an editor for every saved value (fields + raw JSON) that validates
  before applying.
- Menu with tabs: Upgrades, Weapons shop, Inventory and Help & credits, with
  keyboard navigation. All dialogs share one modal helper ([X], Esc, click
  outside, focus trap).
- Mobile layout (game box under 768 px): stacked 44 px controls and bigger
  characters.
- Sprite guide `docs/SPRITES.md` and palette file `art/afk-palette.gpl` for
  drawing your own sprites and animations.

### Changed

- **Hero v2**: the owner's own 32×64 assassin sprite (red eye, white hand),
  copied pixel for pixel. Its attack is now a slap with the white hand.
- Game design moved from walking mobs to **1-on-1 duels** (one mob per
  stage, timed attacks).
- The game box is 546 px tall by default; the art scale adapts to the sprite
  sizes (8× in the default box).
- Repo renamed to `browser-afk-game`. The element stays `<afk-game>` and the
  bundle stays `afk-game.js`.

### Removed

- The ground line.

## [0.1.0] - 2026-10-31

### Added

- Project docs: README with embed instructions, v1 plan, roadmap, decision
  log, and this changelog.

[Unreleased]: https://github.com/ohwelleu/browser-afk-game/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/ohwelleu/browser-afk-game/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/ohwelleu/browser-afk-game/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ohwelleu/browser-afk-game/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ohwelleu/browser-afk-game/releases/tag/v0.1.0
