import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import {
  CHARACTER,
  CRIT,
  CRIT_BUY_MAX_PERCENT,
  CRIT_MAX_LEVEL,
  capCritChance,
  characterCost,
  critDamage,
  critFromLevel,
  ITEMS,
  ITEM_TIERS,
  itemStatValue,
} from './balance';
import { gearTotals, newGear, rollItem, type Gear, type Item } from './items';
import { nextFloat } from './rng';
import {
  buyCrit,
  buyUpgrades,
  createState,
  critChance,
  heroDamage,
  newProgress,
  update,
  upgradeMaxed,
  upgradeQuote,
  type GameEvent,
  type GameState,
} from './state';

const ring = (crit: number): Item => ({
  id: 1,
  slot: 'ring',
  tier: 'C',
  world: 1,
  stage: 1,
  stats: { crit },
});
const gearWith = (...crits: number[]): Gear => ({
  ...newGear(0),
  ring: crits[0] === undefined ? null : ring(crits[0]),
  pendant: crits[1] === undefined ? null : { ...ring(crits[1]), id: 2, slot: 'pendant' },
  earring: crits[2] === undefined ? null : { ...ring(crits[2]), id: 3, slot: 'earring' },
  belt: crits[3] === undefined ? null : { ...ring(crits[3]), id: 4, slot: 'belt' },
});

/** A fresh game whose crit chance is `critLevel` upgrade levels plus the `crits` item chances. */
const game = (critLevel: number, crits: number[] = [], critRng = 1): GameState => ({
  ...createState({
    ...newProgress(),
    items: gearWith(...crits),
    character: { defenceLevel: 0, critLevel, hpLevel: 0, manaLevel: 0 },
  }),
  critRng,
});

/** The first float a crit RNG with this seed produces. */
const firstRoll = (seed: number) => nextFloat({ state: seed });

/** Smallest seed whose first crit roll satisfies `pred`. */
function seedWhere(pred: (roll: number) => boolean): number {
  for (let seed = 1; ; seed++) if (pred(firstRoll(seed))) return seed;
}

type DamageEvent = Extract<GameEvent, { type: 'damage' }>;

/** Runs until the hero's first hit on the mob and returns it with the state after it. */
function firstHeroHit(s: GameState): { hit: DamageEvent; s: GameState } {
  for (let i = 0; i < 10_000; i++) {
    s = update(s, TICK);
    const hit = s.events.find((e) => e.type === 'damage' && e.target === 'mob');
    if (hit && hit.type === 'damage') return { hit, s };
  }
  throw new Error('no hero hit');
}

