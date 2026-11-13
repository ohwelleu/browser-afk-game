/**
 * Every tunable number of the game. Logic reads from here; nothing else
 * should hardcode balance values. See docs/PLAN.md → Balance.
 *
 * Every number is also reachable through `TUNING` (end of this file), so the
 * simulator can override it with `applyTuning` and undo it with
 * `resetTuning` (docs/design/simulator.md → 2.3). The game itself never
 * changes them. Plain-number exports are `let` so importers see an override.
 */
import type { AttackDef } from './attacks';

export const STAGES_PER_WORLD = 6;
export const BOSS_STAGE = 6;
export let HERO_MAX_HP = 100;

/**
 * Duel timeline in seconds (duel time starts at 0 when the mob appears).
 * The hero's first hit lands when the intro ends, the mob's `mobOffset` later
 * (so both never land on the same tick at the start).
 */
export const DUEL = {
  /** Full intro: first time a stage is reached, and the first duel after Start. */
  intro: 2.0,
  /** Short beat before every other duel (farming, after a rollback, revisits). */
  shortIntro: 0.4,
  mobOffset: 0.5,
  /** How long the death animations play before the next duel. */
  mobDying: 0.9,
  heroDying: 1.8,
  /** Empty beat between a death and the next intro. */
  transition: 0.3,
};

export type MobKind = 'mushroom' | 'flower' | 'chicken' | 'boss';

/** Per mob type: seconds between hits and the lunge before each hit lands. */
export const MOB_KINDS: Record<MobKind, { interval: number; windup: number }> = {
  mushroom: { interval: 1.0, windup: 0.25 },
  flower: { interval: 1.0, windup: 0.25 },
  chicken: { interval: 1.0, windup: 0.2 },
  boss: { interval: 1.0, windup: 0.35 },
};

/** Mob for stages x.1 … x.6. */
export const STAGE_MOBS: readonly MobKind[] = [
  'mushroom',
  'flower',
  'chicken',
  'mushroom',
  'flower',
  'boss',
];

export type WeaponStats = { name: string; baseDmg: number; price: number; upgradeBase: number };

export const WEAPONS: readonly WeaponStats[] = [
  { name: 'Stick', baseDmg: 1, price: 0, upgradeBase: 5 },
  { name: 'Wooden sword', baseDmg: 6, price: 100, upgradeBase: 60 },
  { name: 'Stone sword', baseDmg: 36, price: 3_000, upgradeBase: 1_800 },
  { name: 'Iron sword', baseDmg: 216, price: 90_000, upgradeBase: 54_000 },
  { name: 'Gold sword', baseDmg: 1_296, price: 2_700_000, upgradeBase: 1_600_000 },
];

/**
 * Shop → Weapons shows a weapon once coins reach this share of its price
 * (game/reveal.ts). Once shown it stays shown.
 */
export let WEAPON_REVEAL_FRACTION = 0.9;

export let UPGRADE_GROWTH = 1.15;

const MOB_HP = { base: 10, growth: 1.28, boss: 5 };
const MOB_DMG = { base: 5, growth: 1.07, boss: 2 };
const MOB_COINS = { base: 4, growth: 1.3, boss: 5 };
/**
 * World 1 is a tutorial: mob HP and damage × these. HP is cut hard so a fresh
 * stick (1 dmg) kills a normal mob in 2–3 hits (1.1–1.5: 2, 2, 2, 3, 3 HP).
 */
const WORLD_1 = { hpMult: 0.11, dmgMult: 0.8 };

/**
 * Integer guard for HP, damage and coins: NaN → 0, ±Infinity and anything
 * past 2^53 clamp to the largest safe integer, fractions round down.
 */
export function safeInt(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n >= Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
  if (n <= -Number.MAX_SAFE_INTEGER) return -Number.MAX_SAFE_INTEGER;
  return Math.floor(n);
}

/** `L = (world − 1) × 6 + stage`: 1.1 → 1, 1.6 → 6, 2.1 → 7. */
export function stageLevel(world: number, stage: number): number {
  return (world - 1) * STAGES_PER_WORLD + stage;
}

