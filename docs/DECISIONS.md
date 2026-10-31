# Decisions

Short log of choices and why. Newest at the bottom.

## 2026-10-31: Separate repo, embeddable via script tag

The game lives in its own repo, not inside the blog. Any page can use it with
one `<script>` plus an `<afk-game>` element. The blog stays simple, and the
game gets its own demo and its own release cycle.

## 2026-10-31: Host on GitHub Pages, not npm (for now)

`ohwelleu/browser-afk-game` Pages is served at `ohwelleu.github.io/browser-afk-game/`, the
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

Two candidates (drum and bass dropped on 2026-10-31: too high energy for an
idle game on a blog):

- **Medieval ambient**: fits the sword/fantasy theme, calm. It can probably
  be **synthesized** too, not only recorded. Karplus-Strong plucked strings
  sound like a lute or harp, a sine/triangle wave with vibrato gives a
  recorder or flute, held fifths give a bagpipe or hurdy-gurdy drone, and
  modal scales (Dorian, Mixolydian) give the "old" sound. Fallback: CC0 or
  commissioned recordings (`file` track, ~1–3 MB).
- **Retro synthwave chill**: fits the pixel art and the dark site, calm,
  easy to synthesize (pads, arpeggio, soft beat).

Plan: in the audio milestone, prototype a short `synth` loop of **both** and
pick by ear. The `Track` interface supports `synth` and `file`, so the choice
can change later without code changes outside `audio/`.

## 2026-10-31: Fixed 2-colour base + 7 item colours

Base `#1f1f1f` / `#ece9e2` (swap with dark/light) for sprites, text and
borders. Item/gadget colours: the site's orange/purple/green/blue plus
yellow, red, pink, each with a light and a dark shade.

## 2026-10-31: Vampire hunter hero, ~32×32 sprites

A gothic hunter (hat, long coat, stakes) gives the game a theme and leaves
room for bats/ghouls/vampires later. Resolution is a step up from the Chrome
dino (~20×22): hero 32×32, mobs 24×24, boss 48×48.

## 2026-10-31: Vendor ZzFX instead of the npm package

The npm module creates an `AudioContext` on import and connects straight to
the speakers. That would bypass our music/SFX buses and break "no audio
before Start". Only its sample generator is copied, with the MIT header.

## 2026-10-31: Attacks modelled as data

Planned: crossbow and large sword weapon types, and upgradable attack skills
(slash → double slash → spin, etc.). v1 ships only the sword slash, but the
attack is an `AttackDef` (animation, effect, hit frame, range, targeting,
damage multiplier), so new weapons and skills are content, not rewrites.

## 2026-10-31: Duel combat instead of walking mobs

Each stage is one 1-on-1 fight. The hero is on the left and the mob on the
right, both large and far apart in a ~546 px box. Nobody walks. Attacks run on
timers (hero 1.0 s, mob 1.0 s, mob offset by 0.5 s). This replaces the
earlier "mobs spawn and walk in, 10 kills per stage" design.

## 2026-10-31: Upgrades per weapon, damage = base × level

Each weapon has its own level, so an upgraded old weapon can beat a new
one. Costs grow 1.15× per level. Weapons step ×6 in damage and ×30 in price.

## 2026-10-31: Mob damage grows slowly while hero HP is fixed

No HP upgrades in v1, so mob damage grows only 1.05× per stage. Faster
growth made a wall that damage upgrades couldn't fix (seen in simulation).

## 2026-10-31: Save as a checksummed string with backup and export

`AFK1.<base64url(JSON)>.<checksum>` in `localStorage`, plus a `.bak` slot.
The same string is used for export/import between browsers. The checksum
catches corruption and casual edits but is not anti-cheat.

## 2026-10-31: Animation and sound priority

`death > attack > hurt > idle`. Getting hit while attacking shows a flash
overlay instead of interrupting. Sounds follow the same priority, with
per-sound cooldowns and a voice limit.

## 2026-10-31: Hero stays 32×64; weapons and mobs scale up to match

The hero is the user's own 32×64 sprite. Weapons (drawn for the old 32×32
hero) get redrawn about 2× longer, and mobs and the boss get bigger, so the
duel reads at the new scale.

## 2026-10-31: The user draws sprites; a converter brings them into the game

Art is drawn in Aseprite or LibreSprite with a fixed palette file. A
converter turns the exports (tags = animations, frame durations, marker
layers for the hit frame and weapon grip) into the text sprite format. The
user's own art files can be committed publicly. Third-party references stay
in `_private/`.
