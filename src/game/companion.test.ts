import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import { windup } from './attacks';
import {
  companionAutoInterval,
  companionDamage,
  companionDmgCost,
  companionMaxSpeedLevel,
  companionSpeedCost,
  COMPANIONS,
} from './balance';
import {
  buyCompanion,
  companionClick,
  companionCooldown,
  companionUpgradeCost,
  createState,
  newProgress,
  secToTicks,
  shopCompanion,
  update,
  upgradeCompanion,
  type Companion,
  type GameEvent,
  type GameState,
  type Progress,
} from './state';

const crow = COMPANIONS.crow;
const crowOf = (c: Partial<Companion> = {}): Companion => ({
  id: 'crow',
  dmgLevel: 1,
  autoUnlocked: false,
  speedLevel: 1,
  ...c,
});

/** World 3 with a level-1 stick: a tanky mob (≈194 HP), so duels last ~12 s. */
const tanky = (c: Partial<Companion> | null = {}, p: Partial<Progress> = {}) =>
  createState({
    ...newProgress(),
    world: 3,
    best: 13,
    companion: c ? crowOf(c) : null,
    ...p,
  });

const crowHits = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === 'damage' && e.source === 'companion');

/** Steps `seconds`, pushing the duel tick of every crow hit to `hits`. */
function run(s: GameState, seconds: number, hits: number[] = []) {
  for (let i = 0; i < secToTicks(seconds); i++) {
    s = update(s, TICK);
    for (let n = crowHits(s.events).length; n > 0; n--) hits.push(s.duel.tick);
  }
  return s;
}

function toFighting(s: GameState) {
  while (s.duel.phase !== 'fighting') s = update(s, TICK);
  return s;
}

const flyOut = secToTicks(windup(crow.attack));

