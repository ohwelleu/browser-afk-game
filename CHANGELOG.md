# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Start/Continue button and chiptune music + SFX to the v1 plan.
- Versioning rules (semver, tags, GitHub Releases) to the plan.
- Tech stack: vanilla TypeScript + Canvas 2D, Vite, Vitest, ZzFX, Shadow DOM.
- Art direction: 2-colour base (`#1f1f1f` / `#ece9e2`) with 7 item colours
  (orange, purple, green, blue, yellow, red, pink).
- Vampire hunter hero; sprite sizes 32×32 hero, 24×24 mobs, 48×48 boss.
- `theme` attribute (`dark` / `light` / `auto`).
- Pluggable music tracks (`synth` / `file`). Prototype medieval ambient and
  synthwave chill, pick one later.

### Changed

- Repo renamed to `browser-afk-game`. The element stays `<afk-game>` and the
  bundle stays `afk-game.js`.

## [0.1.0] - 2026-10-31

### Added

- Project docs: README with embed instructions, v1 plan, roadmap, decision
  log, and this changelog.

[Unreleased]: https://github.com/ohwelleu/browser-afk-game/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ohwelleu/browser-afk-game/releases/tag/v0.1.0
