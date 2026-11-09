/**
 * Items: ring and pendant (docs/design/active-play.md → 2. Items). Pure, like
 * the rest of `game/`: every function returns new objects and all randomness
 * comes from the seeded RNG stored in `Gear.rng`.
 */
import {
  defendedDamage,
  dropChance,
  ITEM_STATS,
  ITEMS,
  itemRarityWeights,
  itemSellPrice,
  itemStatValue,
  ITEM_TIERS,
  stageLevel,
  safeInt,
  type ItemSlot,
  type ItemStat,
  type ItemTier,
} from './balance';
import { revealWeapons } from './reveal';
import { nextFloat, pickWeighted, randomSeed, type Rng } from './rng';
import type { GameState } from './state';

export type Item = {
  id: number;
  slot: ItemSlot;
  tier: ItemTier;
  /** Where it dropped: sets the item level and the sell price. */
  world: number;
  stage: number;
  /** One entry per stat the item has; never duplicates. */
  stats: Partial<Record<ItemStat, number>>;
};

export type Gear = {
  ring: Item | null;
  pendant: Item | null;
  /** Unequipped items, oldest first. At most `ITEMS.inventorySize`. */
  bag: Item[];
  /** RNG state for drops (uint32). */
  rng: number;
  nextId: number;
};

export type GearTotals = Record<ItemStat, number>;

export function newGear(seed: number = randomSeed()): Gear {
  return { ring: null, pendant: null, bag: [], rng: seed >>> 0, nextId: 1 };
}

/**
 * Sum of both equipped items, with the speed and item find caps applied.
 * `crit` is the raw item sum: use `critChance` (state.ts) for the capped total.
 */
export function gearTotals(g: Gear | undefined): GearTotals {
  const t: GearTotals = { damage: 0, defence: 0, speed: 0, itemFind: 0, crit: 0 };
  if (!g) return t;
  for (const item of [g.ring, g.pendant]) {
    if (!item) continue;
    for (const stat of ITEM_STATS) t[stat] += item.stats[stat] ?? 0;
  }
  t.speed = Math.min(ITEMS.caps.speed, t.speed);
  t.itemFind = Math.min(ITEMS.caps.itemFind, t.itemFind);
  return t;
}

/**
 * Rolls a new item (tier, slot, stats) dropped on `world.stage`. `pick`
 * fixes the slot and/or tier (debugger "Give item"); the stats still roll.
 */
export function rollItem(
  rng: Rng,
  id: number,
  world: number,
  stage: number,
  itemFind: number,
  pick: { slot?: ItemSlot; tier?: ItemTier } = {},
): Item {
  const tier = pick.tier ?? pickWeighted(rng, itemRarityWeights(itemFind));
  const slot: ItemSlot = pick.slot ?? (nextFloat(rng) < 0.5 ? 'ring' : 'pendant');
  // Draw `statCount` stats without replacement.
  const pool = [...ITEM_STATS];
  const L = stageLevel(world, stage);
  const { min, max } = ITEMS.roll;
  const stats: Item['stats'] = {};
  for (let n = 0; n < ITEMS.statCount[tier] && pool.length; n++) {
    const stat = pool.splice(Math.floor(nextFloat(rng) * pool.length), 1)[0];
    stats[stat] = itemStatValue(stat, L, tier, min + (max - min) * nextFloat(rng));
  }
  return { id, slot, tier, world, stage, stats };
}

export type DropResult = { gear: Gear; item: Item | null; soldFor: number };

/**
 * Drop roll for one kill on `world.stage`. A full bag sells the new item at
 * once (`soldFor` > 0). The RNG always advances, even when nothing drops.
 */
export function rollDrop(g: Gear, world: number, stage: number, force = false): DropResult {
  const rng: Rng = { state: g.rng };
  const chance = dropChance(world, stage);
  if (nextFloat(rng) >= chance && !force)
    return { gear: { ...g, rng: rng.state }, item: null, soldFor: 0 };
  const item = rollItem(rng, g.nextId, world, stage, gearTotals(g).itemFind);
  const base = { ...g, rng: rng.state, nextId: g.nextId + 1 };
  if (g.bag.length >= ITEMS.inventorySize) {
    return { gear: base, item, soldFor: itemSellPrice(item.world, item.stage, item.tier) };
  }
  return { gear: { ...base, bag: [...g.bag, item] }, item, soldFor: 0 };
}

