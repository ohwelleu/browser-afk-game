import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import {
  ITEM_TIERS,
  ITEMS,
  itemRarityWeights,
  itemSellPrice,
  itemStatValue,
  mobCoins,
  type ItemTier,
} from './balance';
import {
  equipItem,
  gearTotals,
  mobHitDamage,
  newGear,
  rollDrop,
  rollItem,
  sellItem,
  unequipItem,
  type Gear,
  type Item,
} from './items';
import { nextFloat, pickWeighted } from './rng';
import { createState, heroDamage, newProgress, secToTicks, update, type GameEvent } from './state';

const item = (p: Partial<Item> = {}): Item => ({
  id: 1,
  slot: 'ring',
  tier: 'C',
  world: 1,
  stage: 1,
  stats: { damage: 1 },
  ...p,
});

describe('rng', () => {
  it('is reproducible from a seed and stays in [0, 1)', () => {
    const a = { state: 123 };
    const b = { state: 123 };
    const xs = Array.from({ length: 1000 }, () => nextFloat(a));
    expect(Array.from({ length: 1000 }, () => nextFloat(b))).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(xs).size).toBe(1000);
  });

  it('pickWeighted follows the weights', () => {
    const rng = { state: 9 };
    const n = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) n[pickWeighted(rng, { a: 1, b: 3 })]++;
    expect(n.b / 10_000).toBeCloseTo(0.75, 1);
  });
});

describe('item balance', () => {
  it('statValue = base × growth^(L−1) × tierMult × roll, flat rounds down with min 1', () => {
    expect(itemStatValue('damage', 1, 'C', 1)).toBe(1);
    expect(itemStatValue('damage', 1, 'S', 1)).toBe(2);
    expect(itemStatValue('damage', 5, 'C', 1)).toBe(2); // 1.25^4 ≈ 2.44
    expect(itemStatValue('damage', 7, 'C', 1.2)).toBe(4); // 1.25^6 × 1.2 ≈ 4.58
    expect(itemStatValue('defence', 1, 'C', 0.8)).toBe(1); // 0.24 → min 1
    expect(itemStatValue('defence', 40, 'S', 1)).toBe(4); // 0.3 × 1.05^39 × 2 ≈ 4.03
  });

  it('% stats scale by tier only, not by stage', () => {
    expect(itemStatValue('speed', 1, 'C', 1)).toBe(0.02);
    expect(itemStatValue('speed', 30, 'S', 1)).toBe(0.04);
    expect(itemStatValue('itemFind', 9, 'B', 1)).toBe(0.065);
  });

  it('item find raises B/A/S weights only', () => {
    expect(itemRarityWeights(0)).toEqual({ C: 70, B: 22, A: 7, S: 1 });
    expect(itemRarityWeights(1)).toEqual({ C: 70, B: 44, A: 14, S: 2 });
  });

  it('sell price = mobCoins × 5 × tierMult', () => {
    expect(itemSellPrice(2, 1, 'C')).toBe(mobCoins(2, 1) * 5);
    expect(itemSellPrice(1, 1, 'B')).toBe(Math.floor(mobCoins(1, 1) * 5 * 1.3));
  });
});

describe('rollItem', () => {
  it('has 1/2/3/4 distinct stats for C/B/A/S, each in the roll range', () => {
    const rng = { state: 1 };
    const seen = new Set<ItemTier>();
    for (let i = 0; i < 3000; i++) {
      const it = rollItem(rng, i, 3, 2, 50); // huge item find so all tiers show up
      seen.add(it.tier);
      const keys = Object.keys(it.stats);
      expect(keys.length).toBe(ITEMS.statCount[it.tier]);
      expect(new Set(keys).size).toBe(keys.length);
      const L = 14;
      for (const k of keys as (keyof Item['stats'])[]) {
        expect(it.stats[k]).toBeGreaterThanOrEqual(itemStatValue(k, L, it.tier, 0.8));
        expect(it.stats[k]).toBeLessThanOrEqual(itemStatValue(k, L, it.tier, 1.2));
      }
    }
    expect([...seen].sort()).toEqual([...ITEM_TIERS].sort());
  });

  it('rolls rarity 70/22/7/1 and ring/pendant 50/50', () => {
    const rng = { state: 2 };
    const n: Record<string, number> = { C: 0, B: 0, A: 0, S: 0, ring: 0 };
    const N = 40_000;
    for (let i = 0; i < N; i++) {
      const it = rollItem(rng, i, 1, 1, 0);
      n[it.tier]++;
      if (it.slot === 'ring') n.ring++;
    }
    expect(n.C / N).toBeCloseTo(0.7, 1);
    expect(n.B / N).toBeCloseTo(0.22, 1);
    expect(n.A / N).toBeCloseTo(0.07, 1);
    expect(n.S / N).toBeGreaterThan(0.005);
    expect(n.S / N).toBeLessThan(0.015);
    expect(n.ring / N).toBeCloseTo(0.5, 1);
  });
});

