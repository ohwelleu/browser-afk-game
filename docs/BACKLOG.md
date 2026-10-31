# Backlog

Things we agreed to do **later**. Owned by the planning thread. Tick items off
when they're done, and move bigger ideas to [ROADMAP.md](ROADMAP.md).

## Art

- [x] **Hero v2**: the user's own 32×64 assassin sprite (branch
      `art/hero-v2`). The idle frame is copied 1:1. The other frames are
      derived from it, and the slash is a slap with the white hand.
- [ ] **Weapons sized for the 32×64 hero**: redraw all 5 tiers about
      2× longer, then re-place the grip anchors and slash arcs.
- [ ] **Bigger mobs and boss** to match the hero (proposal: mobs 32–48 tall,
      boss 64–96).
- [ ] **Sprite converter** (Aseprite/LibreSprite → game), so the user draws
      sprites and animations themselves:
  - [ ] palette file (`art/afk-palette.gpl`) + PNG → sprite, with palette
        checks
  - [ ] Aseprite JSON: tags = animations, per-frame durations
  - [ ] marker layers: `hit` (damage frame), `anchor` (weapon grip),
        `fx` (effect origin)
  - [ ] watch mode (save in Aseprite → game reloads) + sprite → PNG export
        of the existing art
  - [ ] starter `art/hero.aseprite` with the current frames, tagged
- [ ] User draws the hero animations (idle, slap, hurt, death), then mobs.
- [ ] Decide: is the white hand always white (new palette slot) or does it
      swap with the theme?
- [ ] Decide: keep the sword, or make the slap itself the attack.
- [ ] More animations: mob attack/hurt/death, hero intro/victory, coin fly,
      damage number style.

## Music & sound

- [ ] Pick the music style: medieval ambient or synthwave chill (or keep both
      and let the player switch).
- [ ] Per-world tracks and a boss theme.
- [ ] Third style: **8-bit synthwave**, an original synth track in the feel
      of the user's YouTube example. That exact track would need its
      artist's licence and an official download, so it stays out unless the
      user finds both.

## Game

- [ ] Bulk buy ×10 / ×100 / MAX.
- [ ] Hero HP upgrades (then revisit mob damage growth).
- [ ] Attack speed upgrade.
- [ ] Mana bar and auras.

## Docs & housekeeping

- [ ] Add the changelog lines from PRs #1 and #2 to `CHANGELOG.md`.
- [ ] Tag `v0.2.0` once the playable demo is merged.
- [ ] Delete screenshot helper branches (`pr-assets/*`, e.g. `pr-assets/ui-menus`)
      once nobody needs the images in old PR descriptions. Future PRs: use one
      shared `pr-assets` branch.