export const isBoss = (stage: number): boolean => stage === BOSS_STAGE;

export function mobKind(stage: number): MobKind {
  return STAGE_MOBS[stage - 1] ?? 'mushroom';
}

function scaled(
  p: { base: number; growth: number; boss: number },
  world: number,
  stage: number,
  world1Mult: number,
): number {
  const L = stageLevel(world, stage);
  let v = p.base * p.growth ** (L - 1);
  if (isBoss(stage)) v *= p.boss;
  if (world === 1) v *= world1Mult;
  return Math.max(1, safeInt(Math.ceil(v)));
}

export const mobHp = (world: number, stage: number) => scaled(MOB_HP, world, stage, WORLD_1.hpMult);
export const mobDamage = (world: number, stage: number) =>
  scaled(MOB_DMG, world, stage, WORLD_1.dmgMult);
export const mobCoins = (world: number, stage: number) => scaled(MOB_COINS, world, stage, 1);

// ── Ascend (prestige) ──────────────────────────────────────────────────────

/** Ascend unlocks once the highest stage reached is this one (6.1 = `world.stage`) or higher. */
export const ASCEND_GATE = { world: 6, stage: 1 };
/** The gate as a stage level, comparable with `GameState.best` (also `ASCEND_GATE_LEVEL`). */
export const ascendGateLevel = (): number => stageLevel(ASCEND_GATE.world, ASCEND_GATE.stage);
/** The price is this many kills' worth of coins at the gate stage. */
export let ASCEND_COST_KILLS = 100;
/** Ascend price in coins: `ASCEND_COST_KILLS × mobCoins(gate stage)` (also `ASCEND_COST`). */
export const ascendCost = (): number =>
  TUNING.ascend.costKills * mobCoins(ASCEND_GATE.world, ASCEND_GATE.stage);
/**
 * Attack speed each ascend adds (0.10 = +10 %). Placeholder, to be balanced
 * with the simulator. It adds on top of the gear speed and is NOT part of the
 * item cap (`ITEMS.caps.speed`).
 */
export let ASCEND_SPEED_PER = 0.1;

/** `damage = baseDmg × level` (level 0 = not owned = no damage). */
export function weaponDamage(tier: number, level: number): number {
  const w = WEAPONS[tier];
  return w ? safeInt(w.baseDmg * level) : 0;
}

/** Cost to go from `level` to `level + 1`: `upgradeBase × 1.15^(level−1)`. */
export function upgradeCost(tier: number, level: number): number {
  const w = WEAPONS[tier];
  if (!w || level < 1) return Number.MAX_SAFE_INTEGER;
  return safeInt(Math.ceil(w.upgradeBase * TUNING.upgrade.growth ** (level - 1)));
}

// ── Items: ring, pendant, earring and belt (docs/design/active-play.md → 2. Items) ──

export type ItemSlot = 'ring' | 'pendant' | 'earring' | 'belt';
/** `SS` is the internal id of tier S+ (shown to the player as "S+"; "+" is awkward in CSS classes). */
export type ItemTier = 'C' | 'B' | 'A' | 'S' | 'SS';
export type ItemStat = 'damage' | 'defence' | 'speed' | 'itemFind' | 'crit';

export const ITEM_SLOTS: readonly ItemSlot[] = ['ring', 'pendant', 'earring', 'belt'];
export const ITEM_TIERS: readonly ItemTier[] = ['C', 'B', 'A', 'S', 'SS'];

/** What the player sees for each tier. */
export const ITEM_TIER_LABEL: Record<ItemTier, string> = {
  C: 'C',
  B: 'B',
  A: 'A',
  S: 'S',
  SS: 'S+',
};

/** S+ is S with every stat value × this. Everything else about S+ (stat lines, prices) follows S. */
const S_PLUS_MULT = 2;
/** How rare S+ is compared with S (its rarity weight = S × this). */
const S_PLUS_RARITY = 0.05;
export const ITEM_STATS: readonly ItemStat[] = ['damage', 'defence', 'speed', 'itemFind', 'crit'];

