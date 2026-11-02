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
- [x] Aseprite JSON: tags = animations, per-frame durations
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
- [x] **Brown colour** + brown Wooden sword.
- [x] **Colours doc**: every colour used in the game, with images
      ([COLORS.md](COLORS.md)).
- [ ] **Bigger mobs and boss** to match the hero (mobs 32–48 tall, boss
      64–96).
- [ ] Owner draws the hero animations (idle, slap, hurt, death), then mobs.
- [ ] **More colours**: today it's 2 base + 7 accents. Proposal: add a light
      and a dark shade per accent (for shading and S-tier glow) and a fixed
      white slot for the hand. Needs a palette update in `art/afk-palette.gpl`.
- [ ] More animations: mob attack/hurt/death, hero intro/victory, coin fly,
      damage number style.
- [x] Decide: the white hand → **leave it for now**; the hero animations
      get redrawn later with normal attacks per weapon (2026-11-02).
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
- [ ] **More companions**: other animals with their own attack and upgrades
      (e.g. bat, cat), each its own sprite set. One active or several?
      (owner to decide).

## Weapons & items

- [ ] **Crossbow**: the first new weapon type (ranged, bolts). The hero needs
      an aiming pose, plus bolt and impact sprites. `AttackDef` already allows it.
- [ ] **More weapons**: tiers after gold, the large sword, later stakes /
      holy water / axe (see [ROADMAP.md](ROADMAP.md#weapon-types)).
- [x] Rings and pendants with small bonuses (PR #15, #17).
- [ ] **More items**: more slots and types (e.g. potions, belts, cloaks),
      more stats per item.
- [x] **Rarity tiers** C / B / A / **S** with own frame colours; S glows and
      sparkles (PR #15, #17).
- [ ] Item defence is weak under the % formula (1–4 % per item): raise
      `ITEMS.stats.defence.base`? → **decide after the simulator**.
- [ ] Mana bar and **auras** (passive bonuses with a visible effect around
      the hero).

## Progression & balance

- [ ] **Simulator** (headless, same code as the game) + `npm run sim` + a
      debug panel tab. This comes first.
- [ ] **Slow progress down**: measure with the sim, agree on target times,
      then tune (see [PLAN.md → Pacing](PLAN.md#pacing-to-do)).
- [ ] **Ascend logic** (prestige), design first in `docs/design/ascend.md`:
      when you can ascend (stage gate), what resets (stage, coins, weapons,
      upgrades) and what stays (items, crow?, stats), how many ascend
      points you get (scales with stage), and what they buy in Shop →
      Ascend (permanent % damage, coin bonus, start stage). Tuned with the
      simulator. Then implement in small PRs (state + save, shop tab, UI).
- [x] **Shop reveal**: a weapon appears once you have 90 % of its price and
      stays shown.
- [x] Upgrade weapons that aren't equipped? → **Yes** (2026-11-02, done in
      the bulk buy thread).

## Active play

- [~] **Clicker**: clicking makes the crow peck (PR #18) with a click burst
      (PR #20). Still open: click the mob for bonus damage (cap clicks per second so
      autoclickers don't break the balance).
- [ ] **Skills**: big effects on long cooldowns (e.g. 60 s), activated by
      clicking their icon. Unlocked or upgraded in the shop.

## Shop & UI

- [x] **Menu restructure**: Shop (Character · Weapons · Companions · Ascend
      soon), Inventory (Weapons · Companions · Accessories) with upgrades,
      no Upgrades tab (PR #23, #26). Third Shop tab is **Ascend**;
      accessories are drop-only, never sold (2026-11-02).
- [ ] **Help behind a small ⓘ icon** instead of a menu tab (thread
      `ui/help-icon`).
- [ ] **Bulk buy** ×10 / ×100 / MAX (thread `code/bulk-buy`).
- [ ] **Stats panel**: tap the HP bar area to see stats (max DPS, damage,
      defence, crit/speed, crow DPS, item totals, kills, deaths).
- [x] Pixel font: Pixelify Sans, with Lithuanian letters (PR #12).
- [x] **Sharper font**: font picker in the debugger, Press Start 2P is the
      game font (for now).
- [x] **Debugger: new features**: crow, give item by tier, force drop, max
      DPS, save string and backup tools (PR #13, #21).

## Save & sharing

- [x] **Save string** `AFK1.<base64url(JSON)>.<checksum>` + backup slot
      (PR #11).
- [x] **Save and load in Help**: copy/paste and download/upload, with a
      preview and a confirm (PR #25).
- [ ] One-tab guard (thread `code/one-tab-guard`).
- [ ] **Share progress**: a "Copy link" like
      `…/en/game#save=AFK1…` that loads the save on another device (thread
      `code/share-link`, together with the honesty note below).
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
- [x] **Synthwave plays first** by default; players can still switch.
- [ ] Per-world tracks and a boss theme.

## Blog & side projects

- [ ] **Blog post about the simulations**: how fast you can progress, with
      charts from the sim. Probably its own small project (a sim "lab" that
      imports the game's pure balance/combat code), published on the site.

## Docs & housekeeping

- [x] Tag `v0.2.0` and release the current work as `v0.3.0`.
- [x] Delete merged branches and `pr-assets/*`; one shared `pr-assets`
      branch from now on (2026-11-02).
