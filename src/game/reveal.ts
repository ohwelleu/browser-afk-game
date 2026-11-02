/**
 * Which weapons Shop → Weapons shows. A weapon appears once the coins reach
 * `WEAPON_REVEAL_FRACTION` of its price, and stays once shown (spending coins
 * never hides it again). Owned weapons are always shown. Coming back from a
 * long AFK with lots of coins can reveal several at once.
 */
import { WEAPON_REVEAL_FRACTION, WEAPONS } from './balance';

/** True when `coins` are close enough to `price` to show the weapon. */
export const passesReveal = (coins: number, price: number): boolean =>
  coins >= price * WEAPON_REVEAL_FRACTION;

/**
 * Revealed flag per weapon tier: kept from `prev`, plus owned weapons, plus
 * whatever `coins` reveal now. Bad or missing `prev` entries count as hidden.
 */
export function revealedWeapons(
  weaponLevels: readonly unknown[],
  coins: number,
  prev: readonly unknown[] = [],
): boolean[] {
  return WEAPONS.map(
    (w, i) =>
      prev[i] === true ||
      (typeof weaponLevels[i] === 'number' && (weaponLevels[i] as number) >= 1) ||
      passesReveal(coins, w.price),
  );
}

type Revealable = { weaponLevels: number[]; coins: number; revealedWeapons: boolean[] };

/**
 * Re-checks the reveal after coins or weapons changed. Mutates a draft (only
 * replacing the array when something new shows), returns true if it did.
 */
export function revealWeapons(s: Revealable): boolean {
  const next = revealedWeapons(s.weaponLevels, s.coins, s.revealedWeapons);
  if (next.every((v, i) => v === s.revealedWeapons[i])) return false;
  s.revealedWeapons = next;
  return true;
}

/** Weapons not shown yet (the shop only says how many are left, never which). */
export const hiddenWeaponCount = (s: Pick<Revealable, 'revealedWeapons'>): number =>
  WEAPONS.filter((_, i) => s.revealedWeapons[i] !== true).length;
