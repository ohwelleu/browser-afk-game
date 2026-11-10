import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import { windup } from './attacks';
import {
  COMPANION_IDS,
  companionDamage,
  companionDps,
  companionPercent,
  companionUpgradeCostAt,
  COMPANIONS,
  CROW_BASE_PERCENT,
  CROW_PRICE,
  WOLF_BASE_PERCENT,
  WOLF_PRICE,
  type CompanionId,
} from './balance';
import {
  buyCompanion,
  buyUpgrades,
  canBuyCompanion,
  clickerDef,
  companionClick,
  companionCooldown,
  companionStatus,
  companionUpgradeCost,
  createState,
  heroDamage,
  newProgress,
  ownedCompanions,
  secToTicks,
  update,
  upgradeCompanion,
  upgradeQuote,
  type CompanionLevels,
  type GameEvent,
  type GameState,
  type Progress,
} from './state';

const { crow, wolf } = COMPANIONS;
const levels = (l: Partial<CompanionLevels> = {}): CompanionLevels => ({ crow: 0, wolf: 0, ...l });

/**
 * World 3 with a level-1 stick: a tanky mob (≈194 HP), so duels last ~12 s.
 * The hero has plenty of max HP so a long duel never ends in his death.
 */
const tanky = (l: Partial<CompanionLevels> = {}, p: Partial<Progress> = {}) =>
  createState({
    ...newProgress(),
    world: 3,
    best: 13,
    companions: levels(l),
    character: { defenceLevel: 0, critLevel: 0, hpLevel: 100, manaLevel: 0 },
    ...p,
  });

/**
 * The iron sword at level 1 (the hero hits for 216, so the percents show) in
 * world 6, where a mob has ~16,000 HP and survives the whole test.
 */
const IRON = { world: 6, best: 31, equipped: 3, weaponLevels: [1, 1, 1, 1, 0] };

const companionHits = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === 'damage' && e.source === 'companion');

/** Steps `seconds`, pushing the duel tick of every companion hit to `hits` (and its damage to `amounts`). */
function run(s: GameState, seconds: number, hits: number[] = [], amounts: number[] = []) {
  for (let i = 0; i < secToTicks(seconds); i++) {
    s = update(s, TICK);
    for (const e of companionHits(s.events)) {
      hits.push(s.duel.tick);
      if (e.type === 'damage') amounts.push(e.amount);
    }
  }
  return s;
}

function toFighting(s: GameState) {
  while (s.duel.phase !== 'fighting') s = update(s, TICK);
  return s;
}

const crowWindup = secToTicks(windup(crow.attack));
const wolfWindup = secToTicks(windup(wolf.attack));

describe('companion table', () => {
  it('has an entry for every id, in shop order, with its own sprites and position', () => {
    expect(COMPANION_IDS).toEqual(['crow', 'wolf']);
    for (const id of COMPANION_IDS) expect(COMPANIONS[id].id).toBe(id);
    expect(crow.sprites).toBe('crow');
    expect(wolf.sprites).toBe('wolf');
    expect(crow.position).toBe('hat');
    expect(wolf.position).toBe('behind');
  });

  it('crow: 2 % base, 25 coins, clickable; wolf: 5 % base, clearly dearer, auto only', () => {
    expect([crow.basePercent, wolf.basePercent]).toEqual([CROW_BASE_PERCENT, WOLF_BASE_PERCENT]);
    expect([CROW_BASE_PERCENT, WOLF_BASE_PERCENT]).toEqual([2, 5]);
    expect([crow.price, wolf.price]).toEqual([CROW_PRICE, WOLF_PRICE]);
    expect(crow.price).toBe(25);
    expect(wolf.price).toBeGreaterThanOrEqual(10 * crow.price);
    expect(wolf.unlockLevel).toBeGreaterThan(crow.unlockLevel);
    expect(crow.clickCooldown).toBe(0.5);
    expect(wolf.clickCooldown).toBeNull();
  });
});

