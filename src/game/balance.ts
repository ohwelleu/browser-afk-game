/**
 * Every tunable number of the game. Logic reads from here; nothing else
 * should hardcode balance values. See docs/PLAN.md → Balance.
 */

export const STAGES_PER_WORLD = 6;
export const BOSS_STAGE = 6;
export const HERO_MAX_HP = 100;

/** Duel timeline in seconds (duel time starts at 0 when the mob appears). */
export const DUEL = {
  intro: 2.0,
  heroFirstHit: 2.0,
  mobFirstHit: 2.5,
  /** How long the death animations play before the next duel. */
  mobDying: 1.2,
  heroDying: 1.8,
  /** Empty beat between a death and the next intro. */
  transition: 0.4,
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
/** World 1 is a tutorial: mob HP and damage × this. */
const WORLD_1_MULT = 0.5;

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
  tutorial: boolean,
): number {
  const L = stageLevel(world, stage);
  let v = p.base * p.growth ** (L - 1);
  if (isBoss(stage)) v *= p.boss;
  if (tutorial && world === 1) v *= WORLD_1_MULT;
  return Math.max(1, safeInt(Math.ceil(v)));
}

export const mobHp = (world: number, stage: number) => scaled(MOB_HP, world, stage, true);
export const mobDamage = (world: number, stage: number) => scaled(MOB_DMG, world, stage, true);
export const mobCoins = (world: number, stage: number) => scaled(MOB_COINS, world, stage, false);

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
