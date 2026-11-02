import { describe, expect, it } from 'vitest';
import {
  bulkQuote,
  characterCost,
  COMPANIONS,
  companionMaxSpeedLevel,
  companionSpeedCost,
  upgradeCost,
} from './balance';
import {
  buyUpgrade,
  buyUpgrades,
  canBuyUpgrades,
  createState,
  newProgress,
  upgradeQuote,
  type Companion,
  type UpgradeTarget,
} from './state';

const stick = (l: number) => upgradeCost(0, l);
const sum = (from: number, n: number, cost = stick) =>
  Array.from({ length: n }, (_, i) => cost(from + i)).reduce((a, b) => a + b, 0);

describe('bulkQuote', () => {
  it('sums the same rounded prices as single buys', () => {
    expect(bulkQuote(stick, 1, 1, 0)).toEqual({ levels: 1, cost: stick(1) });
    expect(bulkQuote(stick, 1, 10, 0)).toEqual({ levels: 10, cost: sum(1, 10) });
    expect(bulkQuote(stick, 7, 100, 0)).toEqual({ levels: 100, cost: sum(7, 100) });
  });

  it('MAX buys as many levels as the coins pay for', () => {
    const coins = sum(1, 12);
    expect(bulkQuote(stick, 1, 'max', coins)).toEqual({ levels: 12, cost: coins });
    expect(bulkQuote(stick, 1, 'max', coins - 1).levels).toBe(11);
  });

  it('MAX with 0 coins (or too few) gets nothing', () => {
    expect(bulkQuote(stick, 1, 'max', 0)).toEqual({ levels: 0, cost: 0 });
    expect(bulkQuote(stick, 1, 'max', stick(1) - 1)).toEqual({ levels: 0, cost: 0 });
  });

  it('stops at a cap (MAX_SAFE_INTEGER price)', () => {
    const def = COMPANIONS.crow;
    const cap = companionMaxSpeedLevel(def);
    const speed = (l: number) => companionSpeedCost(def, l);
    expect(bulkQuote(speed, cap - 3, 10, 0)).toEqual({ levels: 3, cost: sum(cap - 3, 3, speed) });
    expect(bulkQuote(speed, cap, 1, Number.MAX_SAFE_INTEGER)).toEqual({ levels: 0, cost: 0 });
  });

  it('stays in the safe-integer range with huge coins and levels', () => {
    const q = bulkQuote(stick, 1, 'max', Number.MAX_SAFE_INTEGER);
    expect(q.levels).toBeGreaterThan(100);
    expect(q.levels).toBeLessThan(1_000);
    expect(Number.isSafeInteger(q.cost)).toBe(true);
    expect(bulkQuote(stick, 300, 100, 0).levels).toBe(0); // one level already past 2^53
    const d = bulkQuote((l) => characterCost('defence', l), 0, 'max', Number.MAX_SAFE_INTEGER);
    expect(Number.isSafeInteger(d.cost)).toBe(true);
  });
});

describe('buyUpgrades', () => {
  const crow = (c: Partial<Companion> = {}): Companion => ({
    id: 'crow',
    dmgLevel: 1,
    autoUnlocked: false,
    speedLevel: 1,
    ...c,
  });

  it('applies all levels at once and charges the quoted total', () => {
    const coins = sum(1, 10) + 3;
    const s = createState({ ...newProgress(), coins });
    const t: UpgradeTarget = { type: 'weapon', tier: 0 };
    const next = buyUpgrades(s, t, 10);
    expect(next.weaponLevels[0]).toBe(11);
    expect(next.coins).toBe(3);
    expect(next.events).toEqual([{ type: 'sfx', name: 'purchase' }, { type: 'save' }]);
    expect(s.weaponLevels[0]).toBe(1); // input untouched
  });

  it('×10 equals ten ×1 buys', () => {
    let a = createState({ ...newProgress(), coins: 10_000 });
    const b = buyUpgrades(a, { type: 'weapon', tier: 0 }, 10);
    for (let i = 0; i < 10; i++) a = buyUpgrade(a);
    expect(b.coins).toBe(a.coins);
    expect(b.weaponLevels).toEqual(a.weaponLevels);
  });

  it('buys nothing when the full amount is not affordable', () => {
    const s = createState({ ...newProgress(), coins: sum(1, 10) - 1 });
    expect(canBuyUpgrades(s, { type: 'weapon', tier: 0 }, 10)).toBe(false);
    expect(buyUpgrades(s, { type: 'weapon', tier: 0 }, 10)).toBe(s);
    expect(canBuyUpgrades(s, { type: 'weapon', tier: 0 }, 'max')).toBe(true);
  });

  it('MAX with 0 coins does nothing', () => {
    const s = createState({ ...newProgress(), coins: 0 });
    expect(canBuyUpgrades(s, { type: 'defence' }, 'max')).toBe(false);
    expect(buyUpgrades(s, { type: 'defence' }, 'max')).toBe(s);
  });

  it('upgrades an owned weapon that is not equipped, never an unowned one', () => {
    const coins = sum(1, 5, (l) => upgradeCost(1, l));
    const s = createState({ ...newProgress(), coins, weaponLevels: [3, 1, 0, 0, 0], equipped: 0 });
    const next = buyUpgrades(s, { type: 'weapon', tier: 1 }, 'max');
    expect(next.weaponLevels).toEqual([3, 6, 0, 0, 0]);
    expect(next.equipped).toBe(0);
    expect(next.coins).toBe(0);
    expect(buyUpgrades(next, { type: 'weapon', tier: 2 }, 1)).toBe(next);
  });

  it('defence and crow damage buy in bulk', () => {
    const def = sum(0, 10, (l) => characterCost('defence', l));
    const s = createState({ ...newProgress(), coins: def, companion: crow() });
    expect(upgradeQuote(s, { type: 'defence' }, 10)).toEqual({ levels: 10, cost: def });
    expect(buyUpgrades(s, { type: 'defence' }, 10).character.defenceLevel).toBe(10);
    const dmg = buyUpgrades(s, { type: 'companion', kind: 'dmg' }, 'max');
    expect(dmg.companion!.dmgLevel).toBeGreaterThan(1);
    expect(dmg.coins).toBeLessThan(s.coins);
  });

  it('crow speed needs auto and stops at the cap', () => {
    const cap = companionMaxSpeedLevel(COMPANIONS.crow);
    const rich = Number.MAX_SAFE_INTEGER;
    const locked = createState({ ...newProgress(), coins: rich, companion: crow() });
    expect(buyUpgrades(locked, { type: 'companion', kind: 'speed' }, 'max')).toBe(locked);
    const s = createState({
      ...newProgress(),
      coins: rich,
      companion: crow({ autoUnlocked: true }),
    });
    const next = buyUpgrades(s, { type: 'companion', kind: 'speed' }, 100);
    expect(next.companion!.speedLevel).toBe(cap);
    expect(buyUpgrades(next, { type: 'companion', kind: 'speed' }, 'max')).toBe(next);
  });
});
