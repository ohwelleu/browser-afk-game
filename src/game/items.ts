/**
 * Items: ring and pendant (docs/design/active-play.md → 2. Items). Pure, like
 * the rest of `game/`: every function returns new objects and all randomness
 * comes from the seeded RNG stored in `Gear.rng`.
 */
import {
  isBoss,
  ITEM_STATS,
  ITEMS,
  itemRarityWeights,
  itemSellPrice,
  itemStatValue,
  stageLevel,
  safeInt,
  type ItemSlot,
  type ItemStat,
  type ItemTier,
} from './balance';
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

/** Sum of both equipped items, with the speed and item find caps applied. */
export function gearTotals(g: Gear | undefined): GearTotals {
  const t: GearTotals = { damage: 0, defence: 0, speed: 0, itemFind: 0 };
  if (!g) return t;
  for (const item of [g.ring, g.pendant]) {
    if (!item) continue;
    for (const stat of ITEM_STATS) t[stat] += item.stats[stat] ?? 0;
  }
  t.speed = Math.min(ITEMS.caps.speed, t.speed);
  t.itemFind = Math.min(ITEMS.caps.itemFind, t.itemFind);
  return t;
}

/** Rolls a new item (tier, slot, stats) dropped on `world.stage`. */
export function rollItem(
  rng: Rng,
  id: number,
  world: number,
  stage: number,
  itemFind: number,
): Item {
  const tier = pickWeighted(rng, itemRarityWeights(itemFind));
  const slot: ItemSlot = nextFloat(rng) < 0.5 ? 'ring' : 'pendant';
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
export function rollDrop(g: Gear, world: number, stage: number): DropResult {
  const rng: Rng = { state: g.rng };
  const chance = isBoss(stage) ? ITEMS.dropChance.boss : ITEMS.dropChance.mob;
  if (nextFloat(rng) >= chance) return { gear: { ...g, rng: rng.state }, item: null, soldFor: 0 };
  const item = rollItem(rng, g.nextId, world, stage, gearTotals(g).itemFind);
  const base = { ...g, rng: rng.state, nextId: g.nextId + 1 };
  if (g.bag.length >= ITEMS.inventorySize) {
    return { gear: base, item, soldFor: itemSellPrice(item.world, item.stage, item.tier) };
  }
  return { gear: { ...base, bag: [...g.bag, item] }, item, soldFor: 0 };
}

export const sellPrice = (item: Item): number => itemSellPrice(item.world, item.stage, item.tier);

// ── Game state hooks ───────────────────────────────────────────────────────

/** Called by `combat` on a kill: rolls the drop and reports it as an event. */
export function onKill(s: GameState, world: number, stage: number): void {
  const r = rollDrop(s.items, world, stage);
  s.items = r.gear;
  if (!r.item) return;
  if (r.soldFor) s.coins = safeInt(s.coins + r.soldFor);
  s.events.push(
    { type: 'item', item: r.item, soldFor: r.soldFor },
    { type: 'sfx', name: r.item.tier === 'S' ? 'itemDropS' : 'itemDrop' },
    { type: 'save' },
  );
}

/** Mob hit after the hero's defence: never below 1. */
export const mobHitDamage = (raw: number, defence: number): number =>
  Math.max(1, safeInt(raw - defence));

// ── Actions (same contract as state.ts: unchanged state = not allowed) ─────

function withGear(s: GameState, items: Gear, coins = s.coins): GameState {
  return { ...s, items, coins, events: [{ type: 'save' }] };
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
