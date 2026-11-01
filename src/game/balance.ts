/**
 * Every tunable number of the game. Logic reads from here; nothing else
 * should hardcode balance values. See docs/PLAN.md → Balance.
 */

export const STAGES_PER_WORLD = 6;
export const BOSS_STAGE = 6;
export const HERO_MAX_HP = 100;

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

export const UPGRADE_GROWTH = 1.15;

const MOB_HP = { base: 10, growth: 1.28, boss: 5 };
const MOB_DMG = { base: 4, growth: 1.05, boss: 2 };
const MOB_COINS = { base: 4, growth: 1.3, boss: 5 };
/**
 * World 1 is a tutorial: mob HP and damage × these. HP is cut hard so a fresh
 * stick (1 dmg) kills a normal mob in 2–3 hits (1.1–1.5: 2, 2, 2, 3, 3 HP).
 */
const WORLD_1_HP_MULT = 0.11;
const WORLD_1_DMG_MULT = 0.5;

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

export const mobHp = (world: number, stage: number) =>
  scaled(MOB_HP, world, stage, WORLD_1_HP_MULT);
export const mobDamage = (world: number, stage: number) =>
  scaled(MOB_DMG, world, stage, WORLD_1_DMG_MULT);
export const mobCoins = (world: number, stage: number) => scaled(MOB_COINS, world, stage, 1);

/** `damage = baseDmg × level` (level 0 = not owned = no damage). */
export function weaponDamage(tier: number, level: number): number {
  const w = WEAPONS[tier];
  return w ? safeInt(w.baseDmg * level) : 0;
}

/** Cost to go from `level` to `level + 1`: `upgradeBase × 1.15^(level−1)`. */
export function upgradeCost(tier: number, level: number): number {
  const w = WEAPONS[tier];
  if (!w || level < 1) return Number.MAX_SAFE_INTEGER;
  return safeInt(Math.ceil(w.upgradeBase * UPGRADE_GROWTH ** (level - 1)));
}

// ── Items: ring and pendant (docs/design/active-play.md → 2. Items) ────────

export type ItemSlot = 'ring' | 'pendant';
export type ItemTier = 'C' | 'B' | 'A' | 'S';
export type ItemStat = 'damage' | 'defence' | 'speed' | 'itemFind';

export const ITEM_SLOTS: readonly ItemSlot[] = ['ring', 'pendant'];
export const ITEM_TIERS: readonly ItemTier[] = ['C', 'B', 'A', 'S'];
export const ITEM_STATS: readonly ItemStat[] = ['damage', 'defence', 'speed', 'itemFind'];

export const ITEMS = {
  /** How many different stats an item of each tier has (S = all 4). */
  statCount: { C: 1, B: 2, A: 3, S: 4 } as Record<ItemTier, number>,
  tierMult: { C: 1.0, B: 1.3, A: 1.6, S: 2.0 } as Record<ItemTier, number>,
  /** Rarity weights of a drop, before item find. */
  rarity: { C: 70, B: 22, A: 7, S: 1 } as Record<ItemTier, number>,
  /** Chance per kill that something drops at all (item find never changes this). */
  dropChance: { mob: 0.005, boss: 0.03 },
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
  } as Record<ItemStat, { base: number; growth: number; flat: boolean }>,
  /** Caps on the total of both equipped items. */
  caps: { speed: 0.25, itemFind: 1.0 },
  inventorySize: 20,
  /** Sell price = `mobCoins(drop stage) × sellMult × tierMult`. */
  sellMult: 5,
};

/** One stat roll on an item from stage level `L`. `roll` is the 0.8–1.2 factor. */
export function itemStatValue(stat: ItemStat, L: number, tier: ItemTier, roll: number): number {
  const p = ITEMS.stats[stat];
  const v = p.base * p.growth ** (L - 1) * ITEMS.tierMult[tier] * roll;
  // % stats: kept to 0.01 % steps so saves and labels stay tidy.
  return p.flat ? Math.max(1, safeInt(v)) : Math.round(v * 10_000) / 10_000;
}

/** Rarity weights with item find: B/A/S × (1 + itemFind), C unchanged (normalise by the sum). */
export function itemRarityWeights(itemFind: number): Record<ItemTier, number> {
  const f = 1 + Math.max(0, itemFind);
  const r = ITEMS.rarity;
  return { C: r.C, B: r.B * f, A: r.A * f, S: r.S * f };
}

export function itemSellPrice(world: number, stage: number, tier: ItemTier): number {
  return safeInt(mobCoins(world, stage) * ITEMS.sellMult * ITEMS.tierMult[tier]);
}
