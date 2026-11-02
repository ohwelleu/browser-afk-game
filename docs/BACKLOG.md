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
- [x] **Bigger, better swords**: about 2× longer, own guard/grip/pommel per
      tier, bigger slash arcs (PR #22). Menu icons fit their box (PR #24).
- [ ] **Brown colour** + brown Wooden sword (thread `art/brown-wooden-sword`).
- [ ] **Colours doc**: every colour used in the game, with images (after
      brown lands).
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
- [x] **Defence upgrade** in Shop → Character:
      `taken = dmg × 100 / (100 + defence)`, at least 1 (PR #26).
- [ ] Hero HP upgrades (then revisit mob damage growth).
- [ ] **Speed upgrade** (attack speed), after ascend lands, because it
      multiplies everything.

## Crow (companion)

- [x] Crow companion: click to peck, auto attack, upgrades (PR #18).
- [x] **Move the crow** onto the hero's hat (PR #20).
- [x] **Click animation**: a pixel burst where you click/tap (PR #20).
- [x] **Remove the cooldown ring** ("loader") around the crow (PR #20).
- [x] Real crow sprites instead of the placeholder (PR #16, #20).
- [x] **Show when the crow becomes buyable** in the shop (PR #23).

## Weapons & items

- [ ] **Crossbow**: the first new weapon type (ranged, bolts). The hero needs
      an aiming pose, plus bolt and impact sprites. `AttackDef` already allows it.
- [ ] **More weapons**: tiers after gold (and later the large sword).
- [x] Rings and pendants with small bonuses (PR #15, #17).
- [ ] **More items**: more slots and types (e.g. potions).
- [x] **Rarity tiers** C / B / A / **S** with own frame colours; S glows and
      sparkles (PR #15, #17).
- [ ] Item defence is weak under the % formula (1–4 % per item): raise
      `ITEMS.stats.defence.base`? (owner to decide)
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
- [ ] **Shop reveal**: a weapon appears once you have 90 % of its price and
      stays shown (thread `code/shop-reveal`, save data version 5).
- [ ] Upgrade weapons that aren't equipped? (owner to decide)

## Active play

- [~] **Clicker**: clicking makes the crow peck (PR #18) with a click burst
      (PR #20). Still open: click the mob for bonus damage (cap clicks per second so
      autoclickers don't break the balance).
- [ ] **Skills**: big effects on long cooldowns (e.g. 60 s), activated by
      clicking their icon. Unlocked or upgraded in the shop.

## Shop & UI

- [x] **Menu restructure**: Shop (Character · Weapons · Companions · Ascend
      soon), Inventory (Weapons · Companions · Accessories) with upgrades,
      no Upgrades tab (PR #23, #26). Third Shop tab is "Ascend" for now;
      owner to confirm vs Accessories.
- [ ] **Help behind a small ⓘ icon** instead of a menu tab.
- [x] Pixel font: Pixelify Sans, with Lithuanian letters (PR #12).
- [ ] **Sharper font**: Pixelify is crisp only at 11/22 px, menus use 16 px
      and look blurry. Font picker in the debugger first (thread
      `ui/font-picker`), the owner picks, then a PR makes it the default.
- [x] **Debugger: new features**: crow, give item by tier, force drop, max
      DPS, save string and backup tools (PR #13, #21).

## Save & sharing

- [x] **Save string** `AFK1.<base64url(JSON)>.<checksum>` + backup slot
      (PR #11).
- [x] **Save and load in Help**: copy/paste and download/upload, with a
      preview and a confirm (PR #25).
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
      owner's YouTube example, but our own; no ripping). Or a licensed track:
      the owner is asking the creator of one song for permission
      (2026-11-02). Only add it with written permission.
- [ ] **Synthwave plays first** by default (thread
      `audio/synthwave-default`); players can still switch.
- [ ] Per-world tracks and a boss theme.

## Blog & side projects

- [ ] **Blog post about the simulations**: how fast you can progress, with
      charts from the sim. Probably its own small project (a sim "lab" that
      imports the game's pure balance/combat code), published on the site.

## Docs & housekeeping

- [ ] Tag `v0.2.0` and release the current work as `v0.3.0`? (owner to
      decide)
- [ ] Delete merged branches and `pr-assets/*` once old PR images aren't
      needed. Future PRs: use one shared `pr-assets` branch.
