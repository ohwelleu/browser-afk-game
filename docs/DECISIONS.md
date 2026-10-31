# Decisions

Short log of choices and why. Newest at the bottom.

## 2026-10-31: Separate repo, embeddable via script tag

The game lives in its own repo, not inside the blog. Any page can use it with
one `<script>` plus an `<afk-game>` element. The blog stays simple, and the
game gets its own demo and its own release cycle.

## 2026-10-31: Host on GitHub Pages, not npm (for now)

`ohwelleu/afk-game` Pages is served at `ohwelleu.github.io/afk-game/`, the
same origin as the blog. That gives a short relative path, a shared
`localStorage` and no CORS. An Action deploys on push. No npm account or
publish step needed. jsDelivr was rejected for now because it needs `dist/`
committed and caches hard, which hurts debugging. npm can come later.

## 2026-10-31: localStorage, not cookies

Cookies are sent with every request to the domain and are capped at about
4 KB. `localStorage` is meant for client-side state. The save is plain JSON
for now so it is easy to debug. Save integrity goes on the roadmap.

## 2026-10-31: No offline progress

Progress only happens while the game is running in the browser. It pauses
when off-screen or when the tab is hidden.

## 2026-10-31: Endless stages, no reset in v1

`1.1 … 1.5`, boss `1.6`, then `2.1` … forever. The hero keeps everything.
Resets come later together with prestige badges.

## 2026-10-31: Death → roll back one stage, auto-advance off

Keeps the hero farming a stage he can beat until the player upgrades and
turns auto-advance back on.

## 2026-10-31: Sprites in code, no image files

Pixel grids plus a palette, cached to offscreen canvases. The bundle stays
small, and the hero/UI can recolour to the host site's theme.

## 2026-10-31: Start button every load

Browsers block audio until a user click, and a blog should not start making
noise or burning CPU on its own. The game always waits for Start/Continue.

## 2026-10-31: Music and SFX generated with Web Audio

Chiptune notes are defined in code and played through oscillators, the same
approach as the sprites. No audio files to download, tiny bundle, easy to
tweak.

## 2026-10-31: Semantic versioning + Keep a Changelog

`package.json` is the source of truth for the version. Each release has a
`CHANGELOG.md` entry, a `vX.Y.Z` tag and a GitHub Release. `0.x` while it
is a concept, `1.0.0` when it goes on the blog.

## 2026-10-31: Vanilla TypeScript + Canvas 2D, no engine

About 10 entities in a short strip. Engines (Phaser ~1 MB, PixiJS ~200 KB)
add size and their own way of doing things for features we don't use.
Revisit if we need heavy particles/effects (PixiJS) or physics.

## 2026-10-31: 1-bit art with colour accents

Matches the personal site: a flat `--bg` background, sprites in `--fg`
(inverting with dark/light), and small colour pixels (site accent + a few
fixed extras) for details.

## 2026-10-31: ZzFX for sound effects

~1 KB, MIT, sounds defined as number arrays. Fits "no asset files" and
retro style.

## Open: music style

Candidates: **medieval ambient**, **retro synthwave chill**, **drum and
bass**. Placeholder for now: synthwave chill, because it can be generated
in code at no file cost.

- Medieval ambient needs real-instrument recordings (`file` track, ~1–3 MB,
  CC0 or commissioned). Fits the sword/fantasy theme, calm.
- Synthwave chill can be fully synthesized (`synth` track). Fits the
  pixel/dark-site look, calm.
- Drum and bass needs good drum samples. High energy, can get tiring on
  loop in an idle game.

The `Track` interface supports both kinds, so this choice can be made later
without code changes outside `audio/`.