describe('rollDrop', () => {
  const dropRate = (stage: number, N = 100_000) => {
    let g = newGear(5);
    let drops = 0;
    for (let i = 0; i < N; i++) {
      const r = rollDrop({ ...g, bag: [] }, 1, stage);
      g = r.gear;
      if (r.item) drops++;
    }
    return drops / N;
  };

  it('drops 0.5 % on normal mobs and 3 % on bosses', () => {
    expect(dropRate(1)).toBeCloseTo(0.005, 3);
    expect(dropRate(6)).toBeCloseTo(0.03, 2);
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      let g = newGear(77);
      for (let i = 0; i < 5000; i++) g = rollDrop(g, 2, 6).gear;
      return g;
    };
    expect(run()).toEqual(run());
  });

  it('auto-sells when the bag is full', () => {
    const full: Gear = {
      ...newGear(0),
      bag: Array.from({ length: ITEMS.inventorySize }, (_, i) => item({ id: i + 1 })),
      nextId: 21,
    };
    let r = rollDrop(full, 2, 6);
    while (!r.item) r = rollDrop(r.gear, 2, 6);
    expect(r.gear.bag).toBe(full.bag);
    expect(r.soldFor).toBe(itemSellPrice(2, 6, r.item!.tier));
  });
});

describe('gearTotals', () => {
  it('sums both slots and caps speed and item find', () => {
    const g: Gear = {
      ...newGear(0),
      ring: item({ stats: { damage: 3, speed: 0.2, itemFind: 0.6 } }),
      pendant: item({ slot: 'pendant', stats: { defence: 2, speed: 0.2, itemFind: 0.6 } }),
    };
    expect(gearTotals(g)).toEqual({ damage: 3, defence: 2, speed: 0.25, itemFind: 1 });
  });

  it('a mob hit never goes below 1', () => {
    expect(mobHitDamage(5, 2)).toBe(3);
    expect(mobHitDamage(2, 9)).toBe(1);
  });
});

describe('item actions', () => {
  const withBag = (bag: Item[], extra: Partial<Gear> = {}) =>
    createState({ ...newProgress(), items: { ...newGear(0), bag, nextId: 99, ...extra } });

  it('equip swaps with the item already in the slot', () => {
    const a = item({ id: 1 });
    const b = item({ id: 2 });
    let s = withBag([a, b]);
    s = equipItem(s, 1);
    expect(s.items.ring).toBe(a);
    s = equipItem(s, 2);
    expect(s.items.ring).toBe(b);
    expect(s.items.bag).toEqual([a]);
    expect(equipItem(s, 42)).toBe(s);
  });

  it('unequip needs room in the bag', () => {
    const full = Array.from({ length: ITEMS.inventorySize }, (_, i) => item({ id: i + 10 }));
    const s = withBag(full, { ring: item() });
    expect(unequipItem(s, 'ring')).toBe(s);
    const t = unequipItem(withBag([], { ring: item() }), 'ring');
    expect(t.items.ring).toBeNull();
    expect(t.items.bag.length).toBe(1);
  });

  it('sell pays the sell price', () => {
    const it = item({ world: 2, stage: 3, tier: 'A' });
    const s = sellItem(withBag([it]), 1);
    expect(s.coins).toBe(itemSellPrice(2, 3, 'A'));
    expect(s.items.bag).toEqual([]);
  });
});

describe('items in combat', () => {
  const run = (gear: Partial<Gear>, seconds: number, stage = 6) => {
    let s = createState({
      ...newProgress(),
      world: 3,
      stage,
      items: { ...newGear(0), ...gear },
    });
    const events: { tick: number; e: GameEvent }[] = [];
    for (let i = 0; i < secToTicks(seconds); i++) {
      s = update(s, TICK);
      for (const e of s.events) events.push({ tick: s.duel.tick, e });
    }
    return { s, events };
  };
  const hits = (events: { tick: number; e: GameEvent }[], target: string) =>
    events.filter((x) => x.e.type === 'damage' && x.e.target === target);

  it('flat damage adds to every hero hit', () => {
    const { events } = run({ ring: item({ stats: { damage: 5 } }) }, 2.5);
    const s = createState();
    expect(hits(events, 'mob').map((x) => (x.e as { amount: number }).amount)).toEqual([
      heroDamage(s) + 5,
    ]);
  });

  it('defence lowers each mob hit', () => {
    const plain = run({}, 2.6).events;
    const def = run({ pendant: item({ slot: 'pendant', stats: { defence: 3 } }) }, 2.6).events;
    const amount = (ev: typeof plain) => (hits(ev, 'hero')[0].e as { amount: number }).amount;
    expect(amount(def)).toBe(amount(plain) - 3);
  });

  it('speed shortens the hero attack interval', () => {
    const fast = run({ ring: item({ stats: { speed: 0.25 } }) }, 4.5).events;
    const ticks = hits(fast, 'mob').map((x) => x.tick);
    expect(ticks[1] - ticks[0]).toBe(secToTicks(1 / 1.25));
  });

  it('kills roll drops from the state RNG and report them', () => {
    // A strong hero farming 1.6 (boss, 3 %) with auto-advance off.
    let s = createState({
      ...newProgress(),
      stage: 6,
      autoAdvance: false,
      weaponLevels: [1000, 0, 0, 0, 0],
      items: newGear(3),
    });
    const drops: GameEvent[] = [];
    for (let i = 0; i < secToTicks(600) && drops.length < 3; i++) {
      s = update(s, TICK);
      drops.push(...s.events.filter((e) => e.type === 'item'));
    }
    expect(drops.length).toBe(3);
    expect(s.items.bag.length).toBe(3);
    expect(s.items.nextId).toBe(4);
  });
});
