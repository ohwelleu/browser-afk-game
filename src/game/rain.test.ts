import { describe, expect, it } from 'vitest';
import { ITEM_SLOTS } from './balance';
import { newGear, type Item } from './items';
import { capRain, rainLines, RAIN_MAX_LINES } from './rain';
import { createState, newProgress } from './state';

const item = (slot: Item['slot'], tier: Item['tier'], id = 1): Item => ({
  id,
  slot,
  tier,
  world: 1,
  stage: 1,
  stats: { damage: 1 },
});
const worn = (p: Partial<Record<Item['slot'], Item>>, bag: Item[] = []) =>
  createState({ ...newProgress(), items: { ...newGear(1), ...p, bag } });

describe('rainLines', () => {
  it('is empty with nothing equipped', () => {
    expect(rainLines(createState(newProgress()))).toEqual({ rainbow: 0, yellow: 0 });
  });

  it('gives one yellow line for one S item', () => {
    expect(rainLines(worn({ ring: item('ring', 'S') }))).toEqual({ rainbow: 0, yellow: 1 });
  });

  it('gives one rainbow line per S+ item (tier SS)', () => {
    const s = worn({ ring: item('ring', 'SS'), pendant: item('pendant', 'SS', 2) });
    expect(rainLines(s)).toEqual({ rainbow: 2, yellow: 0 });
  });

  it('counts both colours together', () => {
    const s = worn({ ring: item('ring', 'SS'), pendant: item('pendant', 'S', 2) });
    expect(rainLines(s)).toEqual({ rainbow: 1, yellow: 1 });
  });

  it('ignores lower tiers', () => {
    const s = worn({ ring: item('ring', 'A'), pendant: item('pendant', 'B', 2) });
    expect(rainLines(s)).toEqual({ rainbow: 0, yellow: 0 });
  });

  it('ignores S and S+ items that are not equipped', () => {
    const s = worn({}, [item('ring', 'SS', 3), item('pendant', 'S', 4)]);
    expect(rainLines(s)).toEqual({ rainbow: 0, yellow: 0 });
  });

  it('never gives more than the slots, and never more than the cap', () => {
    const all: Partial<Record<Item['slot'], Item>> = {};
    ITEM_SLOTS.forEach((slot, i) => (all[slot] = item(slot, 'SS', i + 1)));
    const c = rainLines(worn(all));
    expect(c.rainbow).toBe(ITEM_SLOTS.length);
    expect(c.rainbow + c.yellow).toBeLessThanOrEqual(RAIN_MAX_LINES);
  });
});

describe('capRain', () => {
  it('keeps counts under the cap as they are', () => {
    expect(capRain(3, 4)).toEqual({ rainbow: 3, yellow: 4 });
  });

  it('caps the total, rainbow first', () => {
    expect(capRain(5, 20)).toEqual({ rainbow: 5, yellow: RAIN_MAX_LINES - 5 });
    expect(capRain(20, 20)).toEqual({ rainbow: RAIN_MAX_LINES, yellow: 0 });
  });

  it('turns bad numbers into whole, non-negative counts', () => {
    expect(capRain(-2, Number.NaN)).toEqual({ rainbow: 0, yellow: 0 });
    expect(capRain(1.9, 2.5)).toEqual({ rainbow: 1, yellow: 2 });
    expect(capRain(Infinity, 1)).toEqual({ rainbow: 0, yellow: 1 });
  });
});