export const ITEMS = {
  /** How many different stats an item of each tier has (drawn from `ITEM_STATS`). */
  statCount: { C: 1, B: 2, A: 3, S: 4, SS: 4 } as Record<ItemTier, number>,
  /** S+ = S × `S_PLUS_MULT`, so the two stay linked (also the sell price factor). */
  tierMult: { C: 1.0, B: 1.3, A: 1.6, S: 2.0, SS: 2.0 * S_PLUS_MULT } as Record<ItemTier, number>,
  /** Rarity weights of a drop, before item find. S+ is a small fraction of S (1 in 2000 drops). */
  rarity: { C: 70, B: 22, A: 7, S: 1, SS: 1 * S_PLUS_RARITY } as Record<ItemTier, number>,
  /** Chance per kill that something drops at all (item find never changes this). */
  dropChance: { mob: 0.005, boss: 0.03 },
  /**
   * Early-game boost for mobs in world 1: `mob` chance on stage 1, fading
   * linearly down to `dropChance.mob` on stage `untilStage` and after.
   */
  earlyDrop: { world: 1, mob: 0.04, untilStage: 5 },
  /**
   * Which stats a slot leans to. An item draws its stats without replacement,
   * each stat weighted by this (default 1): earrings favour crit and item find,
   * belts defence and damage. Ring and pendant stay uniform.
   */
  statWeights: {
    earring: { crit: 3, itemFind: 3 },
    belt: { defence: 3, damage: 3 },
  } as Partial<Record<ItemSlot, Partial<Record<ItemStat, number>>>>,
  /** Every stat value is × a uniform roll in [min, max). */
  roll: { min: 0.8, max: 1.2 },
  /**
   * `value = base × growth^(L−1) × tierMult × roll`. Flat stats round down
   * (min 1); % stats are fractions (0.02 = +2 %) and don't grow with the stage.
   */
  stats: {
    damage: { base: 1, growth: 1.25, flat: true },
    defence: { base: 0.3, growth: 1.05, flat: true },
    speed: { base: 0.02, growth: 1, flat: false },
    itemFind: { base: 0.05, growth: 1, flat: false },
    // Same base as speed: +1 % crit is worth about +1 % damage at the default ×2 crit.
    crit: { base: 0.02, growth: 1, flat: false },
  } as Record<ItemStat, { base: number; growth: number; flat: boolean }>,
  /**
   * Caps on the total of all equipped items. Crit has no item cap of its own:
   * the total chance (items + upgrade) is capped by `CRIT.maxChance`.
   */
  caps: { speed: 0.25, itemFind: 1.0 },
  inventorySize: 20,
  /** Sell price = `mobCoins(drop stage) × sellMult × tierMult`. */
  sellMult: 5,
};

/** Chance per kill that something drops on `world.stage` (boosted for mobs early in world 1). */
export function dropChance(world: number, stage: number): number {
  const { mob, boss } = ITEMS.dropChance;
  if (isBoss(stage)) return boss;
  const e = ITEMS.earlyDrop;
  if (world !== e.world || stage >= e.untilStage) return mob;
  const t = (Math.max(1, stage) - 1) / (e.untilStage - 1); // 0 on stage 1 → 1 on `untilStage`
  return e.mob + (mob - e.mob) * t;
}

/** One stat roll on an item from stage level `L`. `roll` is the 0.8–1.2 factor. */
export function itemStatValue(stat: ItemStat, L: number, tier: ItemTier, roll: number): number {
  // S+ is exactly 2× the (already rounded) S value, so rounding can't make them drift apart.
  if (tier === 'SS') {
    const v = itemStatValue(stat, L, 'S', roll) * S_PLUS_MULT;
    return ITEMS.stats[stat].flat ? safeInt(v) : Math.round(v * 10_000) / 10_000;
  }
  const p = ITEMS.stats[stat];
  const v = p.base * p.growth ** (L - 1) * ITEMS.tierMult[tier] * roll;
  // % stats: kept to 0.01 % steps so saves and labels stay tidy.
  return p.flat ? Math.max(1, safeInt(v)) : Math.round(v * 10_000) / 10_000;
}