describe('companion damage', () => {
  it('percent: base + step × (level − 1); one number, so no separate speed upgrade', () => {
    expect([1, 10, 50].map((l) => companionPercent(crow, l))).toEqual([2, 6.5, 26.5]);
    expect([1, 10, 50].map((l) => companionPercent(wolf, l))).toEqual([5, 16.25, 66.25]);
    // The attack interval does not depend on the level.
    expect(crow.attack.interval).toBe(1);
    expect(wolf.attack.interval).toBe(1);
  });

  it('damage = the percent of the hero hit, rounded down', () => {
    expect(companionDamage(crow, 1, 1000)).toBe(20);
    expect(companionDamage(wolf, 1, 1000)).toBe(50);
    expect(companionDamage(crow, 10, 1000)).toBe(65);
    expect(companionDamage(wolf, 10, 1000)).toBe(162); // 162.5
    expect(companionDamage(crow, 50, 1000)).toBe(265);
    expect(companionDamage(wolf, 50, 1000)).toBe(662); // 662.5
    expect(companionDamage(wolf, 1, 219)).toBe(10); // 10.95
  });

  it('a hit always does at least 1, even while the hero hits for 0', () => {
    for (const def of [crow, wolf]) {
      expect(companionDamage(def, 1, 0)).toBe(1);
      expect(companionDamage(def, 1, 1)).toBe(1);
      expect(companionDamage(def, 1, 6)).toBe(1);
    }
    expect(companionDamage(crow, 1, 49)).toBe(1); // 0.98
    expect(companionDamage(crow, 1, 50)).toBe(1);
    expect(companionDamage(crow, 1, 100)).toBe(2);
  });

  it('uses the hero weapon: bigger weapons give bigger hits', () => {
    const hit = (equipped: number, level: number) =>
      heroDamage({
        equipped,
        weaponLevels: [0, 0, 0, 0, 0].map((_, i) => (i === equipped ? level : 0)),
      });
    expect(companionDamage(wolf, 1, hit(0, 1))).toBe(1); // stick: hit 1
    expect(companionDamage(wolf, 1, hit(2, 1))).toBe(1); // stone sword: hit 36 → 1.8
    expect(companionDamage(crow, 1, hit(3, 1))).toBe(4); // iron sword: hit 216 → 4.32
    expect(companionDamage(wolf, 1, hit(3, 1))).toBe(10); // 10.8
    expect(companionDamage(crow, 1, hit(4, 10))).toBe(259); // gold sword lv 10: hit 12960
    expect(companionDamage(wolf, 1, hit(4, 10))).toBe(648);
  });

  it('DPS = damage ÷ the attack interval', () => {
    expect(companionDps(wolf, 1, 1000)).toBe(50);
    expect(companionDps(crow, 1, 1000)).toBe(20);
  });

  it('upgrade cost: base × growth^(level − 1), the wolf dearer than the crow', () => {
    expect(companionUpgradeCostAt(crow, 1)).toBe(10);
    expect(companionUpgradeCostAt(crow, 2)).toBe(Math.ceil(10 * 1.15));
    expect(companionUpgradeCostAt(wolf, 1)).toBe(100);
    expect(companionUpgradeCostAt(wolf, 2)).toBe(Math.ceil(100 * 1.15));
    for (const l of [1, 5, 30]) {
      expect(companionUpgradeCostAt(wolf, l)).toBeGreaterThan(companionUpgradeCostAt(crow, l));
    }
    expect(companionUpgradeCostAt(crow, 0)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('buying companions', () => {
  const at = (best: number, coins: number, l: Partial<CompanionLevels> = {}) =>
    createState({ ...newProgress(), best, coins, companions: levels(l) });

  it('the crow shows up once 1.1 is cleared, the wolf later', () => {
    expect(companionStatus(createState(), 'crow')).toBe('locked');
    expect(companionStatus(at(crow.unlockLevel, 0), 'crow')).toBe('offer');
    expect(companionStatus(at(wolf.unlockLevel - 1, 0), 'wolf')).toBe('locked');
    expect(companionStatus(at(wolf.unlockLevel, 0), 'wolf')).toBe('offer');
    expect(companionStatus(at(1, 0, { wolf: 1 }), 'wolf')).toBe('owned');
  });

  it.each([
    ['crow', CROW_PRICE],
    ['wolf', WOLF_PRICE],
  ] as const)('buying the %s costs its price and starts it at level 1', (id, price) => {
    let s = at(20, price + 5);
    s = buyCompanion(s, id);
    expect(s.coins).toBe(5);
    expect(s.companions[id]).toBe(1);
    expect(s.events).toContainEqual({ type: 'save' });
    expect(companionStatus(s, id)).toBe('owned');
    // Bought for good: no second purchase, no refund.
    expect(buyCompanion({ ...s, coins: 1e6 }, id)).toEqual({ ...s, coins: 1e6 });
  });

  it('both can be owned at once', () => {
    let s = at(20, CROW_PRICE + WOLF_PRICE);
    s = buyCompanion(buyCompanion(s, 'crow'), 'wolf');
    expect(s.coins).toBe(0);
    expect(s.companions).toEqual({ crow: 1, wolf: 1 });
    expect(ownedCompanions(s).map((d) => d.id)).toEqual(['crow', 'wolf']);
  });

  it('cannot be bought without the coins or before the unlock', () => {
    const poor = at(20, WOLF_PRICE - 1);
    expect(canBuyCompanion(poor, 'wolf')).toBe(false);
    expect(buyCompanion(poor, 'wolf')).toBe(poor);
    const early = at(wolf.unlockLevel - 1, 1e6);
    expect(canBuyCompanion(early, 'wolf')).toBe(false);
    expect(buyCompanion(early, 'wolf')).toBe(early);
    expect(canBuyCompanion(early, 'crow')).toBe(true);
  });
});

describe('upgrading companions', () => {
  it.each(COMPANION_IDS)('the %s has one upgrade: its level', (id: CompanionId) => {
    let s = tanky({ [id]: 1 }, { coins: 10_000 });
    expect(companionUpgradeCost(s, id)).toBe(companionUpgradeCostAt(COMPANIONS[id], 1));
    s = upgradeCompanion(s, id);
    expect(s.companions[id]).toBe(2);
    expect(s.coins).toBe(10_000 - companionUpgradeCostAt(COMPANIONS[id], 1));
    // Nothing else changes, and the other companion is untouched.
    const other = COMPANION_IDS.find((o) => o !== id)!;
    expect(s.companions[other]).toBe(0);
  });

  it('cannot upgrade a companion that is not bought, or without coins', () => {
    const s = tanky({ crow: 1 }, { coins: 10_000 });
    expect(companionUpgradeCost(s, 'wolf')).toBeNull();
    expect(upgradeCompanion(s, 'wolf')).toBe(s);
    const poor = tanky({ wolf: 1 }, { coins: 99 });
    expect(upgradeCompanion(poor, 'wolf')).toBe(poor);
  });

  it('bulk ×10 and MAX work like the crow always did', () => {
    const sum = (from: number, n: number, id: CompanionId) =>
      Array.from({ length: n }, (_, i) => companionUpgradeCostAt(COMPANIONS[id], from + i)).reduce(
        (a, b) => a + b,
        0,
      );
    const wolfOnly = tanky({ wolf: 1 }, { coins: sum(1, 12, 'wolf') });
    const t = { type: 'companion', id: 'wolf' } as const;
    expect(upgradeQuote(wolfOnly, t, 10)).toEqual({ levels: 10, cost: sum(1, 10, 'wolf') });
    expect(upgradeQuote(wolfOnly, t, 100).cost).toBeGreaterThan(wolfOnly.coins);
    expect(buyUpgrades(wolfOnly, t, 100)).toBe(wolfOnly); // can't pay ×100: nothing is bought
    const ten = buyUpgrades(wolfOnly, t, 10);
    expect(ten.companions.wolf).toBe(11);
    expect(ten.coins).toBe(sum(11, 2, 'wolf'));
    const max = buyUpgrades(wolfOnly, t, 'max');
    expect(max.companions.wolf).toBe(13);
    expect(max.coins).toBe(0);
    // ×100 with the coins for it.
    const rich = tanky({ crow: 1 }, { coins: sum(1, 100, 'crow') });
    expect(buyUpgrades(rich, { type: 'companion', id: 'crow' }, 100).companions.crow).toBe(101);
    // An unowned companion buys nothing.
    expect(buyUpgrades(wolfOnly, { type: 'companion', id: 'crow' }, 'max')).toBe(wolfOnly);
  });
});

describe('click (crow only)', () => {
  it('does nothing without a crow, with only a wolf, or outside fighting', () => {
    const none = toFighting(tanky());
    expect(companionClick(none)).toBe(none);
    const wolfOnly = toFighting(tanky({ wolf: 1 }));
    expect(clickerDef(wolfOnly)).toBeNull();
    expect(companionClick(wolfOnly)).toBe(wolfOnly);
    expect(companionCooldown(wolfOnly)).toBe(0);
    const intro = tanky({ crow: 1 });
    expect(intro.duel.phase).toBe('intro');
    expect(companionClick(intro)).toBe(intro);
  });

  it('the crow pecks after the fly-out for its share of the hero hit, tagged as companion damage', () => {
    let s = toFighting(tanky({ crow: 3 }, IRON));
    const clickedAt = s.duel.tick;
    s = companionClick(s);
    let hit: { tick: number; events: GameEvent[] } | null = null;
    for (let i = 0; i < crowWindup + 2; i++) {
      s = update(s, TICK);
      const h = companionHits(s.events);
      if (h.length) hit = { tick: s.duel.tick, events: h };
    }
    const amount = companionDamage(crow, 3, 216); // 3 % × 216 = 6.48
    expect(amount).toBe(6);
    expect(hit).toEqual({
      tick: clickedAt + crowWindup,
      events: [{ type: 'damage', target: 'mob', amount, source: 'companion' }],
    });
  });

  it('a click with both companions only moves the crow', () => {
    let s = toFighting(tanky({ crow: 1, wolf: 1 }));
    s = companionClick(s);
    expect(s.duel.companionPecks.crow).toHaveLength(1);
    expect(s.duel.companionPecks.wolf).toHaveLength(0);
  });

  it('0.5 s cooldown: clicks during it are ignored, not queued', () => {
    let s = toFighting(tanky({ crow: 1 }));
    s = companionClick(s);
    expect(companionCooldown(s)).toBe(1);
    const hits: number[] = [];
    for (let i = 0; i < secToTicks(crow.clickCooldown!) - 1; i++) {
      expect(companionClick(s)).toBe(s);
      s = run(s, 1 / 60, hits);
    }
    s = run(s, 0.4, hits); // short of the 1.0 s auto attack
    expect(hits).toHaveLength(1);
    expect(companionCooldown(s)).toBe(0);
    expect(companionClick(s)).not.toBe(s);
  });

  it('caps clicking at 2 pecks per second', () => {
    // Clicks only: a mob that can't die and a crow whose auto attack is off the clock.
    let s = toFighting(tanky({ crow: 1 }));
    s.companionAutoCharge = { ...s.companionAutoCharge, crow: -secToTicks(100) };
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

describe('auto attacks', () => {
  it('a companion attacks by itself as soon as it is bought, every second of fighting', () => {
    for (const [id, def, windupTicks] of [
      ['crow', crow, crowWindup],
      ['wolf', wolf, wolfWindup],
    ] as const) {
      const s = toFighting(tanky({ [id]: 1 }));
      const start = s.duel.tick;
      const hits: number[] = [];
      run(s, 3.5, hits);
      const every = secToTicks(def.attack.interval);
      expect(hits).toEqual([1, 2, 3].map((n) => start + n * every + windupTicks));
    }
  });

  it('they attack independently, each on its own timer and for its own damage', () => {
    const s = toFighting(tanky({ crow: 1, wolf: 1 }, IRON));
    const start = s.duel.tick;
    const hits: number[] = [];
    const amounts: number[] = [];
    run(s, 2.5, hits, amounts);
    const every = secToTicks(1);
    const crowAt = [1, 2].map((n) => start + n * every + crowWindup);
    const wolfAt = [1, 2].map((n) => start + n * every + wolfWindup);
    expect(hits).toEqual([...crowAt, ...wolfAt].sort((a, b) => a - b));
    // 2 % of 216 = 4, 5 % of 216 = 10.
    expect(amounts).toEqual(hits.map((t) => (crowAt.includes(t) ? 4 : 10)));
  });

  it('a click does not reset the crow timer, and the wolf ignores clicks', () => {
    let s = toFighting(tanky({ crow: 1, wolf: 1 }));
    const start = s.duel.tick;
    s = run(s, 0.5);
    s = companionClick(s);
    const hits: number[] = [];
    run(s, 1, hits);
    // The click, the crow's auto and the wolf's auto: three hits in the next second.
    expect(hits).toHaveLength(3);
    expect(hits).toContain(start + secToTicks(1) + crowWindup);
    expect(hits).toContain(start + secToTicks(1) + wolfWindup);
  });

  it('only lands while fighting: an attack in flight drops when the mob dies', () => {
    // 1.4: 3 HP. Stick hits at the fight start and 1 s later; the crow adds 1.
    let s = toFighting(
      createState({ ...newProgress(), stage: 4, companions: levels({ crow: 1 }) }),
    );
    expect(s.duel.mob.hp).toBe(2);
    const start = s.duel.tick;
    s = companionClick(s);
    const hits: number[] = [];
    s = run(s, (secToTicks(1) - crowWindup) / 60, hits);
    expect(hits).toEqual([start + crowWindup]);
    s = companionClick(s); // lands on the same tick as the killing sword hit
    s = run(s, 3, hits);
    expect(hits).toHaveLength(1);
    expect(s.kills).toBe(1);
  });

  it('a new duel starts with no attacks in flight and fresh timers', () => {
    let s = toFighting(tanky({ crow: 1, wolf: 1 }));
    s = companionClick(s);
    s = run(s, 1.2);
    expect(s.duel.companionAttackTick.crow).not.toBeNull();
    expect(s.duel.companionAttackTick.wolf).not.toBeNull();
    const fresh = createState({ ...newProgress(), companions: levels({ crow: 1, wolf: 1 }) });
    expect(fresh.duel.companionPecks).toEqual({ crow: [], wolf: [] });
    expect(fresh.duel.companionAttackTick).toEqual({ crow: null, wolf: null });
    expect(fresh.companionAutoCharge).toEqual({ crow: 0, wolf: 0 });
  });
});
