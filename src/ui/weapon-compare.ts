import { formatNumber } from '../game/format';
import { heroDamage, type GameState } from '../game/state';
import { setClass, type Show } from './dom';

export type WeaponCompare = {
  /** Damage per hit with the equipped weapon (what the stats window shows). */
  current: number;
  /** Damage per hit the hero would have with `tier` equipped (level 1 if not owned). */
  next: number;
  /** `next - current`; negative when the weapon is weaker than the equipped one. */
  diff: number;
};

/**
 * Compares the hero's damage per hit now with the damage after equipping
 * weapon `tier`. Uses the game's own `heroDamage`, so weapon multiplier and
 * item damage are included and the numbers agree with the stats window.
 */
export function weaponCompare(
  s: Pick<GameState, 'equipped' | 'weaponLevels'> & Partial<Pick<GameState, 'items'>>,
  tier: number,
): WeaponCompare {
  const weaponLevels = s.weaponLevels.slice();
  weaponLevels[tier] = Math.max(1, weaponLevels[tier] ?? 0);
  const current = heroDamage(s);
  const next = heroDamage({ equipped: tier, weaponLevels, items: s.items });
  return { current, next, diff: next - current };
}

/** `+18`, `0`, or `−4` (a real minus sign, no plus on a loss). */
export function formatDiff(diff: number): string {
  if (diff > 0) return `+${formatNumber(diff)}`;
  if (diff < 0) return `−${formatNumber(-diff)}`;
  return '0';
}

/** The whole comparison as text, e.g. `12 → 30 (+18)`. */
export function compareText(c: WeaponCompare): string {
  return `${formatNumber(c.current)} → ${formatNumber(c.next)} (${formatDiff(c.diff)})`;
}

/** Markup for one shop weapon row's comparison (hidden until it is the weapon on offer). */
export const WEAPON_COMPARE_HTML =
  `<span class="shop-compare">Damage <span class="cmp-cur"></span> → ` +
  `<span class="cmp-new"></span> <span class="cmp-diff"></span></span>`;

/** Fills one row's comparison; only a stronger weapon gets the green "next" colour. */
export function showWeaponCompare(
  li: Element,
  s: Pick<GameState, 'equipped' | 'weaponLevels'> & Partial<Pick<GameState, 'items'>>,
  tier: number,
  show: Show,
): void {
  const c = weaponCompare(s, tier);
  const next = li.querySelector('.cmp-new')!;
  show(li.querySelector('.cmp-cur')!, formatNumber(c.current));
  show(next, formatNumber(c.next));
  show(li.querySelector('.cmp-diff')!, `(${formatDiff(c.diff)})`);
  setClass(next, 'dmg-next', c.diff > 0);
}