/** Rarity weights with item find: everything but C × (1 + itemFind) (normalise by the sum). */
export function itemRarityWeights(itemFind: number): Record<ItemTier, number> {
  const f = 1 + Math.max(0, itemFind);
  const r = ITEMS.rarity;
  return { C: r.C, B: r.B * f, A: r.A * f, S: r.S * f, SS: r.SS * f };
}

export function itemSellPrice(world: number, stage: number, tier: ItemTier): number {
  return safeInt(mobCoins(world, stage) * ITEMS.sellMult * ITEMS.tierMult[tier]);
}

// ── Companions (docs/design/active-play.md → 1. Crow) ──────────────────────

/** Shop order. A new companion is a new id here and an entry in `COMPANIONS`. */
export const COMPANION_IDS = ['crow', 'wolf'] as const;
export type CompanionId = (typeof COMPANION_IDS)[number];

/*
 * Companion numbers. Each companion has ONE upgrade (its level) and deals a
 * share of the hero's hit damage on every attack:
 *
 *   percent = BASE_PERCENT + PERCENT_PER_LEVEL × (level − 1)
 *
 * so attack speed and damage are not separate upgrades: the level raises the
 * percent and the attack interval stays fixed. Percents are in whole %
 * (2 = 2 % of the hero's hit). Keep the per-level steps to multiples of 0.25
 * so the sums stay exact in floating point.
 */
export let CROW_PRICE = 25;
export let CROW_BASE_PERCENT = 2;
export let CROW_PERCENT_PER_LEVEL = 0.5;
export const CROW_UPGRADE = { base: 10, growth: 1.15 };

export let WOLF_PRICE = 500;
export let WOLF_BASE_PERCENT = 5;
export let WOLF_PERCENT_PER_LEVEL = 1.25;
export const WOLF_UPGRADE = { base: 100, growth: 1.15 };

/** Where a companion stands: on the hero's hat (flies out) or behind the hero (lunges). */
export type CompanionPosition = 'hat' | 'behind';

/**
 * A companion is data, so another one (an animal, a drone…) is a new entry
 * here, not new code. Any number of companions can be owned; each one attacks
 * on its own timer.
 */
export type CompanionDef = {
  id: CompanionId;
  name: string;
  /** Shop blurb while the companion is not bought yet. */
  pitch: string;
  price: number;
  /** Shows up in the shop once `best` reaches this stage level (2 = 1.1 cleared). */
  unlockLevel: number;
  /** Share of the hero's hit per attack at level 1, in whole % (2 = 2 %). */
  basePercent: number;
  /** Added to the percent per level above 1, in whole %. */
  percentPerLevel: number;
  /** Cost from `level` to `level + 1`: `base × growth^(level−1)`. */
  upgrade: { base: number; growth: number };
  /**
   * `interval` is the seconds between auto attacks; `hitFrame / fps` is the
   * time from the start of an attack to its hit (the crow's fly-out, the
   * wolf's lunge).
   */
  attack: AttackDef;
  /** Seconds between click attacks, or null when clicking does nothing (auto only). */
  clickCooldown: number | null;
  position: CompanionPosition;
  /** Sprite set key. */
  sprites: string;
};

export const COMPANIONS: Record<CompanionId, CompanionDef> = {
  crow: {
    id: 'crow',
    name: 'Crow',
    pitch: 'Pecks the mob by itself, and when you click or tap',
    price: CROW_PRICE,
    unlockLevel: 2,
    basePercent: CROW_BASE_PERCENT,
    percentPerLevel: CROW_PERCENT_PER_LEVEL,
    upgrade: CROW_UPGRADE,
    attack: {
      id: 'peck',
      heroAnim: 'peck',
      hitFrame: 2,
      fps: 12,
      interval: 1.0,
      targets: 'single',
      damageMult: 1,
    },
    clickCooldown: 0.5,
    position: 'hat',
    sprites: 'crow',
  },
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    pitch: 'Stands behind the hero and bites the mob by itself',
    price: WOLF_PRICE,
    unlockLevel: 8,
    basePercent: WOLF_BASE_PERCENT,
    percentPerLevel: WOLF_PERCENT_PER_LEVEL,
    upgrade: WOLF_UPGRADE,
    attack: {
      id: 'bite',
      heroAnim: 'bite',
      hitFrame: 2,
      fps: 10,
      interval: 1.0,
      targets: 'single',
      damageMult: 1,
    },
    clickCooldown: null,
    position: 'behind',
    sprites: 'wolf',
  },
};

