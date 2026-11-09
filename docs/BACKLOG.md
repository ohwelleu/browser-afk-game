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
- [ ] **HP and mob damage grow**: the hero's max HP grows (per stage
      and/or an HP upgrade) and mob damage scales with the stage. Today it's
      almost flat (stage 5 mobs still hit for ~12). Bigger numbers on both
      sides feel better. Tune with the simulator.
- [x] **Critical chance**: a crit chance stat (and crit damage ×), bought
      in Shop → Character and found on items. Crits get their own damage
      number style.
- [ ] **Speed upgrade** (attack speed), after ascend lands, because it
      multiplies everything.

## Crow (companion)

- [x] Crow companion: click to peck, auto attack, upgrades (PR #18).
- [x] **Move the crow** onto the hero's hat (PR #20).
- [x] **Click animation**: a pixel burst where you click/tap (PR #20).
- [x] **Remove the cooldown ring** ("loader") around the crow (PR #20).
- [x] Real crow sprites instead of the placeholder (PR #16, #20).
- [x] **Show when the crow becomes buyable** in the shop (PR #23).
- [x] **Companion damage scales with the hero's damage** (e.g. a % of the
      hero's hit, raised by crow upgrades), so the crow stays useful later
      on.
- [x] **Companion upgrades in Shop and Inventory**: crow upgrades can be
      bought from Shop → Companions too, not only from Inventory (same as
      weapons).
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
- [ ] **Early-game drops come faster**: the first items should drop
      sooner (owner, 2026-11-08). Raise the drop chance or add a guaranteed
      early drop in the first stages, then keep later drops as they are.
      Tune with the simulator.
- [~] **Rainbow colour** (animated, for S-tier things): demo in the debug
      panel first (thread `ui/rainbow-colour-demo`), where to use it is
      decided later.
- [x] **Character stats window**: damage per second, crit chance, best
      weapon (name and tier) and highest stage. Starts after crit chance
      lands. (Same item as the stats panel below.)
- [ ] **Item names that say what they do**: name parts from the stats,
      e.g. "Lucky Ring" = more item find, "Ring of Haste" = speed, "Sharp
      Pendant of Fortune" = damage + item find. Tier in the name or frame
      colour. Easy to tell what you got from the drop toast.
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
- [x] Upgrade weapons that aren't equipped? → **Yes** (2026-11-02; PR #38,
      bulk buy: every owned weapon has its own Upgrade button).

## Active play

- [ ] **Starter quest: buy the companion**. At the start, a small quest
      ("Buy the crow to start clicking") points to Shop → Companions, so new
      players learn clicking early. Reward or highlight when done.
- [~] **Clicker**: clicking makes the crow peck (PR #18) with a click burst
      (PR #20). Still open: click the mob for bonus damage (cap clicks per second so
      autoclickers don't break the balance).
- [ ] **Roguelike stage picks** (owner, 2026-11-09): on a stage, the player
      picks one upgrade from a few random choices, like in roguelike games.
      Design first in `docs/design/stage-picks.md`: when the choice appears
      (every stage, every few stages, boss kills), how many options (e.g.
      3), what the options are (temporary buffs for the run vs. permanent
      ones, small stat boosts, skills, companion perks), rarity and
      rerolls, what happens on death and on ascend, and whether it pauses
      the fight. Needs the simulator and ties in with ascend. Then build in
      small PRs (choice logic and save, pick UI, first set of options).
- [ ] **Skills**: big effects on long cooldowns (e.g. 60 s), activated by
      clicking their icon. Unlocked or upgraded in the shop.

## Shop & UI

- [x] **Menu restructure**: Shop (Character · Weapons · Companions · Ascend
      soon), Inventory (Weapons · Companions · Accessories) with upgrades,
      no Upgrades tab (PR #23, #26). Third Shop tab is **Ascend**;
      accessories are drop-only, never sold (2026-11-02).
- [x] **Help behind a small ⓘ icon** instead of a menu tab (opens Credits, 0.4.0).
- [x] **Bulk buy** ×10 / ×100 / MAX (amount button + popover, 0.4.0).
- [ ] **New menu icon**: change the menu button icon to something like a
      "rank up" symbol (stacked upward chevrons), pixel style, fits the
      palette (owner, 2026-11-08). Check which button the owner means
      (menu open button vs. tab icons) before drawing.
- [ ] **Compare before buying a weapon**: the shop shows the current
      damage vs. the new weapon's damage (e.g. `12 → 30 (+18)`).
- [ ] **Equipped first**: equipped weapons (and items) are listed at the
      top in Inventory.
- [ ] **Sticky sub tabs**: the sub tab row (Character · Weapons · …) stays
      on top while scrolling, like the main tabs.
- [x] **Fix: sound settings**: the [X] close button overlaps the on/off
      button in the sound settings popover. Move it so both are usable.
- [x] **Stats panel**: tap the HP bar area to see stats (max DPS, damage,
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
- [x] One-tab guard (0.4.0).
- [x] **Share progress**: a "Copy link" like
      `…/en/game#save=AFK1…` that loads the save on another device (0.4.0).
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

- [x] **New music**: "Gaming Time" by Otrebil, with written permission
      (2026-11-03, see [DECISIONS.md](DECISIONS.md)). Thread
      `audio/otrebil-track`: seamless loop, OGG, credit, default for new
      players. Our own original 8-bit synthwave track is optional now.
- [ ] Per-world tracks and a boss theme.

## Blog & side projects

- [ ] **Blog post about the simulations**: how fast you can progress, with
      charts from the sim. Probably its own small project (a sim "lab" that
      imports the game's pure balance/combat code), published on the site.

## Blog (other repo: `ohwelleu.github.io`)

- [ ] **Fix the blog's mobile menu.** This is the site's own menu, not
      the game's, so the work happens in the blog repo, not here.

## Docs & housekeeping

- [x] Tag `v0.2.0` and release the current work as `v0.3.0`.
- [x] Delete merged branches and `pr-assets/*`; one shared `pr-assets`
      branch from now on (2026-11-02).
