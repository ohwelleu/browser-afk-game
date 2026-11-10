import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import {
  ITEM_SLOTS,
  ITEM_STATS,
  ITEM_TIER_LABEL,
  ITEM_TIERS,
  ITEMS,
  dropChance,
  itemRarityWeights,
  itemSellPrice,
  itemStatValue,
  mobCoins,
  type ItemSlot,
  type ItemTier,
} from './balance';
import {
  bestOwnedItem,
  betterItem,
  compareItems,
  equipItem,
  forceNextDrop,
  gearTotals,
  itemValue,
  mobHitDamage,
  newGear,
  onKill,
  rollDrop,
  rollItem,
  sellItem,
  unequipItem,
  type Gear,
  type Item,
} from './items';
import { nextFloat, pickWeighted } from './rng';
import {
  createState,
  heroDamage,
  newProgress,
  secToTicks,
  update,
  type GameEvent,
  type GameState,
} from './state';

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
    expect(itemRarityWeights(0)).toEqual({ C: 70, B: 22, A: 7, S: 1, SS: 0.05 });
    expect(itemRarityWeights(1)).toEqual({ C: 70, B: 44, A: 14, S: 2, SS: 0.1 });
  });

  it('S+ (id SS) is exactly 2× S for every stat, level and roll, with the same stat lines', () => {
    for (const stat of ITEM_STATS)
      for (const L of [1, 2, 7, 14, 40, 100])
        for (const roll of [0.8, 0.93, 1, 1.07, 1.2])
          expect(itemStatValue(stat, L, 'SS', roll)).toBe(itemStatValue(stat, L, 'S', roll) * 2);
    expect(ITEMS.statCount.SS).toBe(ITEMS.statCount.S);
    expect(ITEM_TIER_LABEL.SS).toBe('S+');
  });

  it('S+ is much rarer than S and sells for 2× S', () => {
    for (const find of [0, 1, 5]) {
      const w = itemRarityWeights(find);
      expect(w.SS).toBeGreaterThan(0);
      expect(w.SS).toBeLessThanOrEqual(w.S / 10);
    }
    expect(itemSellPrice(3, 4, 'SS')).toBe(itemSellPrice(3, 4, 'S') * 2);
  });

  it('sell price = mobCoins × 5 × tierMult', () => {
    expect(itemSellPrice(2, 1, 'C')).toBe(mobCoins(2, 1) * 5);
    expect(itemSellPrice(1, 1, 'B')).toBe(Math.floor(mobCoins(1, 1) * 5 * 1.3));
  });
});

