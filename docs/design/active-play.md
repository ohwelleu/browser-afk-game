# Design: active play

Status: **draft**. Every number marked *(proposal)* still needs the owner's OK.
Balance numbers go to `src/game/balance.ts` when this is coded, never hardcoded.

Order of work: **1. Crow** → **2. Items (ring, pendant)** → **3. Palette** (after items).
Deferred to the backlog: skills, auras and the mana bar.

---

## 1. Crow (companion + clicker)

The crow takes the place of the plain "click the mob" idea. It sits near the hero, and when it attacks it
flies to the mob, pecks and flies back.

### Unlock and equip
- It shows up in the shop once stage **1.1 is cleared** (the player has reached 1.2).
- Price: **25 coins** *(proposal; about 4 kills on 1.2)*.
- It is equipped as soon as it's bought. There is one **companion slot**.

### Attacks
- **Click**: a click or tap anywhere on the game screen makes the crow peck.
- **Click cooldown 0.5 s**. Clicks during the cooldown are ignored, not queued. This cooldown is also the
  autoclicker cap, so the most anyone can get from clicking is **2 pecks/s**.
- **Auto attack** (an upgrade): the crow also pecks by itself, starting at once every **3.0 s**.
- Clicks and auto attacks run on **separate timers**. A click doesn't reset the auto timer.
- Auto attacks never get faster than **1.0 s** *(proposal)*.
- The crow only attacks during the `fighting` phase.
- A small ring on the crow icon shows the click cooldown.

### Damage: flat, its own levels (owner's choice)
```
crowDamage = crowBaseDmg × crowDmgLevel        // crowBaseDmg = 1 (proposal), same as the stick
```
The crow falls behind the hero after a few weapon tiers. That's accepted: later companions
(another animal, a drone) can come with a higher base damage, like weapon tiers do.

### Upgrades *(proposal)*
| Upgrade | Effect | Cost from `level` to `level + 1` |
|---|---|---|
| Damage | +1 × `crowBaseDmg` per level | `10 × 1.15^(level−1)` |
| Auto attack | unlocks auto attack at 3.0 s | 150 (one-off) |
| Speed | `autoInterval = max(1.0, 3.0 − 0.1 × (speedLvl − 1))` | `50 × 1.30^(speedLvl−1)` |

Speed is capped after 21 levels (1.0 s).

### Visuals
- The damage number for crow hits uses its **own colour** (not the hero's colour). The exact shade
  gets picked in the palette step. Until then, use an existing accent from `Palette`.
- Sprites: idle (perched / flapping), fly-out, peck, fly-back. Also a shop/slot icon.

### Built to swap in other companions
Write it as data so another companion (another animal, a drone…) can replace the crow later:

```ts
type CompanionDef = {
  id: 'crow';
  price: number;
  baseDmg: number;          // 1 for the crow
  attack: AttackDef;        // reuse the existing AttackDef
  clickCooldown: number;    // 0.5
  autoStart: number;        // 3.0
  autoMinInterval: number;  // 1.0
  sprites: string;
};
```

Save: `companion: { id, dmgLevel, autoUnlocked, speedLevel } | null`.

---

## 2. Items: ring and pendant

### Slots
There are 2 slots: **ring** and **pendant**, one item each.

### Tiers and how many stats an item has
| Tier | Stats on the item | Frame |
|---|---|---|
| C | 1 | plain |
| B | 2 | coloured |
| A | 3 | coloured |
| **S** | **all 4** | coloured + **glow / sparkle** |

There are 4 possible stats. A, B and C items roll their stats at random, with **no duplicates**.

### How stats grow (owner's choice: flat base by stage, tier as a %)
Most loot games (Diablo, Path of Exile, Torchlight, idle RPGs) follow the same pattern: the **item level**
(where it dropped) sets the base, and the **tier** multiplies it. So an S item from early stages is weaker
than a C item from later ones.

```
L          = stageLevel(world, stage) where the item dropped
statValue  = base × growth^(L − 1) × tierMult × roll      // roll = random 0.8 … 1.2
tierMult   = C 100 % · B 130 % · A 160 % · S 200 %        (proposal)
```

| Stat | Effect | base | growth/stage | Type |
|---|---|---|---|---|
| Damage | + flat damage to each hero hit | 1 | 1.25 | flat, round down, min 1 |
| Defence | − flat damage from each mob hit (a hit never goes below 1) | 0.3 | 1.05 | flat, round down, min 1 |
| Speed | hero attack interval ÷ (1 + x) | 2 % | — | %, by tier only |
| Item find | better rarity odds on drops (see below) | 5 % | — | %, by tier only |

*(proposal)* Speed and item find don't grow with the stage, or they'd blow up. The tier multiplier still applies:
for example, speed is +2 % on C and +4 % on S. Caps on the total from both items: speed at most +25 %, item find
at most +100 %.

Check: damage growth 1.25, S ×2 → the S from 1.1 (2 dmg) < the C from 1.5 (1.25⁴ ≈ 2.4).
At 2.1 (L 7) a C ring gives about +3–4 dmg. A wooden sword gives 6 per level.

Defence doesn't exist in the game yet, so items are where it first shows up. The rule above becomes
the shared one for it.

### Drops (kept low)
- They drop from mobs, not from the shop (the shop could sell C items later, still open).
- Drop chance: **0.5 % per normal kill, 3 % per boss kill** *(proposal)*.
- Rarity roll on a drop: **C 70 % · B 22 % · A 7 % · S 1 %**.
- Item find raises the B/A/S weights: each × (1 + itemFind), then normalise. It never raises
  the drop chance itself.
- Rough rate, farming at ~1 kill per 3 s: about **6 items per hour**, an **S about once per 15–20 h**.
- The ring or pendant type is 50/50.

### Inventory *(proposal, change later if needed)*
- 20 slots. When it's full, new drops are sold automatically.
- Selling: `mobCoins(world, stage of drop) × 5 × tierMult`.
- On a drop: a small toast with the item icon and its tier frame. S gets a sparkle and its own sound.

---

## 3. Palette (after items)
More shades per accent, a white slot, the rarity frame colours for C/B/A/S, the crow's
damage number colour. This gets designed once items are done.

---

## Deferred (backlog)
- **Skills**: big effects on long cooldowns, activated by clicking their icon.
- **Auras + mana bar**: passive bonuses with a visible effect.
- The backlog's "Clicker" item is replaced by the crow.
