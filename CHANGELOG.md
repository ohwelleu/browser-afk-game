# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Plan and backlog updated: milestones marked done; new items for the sprite
  tool, defence and speed upgrades, crossbow and more weapons, item rarity
  tiers, auras, clicker, skills, ascend, shop tabs, save sharing, Firebase
  ranking, new music and a simulation blog post.

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

[Unreleased]: https://github.com/ohwelleu/browser-afk-game/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/ohwelleu/browser-afk-game/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ohwelleu/browser-afk-game/releases/tag/v0.1.0
