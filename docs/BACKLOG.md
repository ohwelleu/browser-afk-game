# Backlog

Things we agreed to do **later**. Owned by the planning thread. Tick items off
when they're done, and move bigger ideas to [ROADMAP.md](ROADMAP.md). The
rough order is in [PLAN.md → Milestones](PLAN.md#milestones). Each
unticked line is roughly one thread and one PR (see [WORKFLOW.md](WORKFLOW.md)).

## Sprite tool (next)

The owner draws all sprites and animations in Aseprite/LibreSprite. A
converter brings them into the game. Full guide: [SPRITES.md](SPRITES.md).
Each line below is its own thread, in this order.

- [ ] palette file (`art/afk-palette.gpl`, exists) + PNG → sprite, with
      palette checks
- [ ] Aseprite JSON: tags = animations, per-frame durations
- [ ] marker layers: `hit` (damage frame), `anchor` (weapon grip),
      `fx` (effect origin)
- [ ] watch mode (save in Aseprite → game reloads) + sprite → PNG export
      of the existing art
- [ ] starter `art/hero.aseprite` with the current frames, tagged

## Art

- [x] **Hero v2**: the owner's own 32×64 assassin sprite. Idle copied 1:1,
      the other frames derived, the attack is a slap with the white hand.
- [ ] **Bigger, better swords**: the weapons were drawn for the old 32×32
      hero and look tiny now. Redraw all tiers about 2× longer with more
      detail, then re-place the grip anchors and slash arcs.
- [ ] **Bigger mobs and boss** to match the hero (mobs 32–48 tall, boss
      64–96).
- [ ] Owner draws the hero animations (idle, slap, hurt, death), then mobs.
- [ ] **More colours**: today it's 2 base + 7 accents. Proposal: add a light
      and a dark shade per accent (for shading and S-tier glow) and a fixed
      white slot for the hand. Needs a palette update in `art/afk-palette.gpl`.
- [ ] More animations: mob attack/hurt/death, hero intro/victory, coin fly,
      damage number style.
- [ ] Decide: is the white hand always white (new palette slot) or does it
      swap with the theme?
- [ ] Decide: keep the sword, or make the slap itself the attack?

## Character

- [ ] **Equip a bought weapon**: buying a new weapon doesn't equip it today
      (you have to go to Inventory). Proposal: auto-equip on buy when it hits
      harder than the current one, and add an "Equip" button right in the shop.
- [ ] **Defence upgrade**: reduces mob damage. Proposal:
      `taken = dmg × 100 / (100 + defence)`, so it never reaches zero.
- [ ] Hero HP upgrades (then revisit mob damage growth).
- [ ] **Speed upgrade** (attack speed), after ascend lands, because it
      multiplies everything.

## Weapons & items

- [ ] **Crossbow**: the first new weapon type (ranged, bolts). The hero needs
      an aiming pose, plus bolt and impact sprites. `AttackDef` already allows it.
- [ ] **More weapons**: tiers after gold (and later the large sword).
- [ ] **More items**: non-weapon items (rings, amulets, potions) with small
      bonuses.
- [ ] **Rarity tiers** C / B / A / **S**: each tier gets its own frame
      colour; S-tier items glow or sparkle so they look special.
- [ ] Mana bar and **auras** (passive bonuses with a visible effect around
      the hero).

## Progression & balance

- [ ] **Simulator** (headless, same code as the game) + `npm run sim` + a
      debug panel tab. This comes first.
- [ ] **Slow progress down**: measure with the sim, agree on target times,
      then tune (see [PLAN.md → Pacing](PLAN.md#pacing-to-do)).
- [ ] **Ascend** (prestige): reset stage and weapons for a permanent bonus.
      Ascend points are spent on upgrades in the Ascend shop tab.
- [ ] Bulk buy ×10 / ×100 / MAX.

## Active play

- [ ] **Clicker**: click the mob for bonus damage (cap clicks per second so
      autoclickers don't break the balance).
- [ ] **Skills**: big effects on long cooldowns (e.g. 60 s), activated by
      clicking their icon. Unlocked or upgraded in the shop.

## Shop & UI

- [ ] **Shop with tabs**: Character (HP, defence, speed) · Weapons · Ascend
      · Other (items, cosmetics).
- [ ] **Help behind a small ⓘ icon** instead of a menu tab.
- [ ] Pixel font (Pixelify Sans / Silkscreen / Press Start 2P, with
      Lithuanian letters).

## Save & sharing

- [ ] **Save v2**: `AFK1.<base64url(JSON)>.<checksum>`, backup slot, `.txt`
      export/import, one-tab guard.
- [ ] **Share progress**: a "Copy save" link like
      `…/en/game#save=AFK1…` that loads the save on another device.
- [ ] Be honest in the UI: the checksum stops typos and casual edits.
      Anyone can read the JS and **decode or forge a save**, and no amount of
      time or hashing changes that on the client. Real protection needs a
      server (see ranking).

## Online (research first)

- [ ] **Ranking with Firebase**: Firestore leaderboard (highest stage, ascend
      count). Free tier, no own server.
- [ ] **Unique session**: Firebase Anonymous Auth gives every player a
      stable id without a login. Later, Google sign-in can link it so the save
      follows the player.
- [ ] Anti-cheat level: Security Rules check plausibility (e.g. you can't go
      up 50 stages in a minute) and App Check blocks non-browser clients.
      Full checking (replaying the run on a server) is a later decision.
- [ ] Privacy note on the site (ids, what's stored).

## Music & sound

- [ ] **New music**: an original **8-bit synthwave** track (in the feel of the
      owner's YouTube example, but our own; no ripping).
- [ ] Pick the default style: Medieval / Synthwave / 8-bit.
- [ ] Per-world tracks and a boss theme.

## Blog & side projects

- [ ] **Blog post about the simulations**: how fast you can progress, with
      charts from the sim. Probably its own small project (a sim "lab" that
      imports the game's pure balance/combat code), published on the site.

## Docs & housekeeping

- [ ] Tag `v0.2.0` (package.json is already `0.2.0`).
- [ ] Delete merged branches and `pr-assets/*` once old PR images aren't
      needed. Future PRs: use one shared `pr-assets` branch.
