import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import { encodeSave, decodeSave, migrateSave, toSaveData, validateSaveData } from '../save';
import { ascendFree } from './ascend';
import {
  ITEM_SLOTS,
  ITEMS,
  itemSellPrice,
  stageLevel,
  WORLD_REWARD,
  worldRewardFor,
} from './balance';
import {
  forceNextDrop,
  grantWorldReward,
  newGear,
  onKill,
  rollWorldReward,
  type Item,
} from './items';
import {
  createState,
  newProgress,
  secToTicks,
  update,
  type GameEvent,
  type GameState,
} from './state';

const audio = { muted: false, track: 'a', musicVolume: 0.5, sfxVolume: 0.5 };

/** A state to run `onKill` on: events start empty. */
const at = (world: number, stage: number, over: Partial<GameState> = {}): GameState => ({
  ...createState({ ...newProgress(), world, stage, items: newGear(7) }),
  ...over,
  events: [],
});

const rewardEvents = (s: GameState) =>
  s.events.filter(
    (e): e is Extract<GameEvent, { type: 'item' }> => e.type === 'item' && !!e.reward,
  );

const filler = (i: number): Item => ({
  id: 100 + i,
  slot: 'ring',
  tier: 'C',
  world: 1,
  stage: 1,
  stats: { damage: 1 },
});

describe('world 3 reward', () => {
  it('is a tier S item for world 3', () => {
    expect(WORLD_REWARD).toEqual({ world: 3, tier: 'S' });
  });

  it('the first kill of the world 3 boss gives one tier S item in the bag, with a reward toast', () => {
    const s = at(3, 6);
    onKill(s, 3, 6);
    const [e] = rewardEvents(s);
    expect(e).toBeDefined();
    expect(e.reward).toBe(3);
    expect(e.item.tier).toBe('S');
    expect(e.soldFor).toBe(0);
    expect(s.items.bag).toContain(e.item);
    expect(s.worldReward).toBe(3);
    expect(s.bestItem).toEqual(e.item);
    // The S drop sound plays.
    expect(s.events).toContainEqual({ type: 'sfx', name: 'itemDropS' });
    expect(s.events).toContainEqual({ type: 'save' });
  });

  it('is repeatable: the same drop seed gives the same item, and the stats are the normal S roll', () => {
    const a = rollWorldReward(newGear(42), 3, 6).item!;
    const b = rollWorldReward(newGear(42), 3, 6).item!;
    expect(a).toEqual(b);
    expect(ITEM_SLOTS).toContain(a.slot);
    expect(a).toMatchObject({ tier: 'S', world: 3, stage: 6 });
    expect(Object.keys(a.stats)).toHaveLength(ITEMS.statCount.S);
    // Any seed gives S; over many seeds every slot comes up.
    const slots = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const it = rollWorldReward(newGear(seed), 3, 6).item!;
      expect(it.tier).toBe('S');
      slots.add(it.slot);
    }
    expect([...slots].sort()).toEqual([...ITEM_SLOTS].sort());
  });

  it('is given once per run: killing 3.6 again, or going back to it, gives nothing', () => {
    const s = at(3, 6);
    onKill(s, 3, 6);
    const bag = s.items.bag.length;
    s.events = [];
    onKill(s, 3, 6);
    expect(rewardEvents(s)).toHaveLength(0);
    expect(s.items.bag.length).toBeLessThanOrEqual(bag + 1); // a normal drop at most
    // Back from world 4 to 3.6 with the flag set: still nothing.
    const back = at(3, 6, { worldReward: 3, best: stageLevel(4, 2) });
    onKill(back, 3, 6);
    expect(rewardEvents(back)).toHaveLength(0);
  });

  it('only the world 3 boss counts: other bosses and other 3.x stages do not', () => {
    for (const [w, st] of [
      [1, 6],
      [2, 6],
      [4, 6],
      [3, 5],
      [3, 1],
    ]) {
      const s = at(w, st);
      onKill(s, w, st);
      expect(rewardEvents(s)).toHaveLength(0);
      expect(s.worldReward).toBe(0);
    }
  });

  it('comes from a real boss kill, after the normal drop', () => {
    let s = createState({
      ...newProgress(),
      world: 3,
      stage: 6,
      autoAdvance: false,
      weaponLevels: [100000, 0, 0, 0, 0],
      items: newGear(3),
    });
    forceNextDrop();
    const events: GameEvent[] = [];
    for (let i = 0; i < secToTicks(120) && s.worldReward === 0; i++) {
      s = update(s, TICK);
      events.push(...s.events);
    }
    expect(s.worldReward).toBe(3);
    const items = events.filter((e) => e.type === 'item');
    expect(items).toHaveLength(2); // the forced normal drop, then the reward
    expect(items[0].reward).toBeUndefined();
    expect(items[1].reward).toBe(3);
  });

  it('an ascend resets it: the next run gets the reward again', () => {
    const s = at(3, 6);
    onKill(s, 3, 6);
    expect(s.worldReward).toBe(3);
    const next = ascendFree(s);
    expect(next.worldReward).toBe(0);
    const again = { ...next, world: 3, stage: 6, events: [] as GameState['events'] };
    onKill(again, 3, 6);
    expect(rewardEvents(again)).toHaveLength(1);
    // The items from the first run stay.
    expect(again.items.bag.length).toBeGreaterThanOrEqual(2);
  });

  it('a full bag sells the reward at once like a drop: coins and a toast, nothing lost silently', () => {
    const bag = Array.from({ length: ITEMS.inventorySize }, (_, i) => filler(i));
    const s = at(3, 6, { items: { ...newGear(7), bag }, coins: 10 });
    onKill(s, 3, 6);
    const [e] = rewardEvents(s);
    expect(e.item.tier).toBe('S');
    expect(e.soldFor).toBe(itemSellPrice(e.item.world, e.item.stage, 'S'));
    expect(e.soldFor).toBeGreaterThan(0);
    expect(s.items.bag).toHaveLength(ITEMS.inventorySize);
    expect(s.items.bag).not.toContain(e.item);
    expect(s.coins).toBeGreaterThanOrEqual(10 + e.soldFor);
    // Still counts as given, and as the best item.
    expect(s.worldReward).toBe(3);
    expect(s.bestItem).toEqual(e.item);
  });

  it('the debugger gives it again, even when it was given before', () => {
    const s = at(3, 6, { worldReward: 3 });
    const next = grantWorldReward(s);
    const [e] = rewardEvents(next);
    expect(e.item.tier).toBe('S');
    expect(next.items.bag).toHaveLength(1);
    expect(s.items.bag).toHaveLength(0); // the old state is untouched
    expect(next.worldReward).toBe(3);
  });
});

