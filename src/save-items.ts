/**
 * Save format for items (`items` in the save). Kept out of save.ts so other
 * save fields can change there without touching this.
 */
import { ITEM_SLOTS, ITEM_STATS, ITEM_TIERS, ITEMS, STAGES_PER_WORLD } from './game/balance';
import { newGear, type Gear, type Item } from './game/items';
import { randomSeed } from './game/rng';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const isUint32 = (v: unknown): v is number => isInt(v, 0) && v <= 0xffff_ffff;

/** Why `raw` isn't a valid item, or null when it is. */
function itemError(raw: unknown): string | null {
  if (!isObj(raw)) return 'must be an object';
  if (!isInt(raw.id, 1)) return 'id must be a whole number from 1';
  if (!ITEM_SLOTS.includes(raw.slot as never)) return `slot must be ${ITEM_SLOTS.join(' or ')}`;
  if (!ITEM_TIERS.includes(raw.tier as never)) return `tier must be ${ITEM_TIERS.join(', ')}`;
  if (!isInt(raw.world, 1)) return 'world must be a whole number from 1';
  if (!isInt(raw.stage, 1) || raw.stage > STAGES_PER_WORLD) {
    return `stage must be a whole number from 1 to ${STAGES_PER_WORLD}`;
  }
  if (!isObj(raw.stats)) return 'stats must be an object';
  const keys = Object.keys(raw.stats);
  if (keys.length !== ITEMS.statCount[raw.tier as Item['tier']]) {
    return `a ${raw.tier as string} item has ${ITEMS.statCount[raw.tier as Item['tier']]} stats`;
  }
  for (const k of keys) {
    const v = raw.stats[k];
    if (!ITEM_STATS.includes(k as never)) return `unknown stat "${k}"`;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      return `stats.${k} must be a number from 0`;
    }
  }
  return null;
}

const copyItem = (it: Item): Item => ({ ...it, stats: { ...it.stats } });

/**
 * Lenient load: bad items are dropped, a bad RNG gets a new seed. A missing
 * `items` (saves from before items, version 1) is a fresh, empty gear.
 */
export function loadGear(raw: unknown): Gear {
  if (!isObj(raw)) return newGear();
  const ok = (v: unknown): v is Item => itemError(v) === null;
  const seen = new Set<number>();
  const unique = (it: Item) => !seen.has(it.id) && !!seen.add(it.id);
  const slot = (s: Item['slot']): Item | null => {
    const v = raw[s];
    return ok(v) && v.slot === s && unique(v) ? copyItem(v) : null;
  };
  const ring = slot('ring');
  const pendant = slot('pendant');
  const bag = (Array.isArray(raw.bag) ? raw.bag : [])
    .filter(ok)
    .filter(unique)
    .slice(0, ITEMS.inventorySize)
    .map(copyItem);
  const maxId = Math.max(0, ...seen);
  return {
    ring,
    pendant,
    bag,
    rng: isUint32(raw.rng) ? raw.rng : randomSeed(),
    nextId: isInt(raw.nextId, maxId + 1) ? raw.nextId : maxId + 1,
  };
}

/** Strict check for the debugger: lists every problem, repairs nothing. */
export function validateGear(raw: unknown, errors: string[]): Gear | null {
  const before = errors.length;
  if (!isObj(raw)) {
    errors.push('items must be an object.');
    return null;
  }
  const ids = new Set<number>();
  const check = (where: string, v: unknown) => {
    const e = itemError(v);
    if (e) return errors.push(`${where}: ${e}.`);
    const id = (v as Item).id;
    if (ids.has(id)) errors.push(`${where}: id ${id} is used twice.`);
    ids.add(id);
  };
  for (const s of ITEM_SLOTS) {
    if (raw[s] === null) continue;
    check(`items.${s}`, raw[s]);
    if (isObj(raw[s]) && raw[s].slot !== s) errors.push(`items.${s} must hold a ${s}.`);
  }
  if (!Array.isArray(raw.bag) || raw.bag.length > ITEMS.inventorySize) {
    errors.push(`items.bag must be a list of up to ${ITEMS.inventorySize} items.`);
  } else {
    raw.bag.forEach((v, i) => check(`items.bag[${i}]`, v));
  }
  if (!isUint32(raw.rng)) errors.push('items.rng must be a whole number from 0 to 4294967295.');
  const maxId = Math.max(0, ...ids);
  if (!isInt(raw.nextId, maxId + 1)) {
    errors.push(`items.nextId must be a whole number above every item id (${maxId}).`);
  }
  if (errors.length > before) return null;
  return saveGear(raw as unknown as Gear);
}

export const saveGear = (g: Gear): Gear => ({
  ring: g.ring && copyItem(g.ring),
  pendant: g.pendant && copyItem(g.pendant),
  bag: g.bag.map(copyItem),
  rng: g.rng,
  nextId: g.nextId,
});
