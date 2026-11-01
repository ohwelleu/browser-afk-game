/**
 * Attacks are data (docs/PLAN.md → "Attacks are data"). v1 has one weapon
 * type (sword) with one attack (slash); new weapon types and skills are new
 * entries here, not new code paths.
 */
export type AttackDef = {
  id: string;
  /**
   * Animation to play: a hero animation (key of `heroAnimations`) for weapon
   * attacks, a companion animation for companion attacks.
   */
  heroAnim: 'slash' | 'peck';
  /** Effect sprite family drawn during the attack. */
  effect?: 'slashArc';
  /** Animation frame where damage lands. */
  hitFrame: number;
  /** Frames per second of `heroAnim`; with `hitFrame` gives the wind-up time. */
  fps: number;
  /** Seconds between attacks. */
  interval: number;
  targets: 'single' | 'all' | 'projectile';
  damageMult: number;
};

export const ATTACKS = {
  slash: {
    id: 'slash',
    heroAnim: 'slash',
    effect: 'slashArc',
    hitFrame: 1,
    fps: 12,
    interval: 1.0,
    targets: 'single',
    damageMult: 1,
  },
} satisfies Record<string, AttackDef>;

export type AttackId = keyof typeof ATTACKS;

export type WeaponType = { id: string; attacks: AttackId[] };

export const WEAPON_TYPES = {
  sword: { id: 'sword', attacks: ['slash'] },
} satisfies Record<string, WeaponType>;

/** Weapon tier → weapon type. All v1 weapons are swords. */
export const WEAPON_TIER_TYPES: readonly (keyof typeof WEAPON_TYPES)[] = [
  'sword',
  'sword',
  'sword',
  'sword',
  'sword',
];

export function weaponAttack(tier: number): AttackDef {
  const type = WEAPON_TYPES[WEAPON_TIER_TYPES[tier] ?? 'sword'];
  return ATTACKS[type.attacks[0]];
}

/** Seconds from attack start to the hit frame. */
export const windup = (a: AttackDef): number => a.hitFrame / a.fps;