describe('world reward in the save', () => {
  it('round-trips through a save string', () => {
    const s = at(3, 6);
    onKill(s, 3, 6);
    const d = decodeSave(encodeSave(toSaveData(s, audio, '0.6.0')));
    expect(d.ok).toBe(true);
    if (d.ok) expect(d.progress.worldReward).toBe(3);
  });

  it('is required and must be a whole number', () => {
    const base = JSON.parse(JSON.stringify(toSaveData(createState(), audio, '0.6.0')));
    expect(validateSaveData(base).ok).toBe(true);
    expect(validateSaveData({ ...base, worldReward: -1 }).ok).toBe(false);
    expect(validateSaveData({ ...base, worldReward: 'x' }).ok).toBe(false);
    const { worldReward: _gone, ...without } = base;
    expect(validateSaveData(without).ok).toBe(false);
  });

  it('old saves past world 3 do not get a surprise reward; the others still can', () => {
    expect(worldRewardFor(stageLevel(4, 1))).toBe(3);
    expect(worldRewardFor(stageLevel(6, 1))).toBe(3);
    expect(worldRewardFor(stageLevel(3, 6))).toBe(0); // at the boss, not yet killed
    expect(worldRewardFor(1)).toBe(0);
    expect(migrateSave({ version: 10, best: stageLevel(5, 2) }).worldReward).toBe(3);
    expect(migrateSave({ version: 10, best: stageLevel(3, 6) }).worldReward).toBe(0);
    expect(migrateSave({ version: 9, best: 40 }).worldReward).toBe(3);
  });
});