describe('crit balance', () => {
  it('upgrade cost is base × growth^level, like the other character upgrades', () => {
    const { base, growth } = CHARACTER.crit;
    expect(characterCost('crit', 0)).toBe(base);
    expect(characterCost('crit', 1)).toBe(Math.ceil(base * growth));
    expect(characterCost('crit', 9)).toBe(Math.ceil(base * growth ** 9));
    expect(Number.isSafeInteger(characterCost('crit', 500))).toBe(true);
    expect(characterCost('crit', -1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('each upgrade level adds perLevel crit chance, without float noise', () => {
    expect(critFromLevel(0)).toBe(0);
    expect(critFromLevel(-3)).toBe(0);
    expect(critFromLevel(1)).toBe(0.01);
    expect(critFromLevel(3)).toBe(0.03);
    expect(critFromLevel(7)).toBe(0.07);
  });

  it('caps the chance at CRIT.maxChance and never below 0', () => {
    expect(CRIT.maxChance).toBe(0.75);
    expect(capCritChance(0.5)).toBe(0.5);
    expect(capCritChance(0.9)).toBe(0.75);
    expect(capCritChance(-1)).toBe(0);
    expect(capCritChance(Number.NaN)).toBe(0);
  });

  it('a crit does CRIT.damageMult × the hit', () => {
    expect(CRIT.damageMult).toBe(2);
    expect(critDamage(7)).toBe(14);
  });

  it('item crit values grow with the tier, are % stats and ignore the stage', () => {
    const values = ITEM_TIERS.map((t) => itemStatValue('crit', 1, t, 1));
    expect(values).toEqual([0.02, 0.026, 0.032, 0.04, 0.08]);
    expect(itemStatValue('crit', 40, 'A', 1)).toBe(itemStatValue('crit', 1, 'A', 1));
    expect(itemStatValue('crit', 1, 'C', ITEMS.roll.min)).toBe(0.016);
    expect(itemStatValue('crit', 1, 'S', ITEMS.roll.max)).toBe(0.048);
  });
});

describe('critChance', () => {
  it('is 0 for a new game', () => {
    expect(critChance(createState())).toBe(0);
    expect(critChance({})).toBe(0);
  });

  it('adds the upgrade and all equipped items', () => {
    expect(critChance(game(5))).toBe(0.05);
    expect(critChance(game(0, [0.02, 0.03]))).toBeCloseTo(0.05);
    expect(critChance(game(5, [0.02, 0.03]))).toBeCloseTo(0.1);
    expect(gearTotals(gearWith(0.02, 0.03)).crit).toBeCloseTo(0.05);
    expect(critChance(game(0, [0.02, 0.03, 0.04, 0.05]))).toBeCloseTo(0.14);
  });

  it('is capped at 75 % however it is reached', () => {
    expect(critChance(game(CRIT_MAX_LEVEL, [0.5])).toFixed(2)).toBe('0.75');
    expect(critChance(game(500, [0.5]))).toBe(0.75);
    expect(critChance(game(CRIT_MAX_LEVEL, [0.2, 0.2]))).toBeCloseTo(0.75);
    expect(critChance(game(CRIT_MAX_LEVEL, [0.1, 0.1, 0.1, 0.1]))).toBe(0.75);
    expect(critChance(game(0, [0.2, 0.2, 0.2, 0.2]))).toBe(0.75);
  });
});

describe('crit buy cap', () => {
  const coins = (critLevel: number, c = 1e15): GameState => ({ ...game(critLevel), coins: c });

  it('the Shop upgrade tops out at CRIT_BUY_MAX_PERCENT (40 %)', () => {
    expect(CRIT_BUY_MAX_PERCENT).toBe(40);
    expect(CRIT_MAX_LEVEL).toBe(40);
    expect(critFromLevel(CRIT_MAX_LEVEL - 1)).toBe(0.39);
    expect(critFromLevel(CRIT_MAX_LEVEL)).toBe(0.4);
    expect(critChance(game(CRIT_MAX_LEVEL))).toBe(0.4);
  });

  it('the last level is buyable, the next one is rejected', () => {
    const last = coins(CRIT_MAX_LEVEL - 1);
    expect(upgradeMaxed(last, { type: 'crit' })).toBe(false);
    const done = buyCrit(last);
    expect(done.character.critLevel).toBe(CRIT_MAX_LEVEL);
    expect(upgradeMaxed(done, { type: 'crit' })).toBe(true);
    expect(buyCrit(done)).toBe(done);
    expect(buyUpgrades(done, { type: 'crit' }, 1)).toBe(done);
    expect(characterCost('crit', CRIT_MAX_LEVEL)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('bulk buys never go past the cap', () => {
    const near = coins(CRIT_MAX_LEVEL - 3);
    // ×10 near the cap buys just the 3 remaining levels (same as other capped upgrades).
    expect(upgradeQuote(near, { type: 'crit' }, 10).levels).toBe(3);
    expect(upgradeQuote(near, { type: 'crit' }, 100).levels).toBe(3);
    expect(upgradeQuote(near, { type: 'crit' }, 'max').levels).toBe(3);
    expect(buyUpgrades(near, { type: 'crit' }, 100).character.critLevel).toBe(CRIT_MAX_LEVEL);
    expect(upgradeQuote(coins(0), { type: 'crit' }, 'max').levels).toBe(CRIT_MAX_LEVEL);
    expect(upgradeQuote(coins(CRIT_MAX_LEVEL), { type: 'crit' }, 'max')).toEqual({
      levels: 0,
      cost: 0,
    });
  });

  it('an over-cap save keeps its level but only counts 40 %', () => {
    const over = coins(500);
    expect(over.character.critLevel).toBe(500);
    expect(critFromLevel(500)).toBe(0.4);
    expect(critChance(over)).toBe(0.4);
    expect(upgradeMaxed(over, { type: 'crit' })).toBe(true);
    expect(buyCrit(over)).toBe(over);
  });

  it('item chance still adds on top of the capped upgrade', () => {
    expect(critChance(game(CRIT_MAX_LEVEL, [0.05, 0.03]))).toBeCloseTo(0.48);
    expect(critChance(game(500, [0.05]))).toBeCloseTo(0.45);
  });
});

describe('items with a crit stat', () => {
  it('S items can roll it within the tier range, with the usual stat count', () => {
    let seen = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const it = rollItem({ state: seed }, 1, 1, 1, 0, { tier: 'S', slot: 'ring' });
      expect(Object.keys(it.stats)).toHaveLength(ITEMS.statCount.S);
      if (it.stats.crit !== undefined) {
        seen++;
        expect(it.stats.crit).toBeGreaterThanOrEqual(0.04 * ITEMS.roll.min - 1e-9);
        expect(it.stats.crit).toBeLessThanOrEqual(0.04 * ITEMS.roll.max + 1e-9);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('a C item sometimes rolls crit as its single stat', () => {
    const stats = new Set<string>();
    for (let seed = 1; seed <= 80; seed++) {
      const it = rollItem({ state: seed }, 1, 1, 1, 0, { tier: 'C' });
      for (const k of Object.keys(it.stats)) stats.add(k);
    }
    expect(stats.has('crit')).toBe(true);
  });
});

describe('hero crits in combat', () => {
  const normal = seedWhere((r) => r >= 0.5);
  const lucky = seedWhere((r) => r < 0.1);

  it('a roll under the chance is a crit: double damage, crit flag and sound', () => {
    const s = game(10, [], lucky);
    const { hit, s: after } = firstHeroHit(s);
    expect(hit.amount).toBe(critDamage(heroDamage(s)));
    expect(hit).toMatchObject({ crit: true, target: 'mob' });
    expect(after.events).toContainEqual({ type: 'sfx', name: 'crit' });
    expect(after.events).not.toContainEqual({ type: 'sfx', name: 'hit' });
    expect(after.duel.mob.hp).toBe(Math.max(0, s.duel.mob.hp - hit.amount));
  });

  it('a roll at or over the chance is a normal hit', () => {
    const s = game(10, [], normal);
    const { hit, s: after } = firstHeroHit(s);
    expect(hit.amount).toBe(heroDamage(s));
    expect(hit.crit).toBeUndefined();
    expect(after.events).toContainEqual({ type: 'sfx', name: 'hit' });
    expect(after.events).not.toContainEqual({ type: 'sfx', name: 'crit' });
  });

  it('0 % never crits; at the 75 % cap a roll under 0.75 crits and one over does not', () => {
    for (let seed = 1; seed <= 40; seed++) {
      expect(firstHeroHit(game(0, [], seed)).hit.crit).toBeUndefined();
    }
    const under = seedWhere((r) => r > 0.7 && r < 0.75);
    expect(firstHeroHit(game(500, [0.5], under)).hit.crit).toBe(true);
    const over = seedWhere((r) => r >= 0.75);
    expect(firstHeroHit(game(500, [0.5], over)).hit.crit).toBeUndefined();
  });

  it('item crit counts: the same roll crits with a ring and not without', () => {
    const roll = seedWhere((r) => r > 0.02 && r < 0.04);
    expect(firstHeroHit(game(0, [], roll)).hit.crit).toBeUndefined();
    expect(firstHeroHit(game(0, [0.05], roll)).hit.crit).toBe(true);
  });

  it('the same seed gives the same fight, and every hit advances the RNG', () => {
    const a = firstHeroHit(game(10, [], 1234));
    const b = firstHeroHit(game(10, [], 1234));
    expect(a.hit).toEqual(b.hit);
    expect(a.s.critRng).toBe(b.s.critRng);
    expect(a.s.critRng).not.toBe(1234);
    // Even at 0 % the stream moves, so it doesn't depend on the chance.
    expect(firstHeroHit(game(0, [], 1234)).s.critRng).toBe(a.s.critRng);
  });

  it('a loaded game gets its crit seed from the drop seed (deterministic)', () => {
    const p = { ...newProgress(), items: newGear(99) };
    expect(createState(p).critRng).toBe(createState(p).critRng);
    expect(createState(p).critRng).not.toBe(createState({ ...p, items: newGear(100) }).critRng);
  });
});

describe('crit chance upgrade', () => {
  const withCoins = (coins: number) => createState({ ...newProgress(), coins });

  it('needs enough coins, else returns the same state', () => {
    const s = withCoins(CHARACTER.crit.base - 1);
    expect(buyCrit(s)).toBe(s);
  });

  it('pays the cost, raises the level and the chance', () => {
    const s = withCoins(1000);
    const t = buyCrit(s);
    expect(t.coins).toBe(1000 - characterCost('crit', 0));
    expect(t.character).toEqual({ defenceLevel: 0, critLevel: 1, hpLevel: 0, manaLevel: 0 });
    expect(critChance(t)).toBe(0.01);
    expect(s.character.critLevel).toBe(0);
    expect(t.events).toEqual([{ type: 'sfx', name: 'purchase' }, { type: 'save' }]);
    expect(buyCrit(t).coins).toBe(t.coins - characterCost('crit', 1));
  });

  it('buys in bulk at the same total price as single buys', () => {
    const s = withCoins(1_000_000);
    let singles = s;
    for (let i = 0; i < 10; i++) singles = buyCrit(singles);
    const q = upgradeQuote(s, { type: 'crit' }, 10);
    expect(q.levels).toBe(10);
    const bulk = buyUpgrades(s, { type: 'crit' }, 10);
    expect(bulk.character.critLevel).toBe(10);
    expect(bulk.coins).toBe(singles.coins);
    expect(s.coins - bulk.coins).toBe(q.cost);
  });

  it('MAX buys as many levels as the coins pay for, and leaves defence alone', () => {
    const s = withCoins(5000);
    const t = buyUpgrades(s, { type: 'crit' }, 'max');
    expect(t.character.critLevel).toBeGreaterThan(1);
    expect(t.character.defenceLevel).toBe(0);
    expect(t.coins).toBeGreaterThanOrEqual(0);
    expect(t.coins).toBeLessThan(characterCost('crit', t.character.critLevel));
  });
});
