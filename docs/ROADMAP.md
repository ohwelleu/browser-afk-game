# Roadmap (later)

Not in v1. Rough order, open to change.

## Progression

- **Prestige / resets.** Optional reset that grants **badges** with a
  permanent percentage bonus (e.g. +5% damage per badge).
- **Manual advance button.** Step to the next stage by hand, besides the
  auto-advance toggle.
- More upgrade types: hero max HP, HP regen, crit chance, coin bonus.

## Content

- More mob types per world, with themed worlds: bats, ghouls, werewolves,
  vampires (fits the vampire hunter hero).
- Real bosses with their own sprites and mechanics (instead of a big mushroom).

## Weapon types

Each type has its own attack animation(s), effect, range and feel. Tiers
(stick → gold) stay as upgrades within a type.

| Type        | Range  | Feel                                         |
| ----------- | ------ | -------------------------------------------- |
| Sword (v1)  | melee  | baseline: fast horizontal slash              |
| Large sword | melee  | slower, wide arc, hits several mobs (cleave) |
| Crossbow    | ranged | shoots bolts, hits before mobs reach him     |
| Later maybe | –      | stakes (thrown), holy water (area), axe      |

Needs new hero poses per type (two-handed grip, aiming) plus projectile and
impact sprites.

## Attack skills (upgradable animations)

The attack is not hardcoded as "slash". Skills can be unlocked and upgraded,
each with its own animation, effect, damage multiplier and timing. Ideas:

- Slash (v1) → double slash → spin slash (hits all mobs in range)
- Thrust / lunge (longer reach)
- Charged heavy strike (slow, big damage, screen shake)
- Crossbow: piercing bolt, triple shot, explosive bolt

## Interaction

- Clicking a mob for bonus damage.
- Spells / active skills with cooldowns.

## Saves & accounts

- Save integrity: a checksum/signature to discourage casual save editing.
  This is **not** real anti-cheat. Real anti-cheat needs a server.
- Optional account / cloud save (needs a backend).
- Export / import save as a string.

## Distribution

- Versioned builds on Pages (`/browser-afk-game/v0.2.0/afk-game.js`).
- Publish to npm if other sites want it.

## Polish

- More music tracks: per world, plus a boss theme.
- Screen shake, hit flash, particle effects.
- i18n for UI strings (en / lt).

## Explicitly not planned

- Offline progress. The game only progresses while it is running in the
  browser.