/** Share of the hero's hit, in whole % (2 = 2 %), a level `level` companion deals per attack. */
export function companionPercent(def: CompanionDef, level: number): number {
  return def.basePercent + def.percentPerLevel * Math.max(0, level - 1);
}

/**
 * `damage = heroHit × percent`, rounded down, at least 1 (like every hit in
 * the game). `heroHit` is the hero's current hit (weapon + items, before crit
 * and defence), so a companion keeps up with the hero's weapons.
 */
export function companionDamage(def: CompanionDef, level: number, heroHit: number): number {
  const dmg = safeInt((heroHit * companionPercent(def, level) * def.attack.damageMult) / 100);
  return Math.max(1, dmg);
}

/** Damage per second of one companion: damage per attack ÷ seconds between attacks. */
export const companionDps = (def: CompanionDef, level: number, heroHit: number): number =>
  companionDamage(def, level, heroHit) / def.attack.interval;

/** Upgrade cost from `level` to `level + 1`: `base × growth^(level−1)`. */
export function companionUpgradeCostAt(def: CompanionDef, level: number): number {
  return level < 1
    ? Number.MAX_SAFE_INTEGER
    : safeInt(Math.ceil(def.upgrade.base * def.upgrade.growth ** (level - 1)));
}

// ── Character upgrades (bought with coins in Shop → Character) ─────────────

export type CharacterUpgradeId = 'defence' | 'crit' | 'hp';

/**
 * Each upgrade: cost of buying level `n` is `base × growth^(n−1)` (level 0 =
 * not bought), and every level adds `perLevel` to the stat. Speed goes here
 * later.
 */
export const CHARACTER: Record<
  CharacterUpgradeId,
  { base: number; growth: number; perLevel: number }
> = {
  // Mob coins grow 1.3× per stage, so the price keeps pace with progress.
  defence: { base: 50, growth: 1.3, perLevel: 5 },
  // perLevel is a fraction: 0.01 = +1 % crit chance per level.
  crit: { base: 100, growth: 1.3, perLevel: 0.01 },
  // Flat max HP on top of `HERO_MAX_HP`: +10 per level (10 % of the starting 100).
  hp: { base: 30, growth: 1.3, perLevel: 10 },
};

// ── Critical hits (hero hits only for now) ─────────────────────────────────

/**
 * The most crit chance (in %) the Shop upgrade can give. Raise it later; items
 * add on top of it, up to `CRIT.maxChance` in total.
 */
export let CRIT_BUY_MAX_PERCENT = 40;

export const CRIT = {
  /** The total crit chance (items + upgrade) never goes above this. */
  maxChance: 0.75,
  /** A crit does this many times the normal hit damage. */
  damageMult: 2,
};

/**
 * Highest crit upgrade level that can be bought (the one that reaches
 * `CRIT_BUY_MAX_PERCENT`; also `CRIT_MAX_LEVEL`).
 */
export const critMaxLevel = (): number =>
  Math.floor((TUNING.shop.critMaxPercent / 100 / CHARACTER.crit.perLevel) * (1 + 1e-9));

/**
 * Crit chance from the coin upgrade at `level`, kept to 0.01 % steps. Levels
 * past `critMaxLevel()` (old or debug saves) count as the cap, not more.
 */
export const critFromLevel = (level: number): number =>
  Math.round(CHARACTER.crit.perLevel * Math.min(critMaxLevel(), Math.max(0, level)) * 10_000) /
  10_000;

/** Total crit chance (0–`CRIT.maxChance`) from the raw sum of upgrade and item chances. */
export const capCritChance = (chance: number): number =>
  Number.isFinite(chance) ? Math.min(CRIT.maxChance, Math.max(0, chance)) : 0;

/** Damage of a crit that would otherwise hit for `dmg`. */
export const critDamage = (dmg: number): number => safeInt(dmg * CRIT.damageMult);