export const sellPrice = (item: Item): number => itemSellPrice(item.world, item.stage, item.tier);

// ── Best item ──────────────────────────────────────────────────────────────

/**
 * Total stat value of an item: flat stats as they are, % stats in percent
 * points (0.02 → 2). Only used to order items of the same tier.
 */
export function itemValue(item: Item): number {
  let total = 0;
  for (const stat of ITEM_STATS) {
    const v = item.stats[stat] ?? 0;
    total += ITEMS.stats[stat].flat ? v : v * 100;
  }
  return total;
}

/** Order of two items: higher tier first, then higher total stat value. > 0 when `a` is better. */
export function compareItems(a: Item, b: Item): number {
  return ITEM_TIERS.indexOf(a.tier) - ITEM_TIERS.indexOf(b.tier) || itemValue(a) - itemValue(b);
}

/** The better of two items; `a` wins a tie (and a missing `b`). */
export function betterItem(a: Item | null, b: Item | null): Item | null {
  if (!a || !b) return a ?? b;
  return compareItems(b, a) > 0 ? b : a;
}

/** The best item among those worn and in the bag, or null when there are none. */
export function bestOwnedItem(g: Gear): Item | null {
  return [g.ring, g.pendant, ...g.bag].reduce<Item | null>(
    (best, it) => betterItem(best, it),
    null,
  );
}

// ── Game state hooks ───────────────────────────────────────────────────────

let forcedDrop = false;

/** Debugger hook: the next kill always drops an item. */
export function forceNextDrop(on = true): void {
  forcedDrop = on;
}

/** Called by `combat` on a kill: rolls the drop and reports it as an event. */
export function onKill(s: GameState, world: number, stage: number): void {
  const r = rollDrop(s.items, world, stage, forcedDrop);
  forcedDrop = false;
  s.items = r.gear;
  if (!r.item) return;
  s.bestItem = betterItem(s.bestItem, r.item); // also counts a drop that was sold at once
  if (r.soldFor) s.coins = safeInt(s.coins + r.soldFor);
  s.events.push(
    { type: 'item', item: r.item, soldFor: r.soldFor },
    { type: 'sfx', name: r.item.tier === 'S' || r.item.tier === 'SS' ? 'itemDropS' : 'itemDrop' },
    { type: 'save' },
  );
}

/** Mob hit after the hero's defence: see `defendedDamage` (never below 1). */
export const mobHitDamage = defendedDamage;

// ── Actions (same contract as state.ts: unchanged state = not allowed) ─────

function withGear(s: GameState, items: Gear, coins = s.coins): GameState {
  const next = { ...s, items, coins, events: [{ type: 'save' }] as GameState['events'] };
  revealWeapons(next); // selling an item can bring a weapon within reach
  return next;
}

/** Equips an item from the bag; the item already in that slot goes back to the bag. */
export function equipItem(s: GameState, id: number): GameState {
  const g = s.items;
  const i = g.bag.findIndex((it) => it.id === id);
  if (i < 0) return s;
  const item = g.bag[i];
  const bag = g.bag.filter((_, j) => j !== i);
  const old = g[item.slot];
  if (old) bag.splice(i, 0, old);
  return withGear(s, { ...g, bag, [item.slot]: item });
}

/** Moves the item in `slot` back to the bag (only if the bag has room). */
export function unequipItem(s: GameState, slot: ItemSlot): GameState {
  const g = s.items;
  const item = g[slot];
  if (!item || g.bag.length >= ITEMS.inventorySize) return s;
  return withGear(s, { ...g, bag: [...g.bag, item], [slot]: null });
}

/** Sells an item from the bag (equipped items have to be unequipped first). */
export function sellItem(s: GameState, id: number): GameState {
  const item = s.items.bag.find((it) => it.id === id);
  if (!item) return s;
  const bag = s.items.bag.filter((it) => it !== item);
  const next = withGear(s, { ...s.items, bag }, safeInt(s.coins + sellPrice(item)));
  next.events.unshift({ type: 'sfx', name: 'coin' });
  return next;
}
