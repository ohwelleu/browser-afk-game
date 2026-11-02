# Backlog

Things we agreed to do **later**. Owned by the planning thread. Tick items off
when they're done, and move bigger ideas to [ROADMAP.md](ROADMAP.md). The
rough order is in [PLAN.md → Milestones](PLAN.md#milestones). Each
unticked line is roughly one thread and one PR (see [WORKFLOW.md](WORKFLOW.md)).

## Sprite tool (next)

The owner draws all sprites and animations in Aseprite/LibreSprite. A
converter brings them into the game. Full guide: [SPRITES.md](SPRITES.md).
Each line below is its own thread, in this order.

- [x] palette file (`art/afk-palette.gpl`, exists) + PNG → sprite, with
      palette checks (`npm run sprites`, PR #10)
- [ ] Aseprite JSON: tags = animations, per-frame durations
- [ ] marker layers: `hit` (damage frame), `anchor` (weapon grip),
      `fx` (effect origin)
- [ ] watch mode (save in Aseprite → game reloads) + sprite → PNG export
      of the existing art
- [ ] starter `art/hero.aseprite` with the current frames, tagged

## Art

- [x] **Hero v2**: the owner's own 32×64 assassin sprite. Idle copied 1:1,
      the other frames derived, the attack is a slap with the white hand.
- [ ] **Bigger, better swords** (owner, 2026-11-01: "enlarge swords"): the
      weapons were drawn for the old 32×32 hero and look tiny now. Redraw all
      tiers about 2× longer with more detail, then re-place the grip anchors
      and slash arcs.
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
- [x] Decide: keep the sword, or make the slap the attack? → **Keep the
      sword, make it bigger** (2026-11-01).

## Character

- [x] **Equip a bought weapon**: auto-equip when it hits at least as hard,
      plus Equip in the shop (PR #9).
- [ ] **Defence upgrade** (owner: "I don't see it"): items give defence
      (PR #17), but there's no coin upgrade yet. Add a Character upgrade:
      `taken = dmg × 100 / (100 + defence)`, so it never reaches zero.
- [ ] Hero HP upgrades (then revisit mob damage growth).
- [ ] **Speed upgrade** (attack speed), after ascend lands, because it
      multiplies everything.

## Crow (companion)

- [x] Crow companion: click to peck, auto attack, upgrades (PR #18).
- [ ] **Move the crow** further left, perched on top of the hero.
- [ ] **Click animation**: visible feedback where you click/tap.
- [ ] **Remove the cooldown ring** ("loader") around the crow.
- [ ] Use the real crow sprites (PR #16) instead of the placeholder.
- [ ] **Show when the crow becomes buyable** in the shop ("Unlocks after
      clearing 1.1") instead of hiding it.

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

- [ ] **Menu restructure** (owner, 2026-11-01):
  - remove the **Upgrades** tab; weapon upgrades move into **Inventory**
  - rename **Weapons** to **Shop**, with sub tabs **Weapons · Companions ·
    Accessories/Ascend** (to confirm which one the owner meant)
  - **Inventory** gets the same sub tabs (Weapons · Companions · Accessories)
  - later: a Character sub tab (HP, defence, speed)
- [ ] **Help behind a small ⓘ icon** instead of a menu tab.
- [x] Pixel font: Pixelify Sans, with Lithuanian letters (PR #12).
- [ ] **Debugger: new features**: edit the crow and items (give an item of
      any tier, force a drop), max DPS.

## Save & sharing

- [x] **Save string** `AFK1.<base64url(JSON)>.<checksum>` + backup slot
      (PR #11).
- [ ] **Save and load in Help**: copy/paste the save string and
      download/upload a `.txt`, with a preview and a confirm.
- [ ] One-tab guard.
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
