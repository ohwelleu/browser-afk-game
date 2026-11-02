import { describe, expect, it } from 'vitest';
import { WEAPON_REVEAL_FRACTION, WEAPONS } from './balance';
import { sellItem, sellPrice, type Item } from './items';
import { hiddenWeaponCount, passesReveal, revealedWeapons } from './reveal';
import { buyWeapon, createState, newProgress, update, type GameState } from './state';

const tick = 1 / 20;

describe('weapon reveal', () => {
  it('uses a 90% threshold', () => {
    expect(WEAPON_REVEAL_FRACTION).toBe(0.9);
    expect(passesReveal(89, 100)).toBe(false);
    expect(passesReveal(90, 100)).toBe(true);
    expect(passesReveal(2_699, 3_000)).toBe(false);
    expect(passesReveal(2_700, 3_000)).toBe(true);
  });

  it('a new game shows only the stick', () => {
    const s = createState();
    expect(s.revealedWeapons).toEqual([true, false, false, false, false]);
    expect(hiddenWeaponCount(s)).toBe(WEAPONS.length - 1);
  });

  it('owned weapons are always shown', () => {
    expect(revealedWeapons([1, 0, 1, 0, 0], 0)).toEqual([true, false, true, false, false]);
  });

  it('reveals while playing once coins reach 90%, and stays after spending', () => {
    let s: GameState = createState({ ...newProgress(), coins: 89 });
    expect(s.revealedWeapons[1]).toBe(false);
    s = update({ ...s, coins: 90 }, tick);
    expect(s.revealedWeapons[1]).toBe(true);
    expect(s.events).toContainEqual({ type: 'save' });
    s = update({ ...s, coins: 100 }, tick);
    s = buyWeapon(s);
    expect(s.weaponLevels[1]).toBe(1);
    expect(s.coins).toBeLessThan(90);
    s = update(s, tick);
    expect(s.revealedWeapons).toEqual([true, true, false, false, false]);
  });

  it('a long AFK can reveal several weapons at once', () => {
    const s = createState({ ...newProgress(), coins: 100_000 });
    expect(s.revealedWeapons).toEqual([true, true, true, true, false]);
    expect(hiddenWeaponCount(s)).toBe(1);
  });

  it('selling an item re-checks the reveal', () => {
    const base = createState();
    const item: Item = { id: 1, slot: 'ring', tier: 'S', world: 3, stage: 6, stats: {} };
    const gain = sellPrice(item);
    expect(gain).toBeGreaterThan(0);
    const coins = Math.max(0, 90 - gain);
    expect(coins).toBeLessThan(90);
    const s = sellItem({ ...base, coins, items: { ...base.items, bag: [item] } }, 1);
    expect(s.coins).toBeGreaterThanOrEqual(90);
    expect(s.revealedWeapons[1]).toBe(true);
  });
});
