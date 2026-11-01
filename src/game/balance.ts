/**
 * Every tunable number of the game. Logic reads from here; nothing else
 * should hardcode balance values. See docs/PLAN.md → Balance.
 */
import type { AttackDef } from './attacks';

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

// ── Companions (docs/design/active-play.md → 1. Crow) ──────────────────────

export type CompanionId = 'crow';

/**
 * A companion is data, so another one (an animal, a drone…) is a new entry
 * here, not new code. There is one companion slot.
 */
export type CompanionDef = {
  id: CompanionId;
  name: string;
  price: number;
  /** Shows up in the shop once `best` reaches this stage level (2 = 1.1 cleared). */
  unlockLevel: number;
  /** `damage = baseDmg × dmgLevel × attack.damageMult`. */
  baseDmg: number;
  /** `hitFrame / fps` is the fly-out time before the peck lands. */
  attack: AttackDef;
  /** Seconds between click pecks. Clicks during the cooldown are ignored. */
  clickCooldown: number;
  /** Auto attack interval at speed level 1, in seconds. */
  autoStart: number;
  /** Auto attacks never get faster than this. */
  autoMinInterval: number;
  /** Seconds taken off the auto interval per speed level. */
  autoStep: number;
  /** Cost from `level` to `level + 1`: `base × growth^(level−1)`. */
  dmgUpgrade: { base: number; growth: number };
  /** One-off price that unlocks the auto attack. */
  autoPrice: number;
  speedUpgrade: { base: number; growth: number };
  /** Sprite set key. */
  sprites: string;
};

export const COMPANIONS: Record<CompanionId, CompanionDef> = {
  crow: {
    id: 'crow',
    name: 'Crow',
    price: 25,
    unlockLevel: 2,
    baseDmg: 1,
    attack: {
      id: 'peck',
      heroAnim: 'peck',
      hitFrame: 2,
      fps: 12,
      interval: 3.0,
      targets: 'single',
      damageMult: 1,
    },
    clickCooldown: 0.5,
    autoStart: 3.0,
    autoMinInterval: 1.0,
    autoStep: 0.1,
    dmgUpgrade: { base: 10, growth: 1.15 },
    autoPrice: 150,
    speedUpgrade: { base: 50, growth: 1.3 },
    sprites: 'crow',
  },
};

/** `damage = baseDmg × dmgLevel` (flat, its own levels). */
export function companionDamage(def: CompanionDef, dmgLevel: number): number {
  return safeInt(def.baseDmg * dmgLevel * def.attack.damageMult);
}

/** `autoInterval = max(autoMinInterval, autoStart − autoStep × (speedLevel − 1))`, in seconds. */
export function companionAutoInterval(def: CompanionDef, speedLevel: number): number {
  return Math.max(def.autoMinInterval, def.autoStart - def.autoStep * (speedLevel - 1));
}

/** Highest useful speed level (the one that reaches `autoMinInterval`): 21 for the crow. */
export function companionMaxSpeedLevel(def: CompanionDef): number {
  return 1 + Math.round((def.autoStart - def.autoMinInterval) / def.autoStep);
}

const growthCost = (p: { base: number; growth: number }, level: number) =>
  level < 1 ? Number.MAX_SAFE_INTEGER : safeInt(Math.ceil(p.base * p.growth ** (level - 1)));

/** Damage upgrade cost from `level` to `level + 1`. */
export const companionDmgCost = (def: CompanionDef, level: number): number =>
  growthCost(def.dmgUpgrade, level);

/** Speed upgrade cost from `level` to `level + 1` (MAX_SAFE_INTEGER once capped). */
export function companionSpeedCost(def: CompanionDef, level: number): number {
  if (level >= companionMaxSpeedLevel(def)) return Number.MAX_SAFE_INTEGER;
  return growthCost(def.speedUpgrade, level);
}
