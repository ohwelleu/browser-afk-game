import { describe, expect, it } from 'vitest';
import {
  mobCoins,
  mobDamage,
  mobHp,
  mobKind,
  safeInt,
  stageLevel,
  upgradeCost,
  weaponDamage,
} from './balance';

describe('balance', () => {
  it('stage level', () => {
    expect(stageLevel(1, 1)).toBe(1);
    expect(stageLevel(1, 6)).toBe(6);
    expect(stageLevel(2, 1)).toBe(7);
  });

  it('mob scaling follows the plan formulas', () => {
    expect(mobHp(2, 2)).toBe(Math.ceil(10 * 1.28 ** 7));
    expect(mobDamage(2, 2)).toBe(Math.ceil(4 * 1.05 ** 7));
    expect(mobCoins(2, 2)).toBe(Math.ceil(4 * 1.3 ** 7));
  });

  it('boss multipliers', () => {
    expect(mobHp(2, 6)).toBe(Math.ceil(10 * 1.28 ** 11 * 5));
    expect(mobDamage(2, 6)).toBe(Math.ceil(4 * 1.05 ** 11 * 2));
    expect(mobCoins(2, 6)).toBe(Math.ceil(4 * 1.3 ** 11 * 5));
    expect(mobKind(6)).toBe('boss');
  });

  it('world 1 halves HP and damage but not coins', () => {
    expect(mobHp(1, 1)).toBe(5);
    expect(mobDamage(1, 1)).toBe(2);
    expect(mobCoins(1, 1)).toBe(4);
  });

  it('values are always positive integers, even very deep', () => {
    for (const v of [mobHp(500, 3), mobDamage(500, 3), mobCoins(500, 3)]) {
      expect(Number.isSafeInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('weapons and upgrades', () => {
    expect(weaponDamage(1, 3)).toBe(18);
    expect(weaponDamage(9, 3)).toBe(0);
    expect(upgradeCost(0, 1)).toBe(5);
    expect(upgradeCost(0, 2)).toBe(Math.ceil(5 * 1.15));
    expect(upgradeCost(1, 1)).toBe(60);
  });

  it('a stick at level 6 matches a fresh wooden sword', () => {
    expect(weaponDamage(0, 6)).toBe(weaponDamage(1, 1));
  });

  it('safeInt guards NaN and Infinity', () => {
    expect(safeInt(NaN)).toBe(0);
    expect(safeInt(Infinity)).toBe(Number.MAX_SAFE_INTEGER);
    expect(safeInt(-Infinity)).toBe(-Number.MAX_SAFE_INTEGER);
    expect(safeInt(2.9)).toBe(2);
  });
});
