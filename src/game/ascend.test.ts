import { describe, expect, it } from 'vitest';
import { ascend, ascendFree, ascendProgress, ascendUnlocked, canAscend } from './ascend';
import {
  ASCEND_COST,
  ASCEND_COST_KILLS,
  ASCEND_GATE,
  ASCEND_GATE_LEVEL,
  mobCoins,
  stageLevel,
} from './balance';
import { newGear, type Item } from './items';
import { createState, newProgress, update, type GameState, type Progress } from './state';

const ring: Item = {
  id: 1,
  slot: 'ring',
  tier: 'S',
  world: 3,
  stage: 2,
  stats: { damage: 50, defence: 4, speed: 0.05, crit: 0.04 },
};
const pendant: Item = {
  id: 2,
  slot: 'pendant',
  tier: 'C',
  world: 1,
  stage: 1,
  stats: { defence: 1 },
};

/** A mid-game state: gate reached, enough coins, upgrades everywhere, items worn and in the bag. */
function played(over: Partial<Progress> = {}): GameState {
  return createState({
    ...newProgress(),
    world: ASCEND_GATE.world,
    stage: ASCEND_GATE.stage,
    best: ASCEND_GATE_LEVEL + 3,
    coins: ASCEND_COST + 500,
    weaponLevels: [20, 8, 3, 1, 0],
    equipped: 3,
    autoAdvance: false,
    kills: 321,
    deaths: 7,
    maxDps: 9_999,
    ascends: 2,
    bestStage: 50,
    items: { ...newGear(77), ring, bag: [pendant], nextId: 3 },
    companion: { id: 'crow', dmgLevel: 4, autoUnlocked: true, speedLevel: 3 },
    character: { defenceLevel: 5, critLevel: 6, hpLevel: 7 },
    ...over,
  });
}

describe('ascend balance', () => {
  it('unlocks at stage 6.1 and costs 100 kills of coins there', () => {
    expect(ASCEND_GATE).toEqual({ world: 6, stage: 1 });
    expect(ASCEND_GATE_LEVEL).toBe(stageLevel(6, 1));
    expect(ASCEND_COST_KILLS).toBe(100);
    expect(ASCEND_COST).toBe(100 * mobCoins(6, 1));
    expect(ASCEND_COST).toBeGreaterThan(0);
  });
});

describe('gate', () => {
  it('is locked below 6.1 and open from 6.1 on (by the highest stage reached)', () => {
    expect(ascendUnlocked({ best: ASCEND_GATE_LEVEL - 1 })).toBe(false);
    expect(ascendUnlocked({ best: ASCEND_GATE_LEVEL })).toBe(true);
    expect(ascendUnlocked({ best: ASCEND_GATE_LEVEL + 10 })).toBe(true);
  });

  it('needs the coins too', () => {
    expect(canAscend({ best: ASCEND_GATE_LEVEL, coins: ASCEND_COST - 1 })).toBe(false);
    expect(canAscend({ best: ASCEND_GATE_LEVEL, coins: ASCEND_COST })).toBe(true);
    expect(canAscend({ best: ASCEND_GATE_LEVEL - 1, coins: ASCEND_COST * 10 })).toBe(false);
  });

  it('stays open after going back a stage (the highest stage counts)', () => {
    const s = played({ world: 2, stage: 1 });
    expect(ascendUnlocked(s)).toBe(true);
  });
});

describe('ascend', () => {
  it('does nothing before the gate or without the coins (same state back)', () => {
    const early = played({ best: ASCEND_GATE_LEVEL - 1, world: 5, stage: 6 });
    expect(ascend(early)).toBe(early);
    const poor = played({ coins: ASCEND_COST - 1 });
    expect(ascend(poor)).toBe(poor);
  });

  it('resets everything except items: stage, coins, weapons, upgrades, crow, auto-advance', () => {
    const next = ascend(played());
    const fresh = newProgress();
    expect(next).toMatchObject({
      world: 1,
      stage: 1,
      best: 1,
      coins: 0,
      weaponLevels: fresh.weaponLevels,
      revealedWeapons: fresh.revealedWeapons,
      equipped: 0,
      autoAdvance: true,
      companion: null,
      character: { defenceLevel: 0, critLevel: 0, hpLevel: 0 },
    });
    expect(next.duel.phase).toBe('intro');
    expect(next.duel.mob.hp).toBeGreaterThan(0);
  });

  it('keeps the items: worn, in the bag, and the drop RNG', () => {
    const before = played();
    const next = ascend(before);
    expect(next.items).toEqual(before.items);
    expect(next.items.ring).toEqual(ring);
    expect(next.items.bag).toEqual([pendant]);
  });

  it('adds one to ascends, every time', () => {
    const once = ascend(played());
    expect(once.ascends).toBe(3);
    const twice = ascend({ ...once, best: ASCEND_GATE_LEVEL, coins: ASCEND_COST });
    expect(twice.ascends).toBe(4);
  });

  it('keeps the records (best DPS, best stage, best item) and the lifetime counters', () => {
    const next = ascend(played());
    expect(next.maxDps).toBe(9_999);
    expect(next.bestStage).toBe(50);
    expect(next.bestItem).toEqual(ring);
    expect(next.kills).toBe(321);
    expect(next.deaths).toBe(7);
  });

  it("raises bestStage to this run's highest stage first", () => {
    const next = ascend(played({ bestStage: 2, best: ASCEND_GATE_LEVEL + 3 }));
    expect(next.bestStage).toBe(ASCEND_GATE_LEVEL + 3);
  });

  it('asks for a save and plays a sound', () => {
    const next = ascend(played());
    expect(next.events).toContainEqual({ type: 'save' });
    expect(next.events.some((e) => e.type === 'sfx')).toBe(true);
  });

  it('plays on after the reset', () => {
    let s = ascend(played());
    for (let i = 0; i < 200; i++) s = update(s, 1 / 20);
    expect(s.ascends).toBe(3);
    expect(s.kills).toBeGreaterThan(321); // the fight goes on
    expect(s.items.ring).toEqual(ring);
  });
});

describe('ascendFree (debugger)', () => {
  it('ascends below the gate and without coins', () => {
    const s = createState();
    const next = ascendFree(s);
    expect(next.ascends).toBe(1);
    expect(next.coins).toBe(0);
  });
});

describe('ascendProgress', () => {
  it('is pure: the input is left as it is', () => {
    const s = played();
    const copy = structuredClone(s);
    ascendProgress(s);
    expect(s).toEqual(copy);
  });
});