describe('crow balance', () => {
  it('flat damage: 1 × level', () => {
    expect(companionDamage(crow, 1)).toBe(1);
    expect(companionDamage(crow, 7)).toBe(7);
  });

  it('auto interval: 3.0 s, −0.1 s per speed level, floor 1.0 s at level 21', () => {
    expect(companionAutoInterval(crow, 1)).toBe(3);
    expect(companionAutoInterval(crow, 2)).toBeCloseTo(2.9);
    expect(companionAutoInterval(crow, 21)).toBeCloseTo(1);
    expect(companionAutoInterval(crow, 40)).toBe(1);
    expect(companionMaxSpeedLevel(crow)).toBe(21);
  });

  it('prices and upgrade costs follow the design doc', () => {
    expect(crow.price).toBe(25);
    expect(crow.autoPrice).toBe(150);
    expect(crow.clickCooldown).toBe(0.5);
    expect(companionDmgCost(crow, 1)).toBe(10);
    expect(companionDmgCost(crow, 2)).toBe(Math.ceil(10 * 1.15));
    expect(companionSpeedCost(crow, 1)).toBe(50);
    expect(companionSpeedCost(crow, 3)).toBe(Math.ceil(50 * 1.3 ** 2));
    expect(companionSpeedCost(crow, 21)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('crow shop', () => {
  it('shows up once 1.1 is cleared', () => {
    expect(shopCompanion(createState())).toBeNull();
    expect(shopCompanion(createState({ ...newProgress(), stage: 2 }))).toBe(crow);
  });

  it('costs 25 and goes straight into the companion slot', () => {
    let s = createState({ ...newProgress(), stage: 2, coins: 30 });
    s = buyCompanion(s);
    expect(s.coins).toBe(5);
    expect(s.companion).toEqual(crowOf());
    expect(s.events).toContainEqual({ type: 'save' });
    expect(shopCompanion(s)).toBeNull();
    expect(buyCompanion({ ...s, coins: 100 }).companion).toEqual(crowOf()); // one slot
  });

  it('cannot be bought without the coins or before the unlock', () => {
    const poor = createState({ ...newProgress(), stage: 2, coins: 24 });
    expect(buyCompanion(poor)).toBe(poor);
    const early = createState({ ...newProgress(), coins: 100 });
    expect(buyCompanion(early)).toBe(early);
  });

  it('auto attack is a one-off 150; speed needs it and stops at level 21', () => {
    let s = tanky({}, { coins: 10_000 });
    expect(companionUpgradeCost(s, 'speed')).toBeNull();
    expect(upgradeCompanion(s, 'speed')).toBe(s);
    s = upgradeCompanion(s, 'auto');
    expect(s.coins).toBe(10_000 - 150);
    expect(s.companion!.autoUnlocked).toBe(true);
    expect(companionUpgradeCost(s, 'auto')).toBeNull();
    s = upgradeCompanion(s, 'dmg');
    expect(s.companion!.dmgLevel).toBe(2);
    s = upgradeCompanion(s, 'speed');
    expect(s.companion!.speedLevel).toBe(2);

    s = tanky({ autoUnlocked: true, speedLevel: 20 }, { coins: 1_000_000 });
    s = upgradeCompanion(s, 'speed');
    expect(s.companion!.speedLevel).toBe(21);
    expect(upgradeCompanion(s, 'speed')).toBe(s);
  });
});

describe('crow click', () => {
  it('does nothing without a crow or outside fighting', () => {
    const none = toFighting(tanky(null));
    expect(companionClick(none)).toBe(none);
    const intro = tanky();
    expect(intro.duel.phase).toBe('intro');
    expect(companionClick(intro)).toBe(intro);
  });

  it('pecks for 1 × level after the fly-out, tagged as companion damage', () => {
    let s = toFighting(tanky({ dmgLevel: 3 }));
    const clickedAt = s.duel.tick;
    s = companionClick(s);
    let hit: { tick: number; events: GameEvent[] } | null = null;
    for (let i = 0; i < flyOut + 2; i++) {
      s = update(s, TICK);
      const h = crowHits(s.events);
      if (h.length) hit = { tick: s.duel.tick, events: h };
    }
    expect(hit).toEqual({
      tick: clickedAt + flyOut,
      events: [{ type: 'damage', target: 'mob', amount: 3, source: 'companion' }],
    });
  });

  it('0.5 s cooldown: clicks during it are ignored, not queued', () => {
    let s = toFighting(tanky());
    s = companionClick(s);
    expect(companionCooldown(s)).toBe(1);
    const hits: number[] = [];
    for (let i = 0; i < secToTicks(crow.clickCooldown) - 1; i++) {
      expect(companionClick(s)).toBe(s);
      s = run(s, 1 / 60, hits);
    }
    s = run(s, 1, hits);
    expect(hits).toHaveLength(1);
    expect(companionCooldown(s)).toBe(0);
    expect(companionClick(s)).not.toBe(s);
  });

  it('caps clicking at 2 pecks per second', () => {
    let s = toFighting(tanky());
    const hits: number[] = [];
    for (let i = 0; i < secToTicks(2); i++) {
      s = companionClick(s); // an autoclicker: every tick
      s = run(s, 1 / 60, hits);
    }
    const gaps = hits.slice(1).map((t, i) => t - hits[i]);
    expect(hits).toHaveLength(4);
    expect(gaps.every((g) => g === secToTicks(0.5))).toBe(true);
  });
});

describe('crow auto attack', () => {
  it('never pecks on its own before the upgrade', () => {
    const hits: number[] = [];
    run(tanky(), 8, hits);
    expect(hits).toEqual([]);
  });

  it('pecks every 3.0 s of fighting, counted from the start of the fight', () => {
    const s = tanky({ autoUnlocked: true });
    const start = s.duel.introTicks;
    const hits: number[] = [];
    run(s, 11.5, hits);
    const every = secToTicks(3);
    expect(hits).toEqual([1, 2, 3].map((n) => start + n * every + flyOut));
  });

  it('speed level 21 pecks every 1.0 s', () => {
    const hits: number[] = [];
    run(tanky({ autoUnlocked: true, speedLevel: 21 }), 6, hits);
    const gaps = hits.slice(1).map((t, i) => t - hits[i]);
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(gaps.every((g) => g === secToTicks(1))).toBe(true);
  });

  it('a click does not reset the auto timer', () => {
    let s = toFighting(tanky({ autoUnlocked: true }));
    const start = s.duel.introTicks;
    s = run(s, 1.5);
    s = companionClick(s);
    const hits: number[] = [];
    run(s, 2, hits);
    expect(hits).toHaveLength(2); // the click and the auto, on separate timers
    expect(hits).toContain(start + secToTicks(3) + flyOut);
  });

  it('only lands while fighting: a peck in flight drops when the mob dies', () => {
    // 1.4: 3 HP. Stick hits at the fight start and 1 s later; the crow adds 1.
    let s = toFighting(createState({ ...newProgress(), stage: 4, companion: crowOf() }));
    expect(s.duel.mob.hp).toBe(2);
    const start = s.duel.tick;
    s = companionClick(s);
    const hits: number[] = [];
    s = run(s, (secToTicks(1) - flyOut) / 60, hits);
    expect(hits).toEqual([start + flyOut]);
    s = companionClick(s); // lands on the same tick as the killing sword hit
    s = run(s, 3, hits);
    expect(hits).toHaveLength(1);
    expect(s.kills).toBe(1);
  });
});