/** Cost to go from `level` to `level + 1`. */
export function characterCost(id: CharacterUpgradeId, level: number): number {
  const p = CHARACTER[id];
  if (!(level >= 0)) return Number.MAX_SAFE_INTEGER;
  // Crit is capped: MAX_SAFE_INTEGER means "can't buy" (bulk buys stop there).
  if (id === 'crit' && level >= critMaxLevel()) return Number.MAX_SAFE_INTEGER;
  return safeInt(Math.ceil(p.base * p.growth ** level));
}

/** Extra max HP from the coin upgrade at `level`. */
export const hpFromLevel = (level: number): number =>
  safeInt(CHARACTER.hp.perLevel * Math.max(0, level));

/** Defence points from the coin upgrade at `level`. */
export const defenceFromLevel = (level: number): number =>
  safeInt(CHARACTER.defence.perLevel * Math.max(0, level));

/**
 * The one defence formula (items + coin upgrade):
 * `taken = dmg × 100 / (100 + defence)`, rounded down, never below 1.
 * Diminishing returns, so defence can't make the hero immortal.
 */
export function defendedDamage(raw: number, defence: number): number {
  return Math.max(1, safeInt((raw * 100) / (100 + Math.max(0, defence))));
}

/** Share of each mob hit removed by `defence` (0.2 = −20 %), before rounding. */
export const defenceReduction = (defence: number): number => 1 - 100 / (100 + Math.max(0, defence));

// ── Bulk buy (×1 / ×10 / ×100 / MAX) ───────────────────────────────────────

export type BuyAmount = 1 | 10 | 100 | 'max';
export const BUY_AMOUNTS: readonly BuyAmount[] = [1, 10, 100, 'max'];

/** Backstop for MAX: never more levels than this in one buy. */
export const MAX_BULK_LEVELS = 10_000;

/** Levels a bulk buy gets and its total price. `levels` 0 = nothing to buy. */
export type BulkQuote = { levels: number; cost: number };

/**
 * Sums the same rounded per-level prices as single buys (so ×10 costs exactly
 * ten ×1 buys). `costAt(l)` is the price from level `l` to `l + 1`, and
 * `MAX_SAFE_INTEGER` there means "can't buy" (capped). Stops early at a cap or
 * before the total leaves the safe-integer range. MAX buys as many as `coins`
 * pays for. Prices grow geometrically, so the loop ends after a few hundred
 * steps at most; `MAX_BULK_LEVELS` is a backstop.
 */
export function bulkQuote(
  costAt: (level: number) => number,
  level: number,
  amount: BuyAmount,
  coins: number,
): BulkQuote {
  const limit = amount === 'max' ? MAX_BULK_LEVELS : amount;
  let levels = 0;
  let cost = 0;
  while (levels < limit) {
    const c = costAt(level + levels);
    if (!(c >= 0) || c >= Number.MAX_SAFE_INTEGER) break;
    const total = cost + c;
    if (total > Number.MAX_SAFE_INTEGER || (amount === 'max' && total > coins)) break;
    cost = total;
    levels++;
  }
  return { levels, cost };
}

// ── Tuning (docs/design/simulator.md → 2.3) ────────────────────────────────

/**
 * Every tunable number above, in one tree. Objects are the SAME objects as
 * the exports (`TUNING.items === ITEMS`), so an override is seen everywhere.
 * Keys are dotted paths to a number: `mob.hp.growth`, `weapons[1].price`.
 *
 * The game never changes these. Only the simulator does, through
 * `applyTuning` / `resetTuning` (never assign to `TUNING` directly: the
 * `let` exports above would not follow).
 *
 * A new tunable value: if it lives in one of the objects below, it is already
 * a key. A new top-level number: add it here, and if it is also exported as a
 * `let` (or derived from other values), add one line to `syncExports`.
 */
