import { afterEach, describe, expect, it } from 'vitest';
import {
  ASCEND_COST,
  ASCEND_GATE_LEVEL,
  CRIT_MAX_LEVEL,
  HERO_MAX_HP,
  ITEMS,
  TUNING,
  UPGRADE_GROWTH,
  WEAPONS,
  ascendCost,
  characterCost,
  critMaxLevel,
  dropChance,
  mobCoins,
  mobHp,
  upgradeCost,
} from '../game/balance';
import { canAscend } from '../game/ascend';
import { createState, heroMaxHp, newProgress } from '../game/state';
import {
  applyTuning,
  applyTunings,
  getTuning,
  resetTuning,
  tuningKeys,
  tuningValues,
} from './tuning';

const DEFAULTS = tuningValues();

afterEach(resetTuning);

describe('tuning keys', () => {
  it('lists the keys the design names, with today’s values', () => {
    expect(getTuning('mob.hp.growth')).toBe(1.28);
    expect(getTuning('mob.dmg.growth')).toBe(1.07);
    expect(getTuning('mob.coins.growth')).toBe(1.3);
    expect(getTuning('world1.hpMult')).toBe(0.11);
    expect(getTuning('upgrade.growth')).toBe(1.15);
    expect(getTuning('weapons[1].price')).toBe(100);
    expect(getTuning('weapons.1.upgradeBase')).toBe(60);
    expect(getTuning('items.dropChance.mob')).toBe(0.005);
    expect(getTuning('items.stats.defence.base')).toBe(0.3);
    expect(getTuning('crit.maxChance')).toBe(0.75);
    expect(getTuning('ascend.gate.world')).toBe(6);
    expect(getTuning('ascend.costKills')).toBe(100);
    expect(getTuning('companions.crow.price')).toBe(25);
    expect(tuningKeys()).toContain('character.defence.perLevel');
  });

  it('only lists numbers (no names, flags or sprite keys)', () => {
    expect(Object.values(DEFAULTS).every((v) => typeof v === 'number')).toBe(true);
    expect(tuningKeys()).not.toContain('items.stats.damage.flat');
    expect(tuningKeys()).not.toContain('companions.crow.name');
  });
});

describe('applyTuning', () => {
  it('throws on an unknown key and changes nothing', () => {
    expect(() => applyTuning('mob.hp.grwoth', 2)).toThrow(/Unknown tuning key "mob.hp.grwoth"/);
    expect(() => applyTuning('mob.hp', 2)).toThrow(/Unknown/); // an object, not a number
    expect(() => applyTuning('items.stats.damage.flat', 1)).toThrow(/Unknown/); // not a number
    expect(() => applyTuning('companions.crow.name', 1)).toThrow(/Unknown/);
    expect(() => applyTuning('weapons[9].price', 1)).toThrow(/Unknown/);
    expect(() => applyTuning('__proto__.x', 1)).toThrow(/Unknown/);
    expect(() => getTuning('nope')).toThrow(/Unknown tuning key "nope"/);
    expect(tuningValues()).toEqual(DEFAULTS);
  });

  it('throws on a value that is not a finite number', () => {
    expect(() => applyTuning('mob.hp.growth', Number.NaN)).toThrow(/finite/);
    expect(() => applyTuning('mob.hp.growth', Infinity)).toThrow(/finite/);
    expect(getTuning('mob.hp.growth')).toBe(1.28);
  });

  it('an override changes the balance functions', () => {
    const before = mobHp(3, 2);
    applyTuning('mob.hp.growth', 1.5);
    expect(mobHp(3, 2)).toBe(Math.ceil(10 * 1.5 ** 13));
    expect(mobHp(3, 2)).not.toBe(before);

    applyTuning('upgrade.growth', 2);
    expect(upgradeCost(0, 4)).toBe(5 * 2 ** 3);
    expect(TUNING.upgrade.growth).toBe(2);

    applyTuning('weapons[1].price', 123);
    expect(WEAPONS[1].price).toBe(123);

    applyTuning('items.dropChance.boss', 0.5);
    expect(dropChance(2, 6)).toBe(0.5);
    expect(ITEMS.dropChance.boss).toBe(0.5);
  });

  it('keeps the exported names and derived values in step', () => {
    applyTuning('upgrade.growth', 1.2);
    expect(UPGRADE_GROWTH).toBe(1.2);

    applyTuning('ascend.costKills', 10);
    expect(ascendCost()).toBe(10 * mobCoins(6, 1));
    expect(ASCEND_COST).toBe(ascendCost());

    applyTuning('ascend.gate.world', 3);
    expect(ASCEND_GATE_LEVEL).toBe(13);
    expect(ASCEND_COST).toBe(10 * mobCoins(3, 1));

    applyTuning('shop.critMaxPercent', 20);
    expect(critMaxLevel()).toBe(20);
    expect(CRIT_MAX_LEVEL).toBe(20);
    expect(characterCost('crit', 20)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('game code that imports the names sees the override', () => {
    applyTuning('ascend.costKills', 1);
    expect(canAscend({ best: 13, coins: mobCoins(3, 1) })).toBe(false);
    applyTuning('ascend.gate.world', 3);
    expect(canAscend({ best: 13, coins: mobCoins(3, 1) })).toBe(true);

    applyTuning('hero.maxHp', 250);
    expect(HERO_MAX_HP).toBe(250);
    expect(heroMaxHp(createState(newProgress()))).toBe(250);
  });
});

describe('applyTunings', () => {
  it('applies every key of a scenario block', () => {
    applyTunings({ 'mob.hp.growth': 1.3, 'items.dropChance.mob': 0.01 });
    expect(getTuning('mob.hp.growth')).toBe(1.3);
    expect(getTuning('items.dropChance.mob')).toBe(0.01);
  });

  it('a bad key or value applies nothing', () => {
    expect(() => applyTunings({ 'mob.hp.growth': 1.3, 'mob.hp.typo': 1 })).toThrow(/mob.hp.typo/);
    expect(() =>
      applyTunings({ 'mob.hp.growth': 1.3, 'mob.dmg.growth': 'x' as unknown as number }),
    ).toThrow(/finite/);
    expect(tuningValues()).toEqual(DEFAULTS);
  });
});

describe('resetTuning', () => {
  it('restores every default, including exported names and derived values', () => {
    const exported = {
      ASCEND_COST,
      ASCEND_GATE_LEVEL,
      CRIT_MAX_LEVEL,
      HERO_MAX_HP,
      UPGRADE_GROWTH,
    };
    for (const key of tuningKeys()) applyTuning(key, DEFAULTS[key] + 1);
    expect(tuningValues()).not.toEqual(DEFAULTS);

    resetTuning();
    expect(tuningValues()).toEqual(DEFAULTS);
    expect({ ASCEND_COST, ASCEND_GATE_LEVEL, CRIT_MAX_LEVEL, HERO_MAX_HP, UPGRADE_GROWTH }).toEqual(
      exported,
    );
  });

  it('keeps the same objects, so references held elsewhere stay valid', () => {
    const items = ITEMS;
    applyTuning('items.caps.speed', 1);
    resetTuning();
    expect(TUNING.items).toBe(items);
    expect(ITEMS.caps.speed).toBe(0.25);
  });
});