describe('rollItem', () => {
  it('has exactly the four slots', () => {
    expect(ITEM_SLOTS).toEqual(['ring', 'pendant', 'earring', 'belt']);
  });

  it('earrings lean to crit and item find, belts to defence and damage', () => {
    const rng = { state: 5 };
    const share = (slot: ItemSlot, tier: ItemTier, stats: string[]) => {
      let hit = 0;
      let all = 0;
      for (let i = 0; i < 4000; i++) {
        const it = rollItem(rng, i, 1, 1, 0, { slot, tier });
        for (const k of Object.keys(it.stats)) {
          all++;
          if (stats.includes(k)) hit++;
        }
      }
      return hit / all;
    };
    // C has 1 stat: weight 3+3 of 9 = 67 % (a uniform slot would give 40 %).
    expect(share('earring', 'C', ['crit', 'itemFind'])).toBeCloseTo(0.667, 1);
    expect(share('belt', 'C', ['defence', 'damage'])).toBeCloseTo(0.667, 1);
    expect(share('ring', 'C', ['crit', 'itemFind'])).toBeCloseTo(0.4, 1);
    expect(share('pendant', 'C', ['defence', 'damage'])).toBeCloseTo(0.4, 1);
    // S has 4 of 5 stats: the favoured pair is nearly always both there (60 % if uniform).
    let both = 0;
    for (let i = 0; i < 2000; i++) {
      const st = rollItem(rng, i, 1, 1, 0, { slot: 'earring', tier: 'S' }).stats;
      if (st.crit !== undefined && st.itemFind !== undefined) both++;
    }
    expect(both / 2000).toBeGreaterThan(0.75);
    for (const slot of ['earring', 'belt'] as const) {
      for (let i = 0; i < 200; i++) {
        const it = rollItem(rng, i, 1, 1, 0, { slot, tier: 'SS' });
        expect(Object.keys(it.stats)).toHaveLength(4);
      }
    }
  });

  it('earring and belt use the same tier multipliers as every other slot', () => {
    for (const slot of ['earring', 'belt'] as const) {
      for (const tier of ITEM_TIERS) {
        const it = rollItem({ state: 3 }, 1, 2, 3, 0, { slot, tier });
        expect(it.slot).toBe(slot);
        for (const k of Object.keys(it.stats) as (keyof Item['stats'])[]) {
          expect(it.stats[k]).toBeGreaterThanOrEqual(itemStatValue(k, 8, tier, 0.8));
          expect(it.stats[k]).toBeLessThanOrEqual(itemStatValue(k, 8, tier, 1.2));
        }
      }
    }
  });

  it('has 1/2/3/4/4 distinct stats for C/B/A/S/S+, each in the roll range', () => {
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

  it('rolls rarity 70/22/7/1 and the four slots 25 % each', () => {
    const rng = { state: 2 };
    const n: Record<string, number> = { C: 0, B: 0, A: 0, S: 0, SS: 0 };
    const slots: Record<ItemSlot, number> = { ring: 0, pendant: 0, earring: 0, belt: 0 };
    const N = 40_000;
    for (let i = 0; i < N; i++) {
      const it = rollItem(rng, i, 1, 1, 0);
      n[it.tier]++;
      slots[it.slot]++;
    }
    expect(n.C / N).toBeCloseTo(0.7, 1);
    expect(n.B / N).toBeCloseTo(0.22, 1);
    expect(n.A / N).toBeCloseTo(0.07, 1);
    expect(n.S / N).toBeGreaterThan(0.005);
    expect(n.S / N).toBeLessThan(0.015);
    for (const slot of ITEM_SLOTS) expect(slots[slot] / N).toBeCloseTo(0.25, 1);
    expect(n.SS).toBeLessThan(n.S); // S+ is rarer than S (about 1 in 2000)
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

  it('drops 0.5 % on normal mobs and 3 % on bosses (outside the early boost)', () => {
    expect(dropRate(5)).toBeCloseTo(0.005, 3);
    expect(dropRate(6)).toBeCloseTo(0.03, 2);
  });

  it('mob drops are boosted early in world 1 and fade to 0.5 % by stage 5', () => {
    const chances = [1, 2, 3, 4, 5].map((st) => dropChance(1, st));
    expect(chances[0]).toBe(ITEMS.earlyDrop.mob);
    expect(chances[4]).toBe(ITEMS.dropChance.mob);
    for (let i = 1; i < chances.length; i++) expect(chances[i]).toBeLessThan(chances[i - 1]);
    expect(1 / chances[0]).toBeLessThan(40); // first item at stage 1.1 in well under 40 kills
    expect(dropRate(1, 100_000)).toBeCloseTo(ITEMS.earlyDrop.mob, 2);
  });

  it('later drops are unchanged: late world 1, later worlds, and bosses', () => {
    expect(dropChance(1, 5)).toBe(0.005);
    expect(dropChance(1, 6)).toBe(0.03);
    for (const world of [2, 3, 10]) {
      for (const stage of [1, 2, 3, 4, 5]) expect(dropChance(world, stage)).toBe(0.005);
      expect(dropChance(world, 6)).toBe(0.03);
    }
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
  it('sums all four slots and caps speed and item find', () => {
    const g: Gear = {
      ...newGear(0),
      ring: item({ stats: { damage: 3, speed: 0.2, itemFind: 0.6 } }),
      pendant: item({ slot: 'pendant', stats: { defence: 2, speed: 0.2, itemFind: 0.6 } }),
    };
    expect(gearTotals(g)).toEqual({ crit: 0, damage: 3, defence: 2, speed: 0.25, itemFind: 1 });
  });

  it('counts the earring and the belt', () => {
    const g: Gear = {
      ...newGear(0),
      ring: item({ stats: { damage: 3 } }),
      earring: item({ id: 3, slot: 'earring', stats: { crit: 0.03, itemFind: 0.4 } }),
      belt: item({ id: 4, slot: 'belt', stats: { defence: 5, damage: 4, itemFind: 0.9 } }),
    };
    const t = gearTotals(g);
    expect(t).toMatchObject({ damage: 7, defence: 5, crit: 0.03, speed: 0 });
    expect(t.itemFind).toBe(1); // 1.3 capped
  });

  it('a mob hit never goes below 1', () => {
    expect(mobHitDamage(100, 25)).toBe(80);
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

  it('earring and belt each have their own slot, one item at a time', () => {
    const e1 = item({ id: 1, slot: 'earring' });
    const e2 = item({ id: 2, slot: 'earring' });
    const b = item({ id: 3, slot: 'belt' });
    const r = item({ id: 4 });
    let s = withBag([e1, e2, b, r]);
    for (const id of [1, 3, 4]) s = equipItem(s, id);
    expect([s.items.earring, s.items.belt, s.items.ring]).toEqual([e1, b, r]);
    expect(s.items.pendant).toBeNull();
    s = equipItem(s, 2); // swaps with e1
    expect(s.items.earring).toBe(e2);
    expect(s.items.bag).toEqual([e1]);
    s = unequipItem(s, 'belt');
    expect(s.items.belt).toBeNull();
    expect(s.items.bag).toEqual([e1, b]);
    expect(unequipItem(s, 'belt')).toBe(s);
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
    expect(amount(def)).toBe(Math.floor((amount(plain) * 100) / 103));
    expect(amount(def)).toBeLessThan(amount(plain));
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

describe('best item', () => {
  const mk = (tier: Item['tier'], stats: Item['stats'], id = 1): Item => ({
    id,
    slot: 'ring',
    tier,
    world: 1,
    stage: 1,
    stats,
  });

  it('ranks by tier first, then by total stat value (% stats in percent points)', () => {
    expect(compareItems(mk('A', { damage: 1 }), mk('B', { damage: 999 }))).toBeGreaterThan(0);
    expect(compareItems(mk('SS', { damage: 1 }), mk('S', { damage: 999 }))).toBeGreaterThan(0);
    expect(compareItems(mk('B', { damage: 5 }), mk('B', { damage: 4 }))).toBeGreaterThan(0);
    // +5 % crit = 5 points, which beats 4 flat damage.
    expect(itemValue(mk('B', { crit: 0.05 }))).toBe(5);
    expect(compareItems(mk('B', { crit: 0.05 }), mk('B', { damage: 4 }))).toBeGreaterThan(0);
  });

  it('betterItem keeps the first on a tie and ignores a missing one', () => {
    const a = mk('B', { damage: 5 }, 1);
    const b = mk('B', { damage: 5 }, 2);
    expect(betterItem(a, b)).toBe(a);
    expect(betterItem(null, b)).toBe(b);
    expect(betterItem(a, null)).toBe(a);
    expect(betterItem(null, null)).toBeNull();
    expect(betterItem(a, mk('A', { damage: 1 }, 3))?.id).toBe(3);
  });

  it('bestOwnedItem looks at worn items and the bag', () => {
    const g = {
      ...newGear(1),
      ring: mk('C', { damage: 1 }, 1),
      bag: [mk('A', { damage: 1 }, 2), mk('B', { damage: 9 }, 3)],
    };
    expect(bestOwnedItem(g)?.id).toBe(2);
    expect(bestOwnedItem(newGear(1))).toBeNull();
  });

  it('a drop is remembered as the best item, even when the bag is full and it is sold at once', () => {
    let s = createState();
    s = {
      ...s,
      items: {
        ...s.items,
        bag: Array.from({ length: ITEMS.inventorySize }, (_, i) => mk('C', { damage: 1 }, 100 + i)),
      },
    };
    forceNextDrop();
    const draft = { ...s, events: [] as GameState['events'] };
    onKill(draft, 1, 1);
    expect(draft.bestItem).not.toBeNull();
    expect(draft.items.bag).toHaveLength(ITEMS.inventorySize);
  });
});
