import { beforeEach, describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import { ascendFree } from './ascend';
import {
  companionDamage,
  COMPANIONS,
  CRIT,
  CRIT_BUY_MAX_PERCENT,
  CHARACTER,
  ASCEND_SPEED_PER,
} from './balance';
import { newGear, type Item } from './items';
import { ascendsOf, EXTRA_HIT_MULT, PICK_OPTIONS, setPicksEnabled, type Passive } from './passives';
import {
  choosePick,
  clickBonus,
  companionClick,
  createState,
  critChance,
  extraHitChance,
  forcePickOffer,
  heroDamage,
  heroDefence,
  heroDps,
  heroSpeed,
  newProgress,
  secToTicks,
  stageSwitchTarget,
  switchStage,
  update,
  type GameEvent,
  type GameState,
  type Progress,
} from './state';

beforeEach(() => setPicksEnabled(true));

const ps = (...p: Passive[]): Passive[] => p;
const pas = (id: string, tier: Passive['tier'], level = 1): Passive => ({ id, tier, level });

/** A stick-wielding hero at 3.1 with lots of HP: duels last long, so fights can be watched. */
const tanky = (passives: Passive[], p: Partial<Progress> = {}) =>
  createState({
    ...newProgress(),
    world: 3,
    best: 13,
    character: { defenceLevel: 0, critLevel: 0, hpLevel: 100 },
    passives,
    ...p,
  });

/** A hero that kills the stage-1.1 mob in one swing. */
const strong = (p: Partial<Progress> = {}) =>
  createState({ ...newProgress(), weaponLevels: [1000, 0, 0, 0, 0], ...p });

function runUntil(s: GameState, pred: (s: GameState) => boolean, seconds = 60) {
  for (let i = 0; i < secToTicks(seconds) && !pred(s); i++) s = update(s, TICK);
  if (!pred(s)) throw new Error('condition never reached');
  return s;
}

function run(s: GameState, seconds: number, events: GameEvent[] = []) {
  for (let i = 0; i < secToTicks(seconds); i++) {
    s = update(s, TICK);
    events.push(...s.events);
  }
  return s;
}

/** Stage 1.6 (the boss) is the frontier: killing the boss is the first clear of it. */
const atBoss = (p: Partial<Progress> = {}) => strong({ stage: 6, best: 6, ...p });

describe('a boss kill opens the offer', () => {
  it('pauses the fight with two options and moves on after the pick', () => {
    let s = runUntil(atBoss(), (st) => st.pick !== null);
    expect(s.pick).toHaveLength(PICK_OPTIONS);
    expect(new Set(s.pick!.map((o) => o.id)).size).toBe(PICK_OPTIONS);
    expect([s.world, s.stage]).toEqual([2, 1]); // the stage the kill leads to
    expect(s.duel.phase).toBe('transition');

    // The fight just waits: no timer, nothing picks for the player, nothing advances.
    const frozen = run(s, 30);
    expect(frozen.pick).toEqual(s.pick);
    expect(frozen.duel.tick).toBe(s.duel.tick);
    expect(frozen.duel.phase).toBe('transition');
    expect(frozen.passives).toEqual([]);

    const picked = choosePick(frozen, 1);
    expect(picked.pick).toBeNull();
    expect(picked.passives).toEqual([{ ...s.pick![1], level: 1 }]);
    expect(picked.events.some((e) => e.type === 'save')).toBe(true);

    // And the game goes on: the next duel starts on 2.1.
    s = runUntil(picked, (st) => st.duel.phase === 'intro');
    expect([s.world, s.stage]).toEqual([2, 1]);
    expect(s.duel.mob.hp).toBe(s.duel.mob.maxHp);
  });

  it('stacks the same passive at the same tier when it is picked again', () => {
    let s = runUntil(atBoss(), (st) => st.pick !== null);
    const option = s.pick![0];
    s = choosePick(s, 0);
    // Offer the same thing again by hand.
    s = { ...s, pick: [option] };
    s = choosePick(s, 0);
    expect(s.passives).toEqual([{ ...option, level: 2 }]);
  });

  it('gives no offer with AUTO off, and none when picks are switched off', () => {
    const off = runUntil(atBoss({ autoAdvance: false }), (st) => st.duel.phase === 'transition');
    expect(off.pick).toBeNull();
    expect(run(off, 5).pick).toBeNull();

    setPicksEnabled(false);
    const s = runUntil(atBoss(), (st) => st.duel.phase === 'transition');
    expect(s.pick).toBeNull();
    expect([s.world, s.stage]).toEqual([2, 1]);
  });

  it('a normal stage clear gives no offer, even at the frontier', () => {
    for (const stage of [1, 3, 5]) {
      const s = runUntil(strong({ stage, best: stage }), (st) => st.duel.phase === 'transition');
      expect([s.world, s.stage]).toEqual([1, stage + 1]);
      expect(s.pick).toBeNull();
    }
  });

  it('only the first kill of a boss offers a pick, so replays cannot farm them', () => {
    // The 1.6 boss with 2.4 reached: killing it again is a replay.
    const replay = runUntil(
      strong({ stage: 6, best: 10 }),
      (st) => st.duel.phase === 'transition' && st.stage !== 6,
    );
    expect(replay.pick).toBeNull();
    // The frontier boss does offer one.
    const f = runUntil(atBoss(), (st) => st.pick !== null);
    expect([f.world, f.stage]).toEqual([2, 1]);
  });

  it('after an ascend the first boss kill of the new run offers a pick again', () => {
    const old = strong({ stage: 6, best: 40, ascends: 0 });
    expect(runUntil(old, (st) => st.duel.phase === 'transition').pick).toBeNull();
    const fresh = ascendFree(old);
    expect(fresh.best).toBeLessThan(old.best);
    const again = runUntil(
      { ...fresh, stage: 6, world: 1, best: 6, weaponLevels: [1000, 0, 0, 0, 0] },
      (st) => st.pick !== null,
    );
    expect(again.pick).toHaveLength(PICK_OPTIONS);
  });

  it('a pending offer from an old save (a normal stage) can still be answered', () => {
    const saved = strong({
      stage: 3,
      best: 3,
      pick: [
        { id: 'speed', tier: 'B' },
        { id: 'crit', tier: 'C' },
      ],
    });
    expect(saved.pick).toHaveLength(2);
    expect(run(saved, 5).duel.tick).toBe(saved.duel.tick); // still frozen
    const picked = choosePick(saved, 0);
    expect(picked.pick).toBeNull();
    expect(picked.passives).toEqual([{ id: 'speed', tier: 'B', level: 1 }]);
    expect(run(picked, 3).duel.tick).toBeGreaterThan(saved.duel.tick);
  });

  it('blocks stage switching while the offer is open', () => {
    const s = runUntil(atBoss(), (st) => st.pick !== null);
    expect(stageSwitchTarget(s, 'prev')).toBeNull();
    expect(stageSwitchTarget(s, 'next')).toBeNull();
    expect(switchStage(s, 'prev')).toBe(s);
    expect(stageSwitchTarget(choosePick(s, 0), 'prev')).not.toBeNull();
  });
});

describe('choosePick / forcePickOffer', () => {
  it('ignores a bad index or no open offer (same object back)', () => {
    const s = strong();
    expect(choosePick(s, 0)).toBe(s);
    const open = forcePickOffer(s);
    expect(choosePick(open, 2)).toBe(open);
    expect(choosePick(open, -1)).toBe(open);
    expect(choosePick(open, Number.NaN)).toBe(open);
  });

  it('forces an offer in the middle of a fight and freezes it', () => {
    const fighting = runUntil(tanky([]), (st) => st.duel.phase === 'fighting');
    const open = forcePickOffer(fighting);
    expect(open.pick).toHaveLength(PICK_OPTIONS);
    expect(forcePickOffer(open)).toBe(open);
    const later = run(open, 10);
    expect(later.duel.tick).toBe(open.duel.tick);
    expect(later.duel.mob.hp).toBe(open.duel.mob.hp);
    const resumed = run(choosePick(later, 0), 3);
    expect(resumed.duel.tick).toBeGreaterThan(open.duel.tick);
  });

  it('is repeatable: the same state rolls the same offer', () => {
    const a = forcePickOffer(strong({ items: newGear(5) }));
    const b = forcePickOffer(strong({ items: newGear(5) }));
    expect(a.pick).toEqual(b.pick);
  });
});

describe('ascend', () => {
  it('resets the passives and a pending pick, and the next offers use the new ascends', () => {
    const open = forcePickOffer(
      strong({ passives: ps(pas('speed', 'A', 2), pas('crit', 'C')), best: 40, ascends: 1 }),
    );
    expect(open.pick).not.toBeNull();
    const after = ascendFree(open);
    expect(after.passives).toEqual([]);
    expect(after.pick).toBeNull();
    expect(after.ascends).toBe(2);
    expect(ascendsOf(after)).toBe(2);
    // Only the ascend speed is left: the passive speed is gone with the passives.
    expect(heroSpeed(after)).toBeCloseTo(2 * ASCEND_SPEED_PER);
    // A new offer on the new run is rolled with the new ascends (tier chances shift).
    expect(forcePickOffer(after).pick).toHaveLength(PICK_OPTIONS);
  });
});

describe('passive effects feed the derived stats', () => {
  it('defence adds flat points on top of items and the coin upgrade', () => {
    const s = createState({
      ...newProgress(),
      character: { defenceLevel: 2, critLevel: 0, hpLevel: 0 },
      passives: ps(pas('defence', 'B', 3)),
    });
    expect(heroDefence(s)).toBe(2 * CHARACTER.defence.perLevel + 3 * 6);
  });

  it('crit chance adds up with the upgrade, and the total cap still holds', () => {
    const base = { ...newProgress(), character: { defenceLevel: 0, critLevel: 10, hpLevel: 0 } };
    expect(critChance(createState({ ...base, passives: ps(pas('crit', 'S', 5)) }))).toBeCloseTo(
      0.1 + 5 * 0.03,
    );
    const ring: Item = { id: 1, slot: 'ring', tier: 'S', world: 1, stage: 1, stats: { crit: 0.3 } };
    const maxed = createState({
      ...base,
      character: { defenceLevel: 0, critLevel: Math.round(CRIT_BUY_MAX_PERCENT), hpLevel: 0 },
      items: { ...newGear(1), ring },
      passives: ps(pas('crit', 'SS', 50)),
    });
    expect(critChance(maxed)).toBe(CRIT.maxChance);
  });

  it('attack speed raises the DPS and shortens the swing', () => {
    const plain = strong();
    const fast = strong({ passives: ps(pas('speed', 'A', 4)) }); // 4 × 4 % = 16 %
    expect(heroSpeed(fast)).toBeCloseTo(0.16);
    expect(heroDps(fast)).toBeGreaterThan(heroDps(plain));
    expect(heroDps(fast)).toBe(Math.floor(heroDamage(plain) * 1.16));

    // Against a tanky mob the faster hero lands more hits in the same time.
    const hits = (passives: Passive[]) => {
      const e: GameEvent[] = [];
      run(tanky(passives), 10, e);
      return e.filter((x) => x.type === 'damage' && x.target === 'mob').length;
    };
    const quick = ps(pas('speed', 'SS', 3)); // 3 × 12 % = 36 %
    expect(heroSpeed({ passives: quick })).toBeCloseTo(0.36);
    expect(hits(quick)).toBeGreaterThan(hits([]) + 1);
  });

  it('second strike adds hits worth half a normal hit, only with the passive', () => {
    const tankyTen = (passives: Passive[]) => tanky(passives, { weaponLevels: [10, 0, 0, 0, 0] });
    const mobHits = (s: GameState) => {
      const e: GameEvent[] = [];
      run(s, 8, e);
      return e.flatMap((x) => (x.type === 'damage' && x.target === 'mob' ? [x.amount] : []));
    };
    const without = mobHits(tankyTen([]));
    expect(new Set(without)).toEqual(new Set([10]));

    const withExtra = tankyTen(ps(pas('extra', 'S', 5))); // 30 % chance
    expect(extraHitChance(withExtra)).toBeCloseTo(0.3);
    const amounts = mobHits(withExtra);
    const extras = amounts.filter((a) => a === 10 * EXTRA_HIT_MULT);
    expect(extras.length).toBeGreaterThan(0);
    expect(amounts.every((a) => a === 10 || a === 5)).toBe(true);
  });

  it('click bonus adds to the crow click attack but not to its auto attacks', () => {
    const hero = 100;
    const start = (passives: Passive[]) =>
      createState({
        ...newProgress(),
        world: 5,
        best: 25,
        weaponLevels: [hero, 0, 0, 0, 0],
        companions: { crow: 1, wolf: 0 },
        character: { defenceLevel: 0, critLevel: 0, hpLevel: 200 },
        passives,
      });
    /** Damage of the crow's attacks in the 5 s after the fight starts (and a click, if asked). */
    const pecks = (s: GameState, click: boolean) => {
      s = runUntil(
        s,
        (st) => st.duel.phase === 'fighting' && st.duel.tick > st.duel.introTicks + 2,
      );
      if (click) s = companionClick(s);
      const e: GameEvent[] = [];
      run(s, 5, e);
      return e.flatMap((x) => (x.type === 'damage' && x.source === 'companion' ? [x.amount] : []));
    };
    const base = companionDamage(COMPANIONS.crow, 1, hero);
    const withBonus = start(ps(pas('click', 'S', 5))); // 5 × 3 % = 15 % of 100 = +15
    expect(clickBonus(withBonus)).toBeCloseTo(0.15);

    const clicked = pecks(withBonus, true);
    expect(clicked[0]).toBe(base + 15); // the click attack
    expect(clicked.slice(1).length).toBeGreaterThan(0);
    expect(clicked.slice(1).every((d) => d === base)).toBe(true); // auto attacks
    expect(pecks(withBonus, false).every((d) => d === base)).toBe(true);
    expect(pecks(start([]), true)[0]).toBe(base);
  });

  it('a pick changes max DPS tracking (the stat only goes up)', () => {
    const s = forcePickOffer(strong());
    const next = choosePick({ ...s, pick: [{ id: 'speed', tier: 'SS' }] }, 0);
    expect(next.maxDps).toBeGreaterThanOrEqual(s.maxDps);
  });
});