export const TUNING = {
  hero: { maxHp: HERO_MAX_HP },
  duel: DUEL,
  mobKinds: MOB_KINDS,
  mob: { hp: MOB_HP, dmg: MOB_DMG, coins: MOB_COINS },
  world1: WORLD_1,
  weapons: WEAPONS,
  upgrade: { growth: UPGRADE_GROWTH },
  shop: { weaponRevealFraction: WEAPON_REVEAL_FRACTION, critMaxPercent: CRIT_BUY_MAX_PERCENT },
  ascend: { gate: ASCEND_GATE, costKills: ASCEND_COST_KILLS, speedPerAscend: ASCEND_SPEED_PER },
  items: ITEMS,
  companions: COMPANIONS,
  character: CHARACTER,
  crit: CRIT,
};

/** The gate as a stage level, comparable with `GameState.best`. Same as `ascendGateLevel()`. */
export let ASCEND_GATE_LEVEL = ascendGateLevel();
/** Ascend price in coins. Same as `ascendCost()`. */
export let ASCEND_COST = ascendCost();
/** Highest crit upgrade level that can be bought. Same as `critMaxLevel()`. */
export let CRIT_MAX_LEVEL = critMaxLevel();

/** Copies `TUNING` into the `let` exports and recomputes the derived ones. */
function syncExports(): void {
  HERO_MAX_HP = TUNING.hero.maxHp;
  UPGRADE_GROWTH = TUNING.upgrade.growth;
  WEAPON_REVEAL_FRACTION = TUNING.shop.weaponRevealFraction;
  CRIT_BUY_MAX_PERCENT = TUNING.shop.critMaxPercent;
  ASCEND_COST_KILLS = TUNING.ascend.costKills;
  ASCEND_SPEED_PER = TUNING.ascend.speedPerAscend;
  CROW_PRICE = COMPANIONS.crow.price;
  CROW_BASE_PERCENT = COMPANIONS.crow.basePercent;
  CROW_PERCENT_PER_LEVEL = COMPANIONS.crow.percentPerLevel;
  WOLF_PRICE = COMPANIONS.wolf.price;
  WOLF_BASE_PERCENT = COMPANIONS.wolf.basePercent;
  WOLF_PERCENT_PER_LEVEL = COMPANIONS.wolf.percentPerLevel;
  ASCEND_GATE_LEVEL = ascendGateLevel();
  ASCEND_COST = ascendCost();
  CRIT_MAX_LEVEL = critMaxLevel();
}

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;
const hasOwn = (o: Tree, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Every number in `t` with its path, depth first in declaration order. */
function numberLeaves(t: Tree, path: string[] = [], out: [string[], number][] = []) {
  for (const k of Object.keys(t)) {
    const v = t[k];
    if (typeof v === 'number') out.push([[...path, k], v]);
    else if (isTree(v)) numberLeaves(v, [...path, k], out);
  }
  return out;
}

/** Every tunable number as `[path, value]`, e.g. `[['weapons', '1', 'price'], 100]`. */
export const tuningLeaves = (): [string[], number][] => numberLeaves(TUNING);

const DEFAULTS = tuningLeaves();

/** The object holding the number at `path` (`weapons[1].price` or `weapons.1.price`), or throws. */
function parentOf(key: string): [Tree, string] {
  const keys = key.replace(/\[(\d+)\]/g, '.$1').split('.');
  const last = keys.pop() as string;
  let node: unknown = TUNING;
  for (const k of keys) node = isTree(node) && hasOwn(node, k) ? node[k] : undefined;
  if (!isTree(node) || !hasOwn(node, last) || typeof node[last] !== 'number') {
    throw new Error(`Unknown tuning key "${key}"`);
  }
  return [node, last];
}

/**
 * Overrides one tunable number (simulator only). Throws on a key that is not
 * a number in `TUNING` (typos must not silently run the default) and on a
 * value that is not a finite number.
 */
export function applyTuning(key: string, value: number): void {
  const [node, last] = parentOf(key);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Tuning "${key}" must be a finite number, got ${String(value)}`);
  }
  node[last] = value;
  syncExports();
}

/** Puts every tunable number back to the game's default. */
export function resetTuning(): void {
  for (const [path, value] of DEFAULTS) {
    let node = TUNING as unknown as Tree;
    for (const k of path.slice(0, -1)) node = node[k] as Tree;
    node[path[path.length - 1]] = value;
  }
  syncExports();
}
