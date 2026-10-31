import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import { DUEL, HERO_MAX_HP, mobCoins, mobHp, WEAPONS } from './balance';
import {
  buyUpgrade,
  buyWeapon,
  createState,
  equip,
  heroDamage,
  newProgress,
  secToTicks,
  setAutoAdvance,
  update,
  type GameEvent,
  type GameState,
  type Progress,
} from './state';

/** Runs `seconds` of game time one tick at a time, collecting events with their tick. */
function run(s: GameState, seconds: number, events: { tick: number; e: GameEvent }[] = []) {
  for (let i = 0; i < secToTicks(seconds); i++) {
    s = update(s, TICK);
    for (const e of s.events) events.push({ tick: s.duel.tick, e });
  }
  return s;
}

/** Runs until the duel phase matches (max 60 s). */
function runUntil(s: GameState, pred: (s: GameState) => boolean) {
  for (let i = 0; i < secToTicks(60) && !pred(s); i++) s = update(s, TICK);
  if (!pred(s)) throw new Error('condition never reached');
  return s;
}

const strong = (p: Partial<Progress> = {}) =>
  createState({ ...newProgress(), weaponLevels: [1000, 0, 0, 0, 0], ...p });
const weak = (p: Partial<Progress> = {}) => createState({ ...newProgress(), ...p });

describe('duel timing', () => {
  it('hero hits first at 2.0 s, then every 1.0 s; mob first at 2.5 s', () => {
    const events: { tick: number; e: GameEvent }[] = [];
    // Big mob HP so nobody dies: world 3 boss vs a stick.
    run(weak({ world: 3, stage: 6 }), 3.6, events);
    const hits = (target: string) =>
      events.filter((x) => x.e.type === 'damage' && x.e.target === target).map((x) => x.tick);
    expect(hits('mob')).toEqual([secToTicks(2.0), secToTicks(3.0)]);
    expect(hits('hero')).toEqual([secToTicks(2.5), secToTicks(3.5)]);
  });

  it('swing starts before the hit frame; damage lands on it', () => {
    const events: { tick: number; e: GameEvent }[] = [];
    run(weak({ world: 3, stage: 6 }), 2.1, events);
    const swing = events.find((x) => x.e.type === 'sfx' && x.e.name === 'swing')!;
    const hit = events.find((x) => x.e.type === 'damage')!;
    expect(swing.tick).toBe(secToTicks(2.0) - secToTicks(1 / 12));
    expect(hit.tick).toBe(secToTicks(2.0));
  });

  it('nothing happens during the 2 s intro', () => {
    const s = run(weak(), DUEL.intro - TICK);
    expect(s.duel.phase).toBe('intro');
    expect(s.duel.mob.hp).toBe(s.duel.mob.maxHp);
    expect(s.duel.heroHp).toBe(HERO_MAX_HP);
  });
});

describe('intro length', () => {
  const nextIntro = (s: GameState) =>
    runUntil(s, (x) => x.duel.phase === 'intro' && x.duel.tick === 0 && x.kills + x.deaths > 0).duel
      .introTicks;

  it('full intro on a new stage, short beat when farming', () => {
    expect(nextIntro(strong())).toBe(secToTicks(DUEL.intro));
    expect(nextIntro(strong({ autoAdvance: false }))).toBe(secToTicks(DUEL.shortIntro));
  });

  it('short beat when re-entering a stage already reached', () => {
    expect(nextIntro(strong({ stage: 2, best: 5 }))).toBe(secToTicks(DUEL.shortIntro));
    expect(nextIntro(strong({ stage: 4, best: 5 }))).toBe(secToTicks(DUEL.shortIntro));
    expect(nextIntro(strong({ stage: 5, best: 5 }))).toBe(secToTicks(DUEL.intro));
  });

  it('short beat after a rollback, and the next hits come right after it', () => {
    let s = weak({ world: 3, stage: 1 });
    s = runUntil(s, (x) => x.deaths === 1 && x.duel.phase === 'intro');
    expect(s.duel.introTicks).toBe(secToTicks(DUEL.shortIntro));
    expect(s.duel.heroNextHit).toBe(secToTicks(DUEL.shortIntro));
    expect(s.duel.mobNextHit).toBe(secToTicks(DUEL.shortIntro + DUEL.mobOffset));
  });

  it('the first duel after Start/Continue always has the full intro', () => {
    expect(weak({ stage: 2, best: 9 }).duel.introTicks).toBe(secToTicks(DUEL.intro));
  });
});

describe('mob death', () => {
  it('pays coins once and advances with auto-advance on', () => {
    let s = strong();
    s = runUntil(s, (x) => x.duel.phase === 'mobDying');
    expect(s.coins).toBe(mobCoins(1, 1));
    expect(s.kills).toBe(1);
    s = run(s, DUEL.mobDying + 0.1);
    expect(s.coins).toBe(mobCoins(1, 1));
    expect(s.stage).toBe(2);
    s = runUntil(s, (x) => x.duel.phase === 'intro');
    expect(s.duel.mob.hp).toBe(mobHp(1, 2));
    expect(s.duel.heroHp).toBe(HERO_MAX_HP);
  });

  it('farms the same stage with auto-advance off', () => {
    let s = strong({ autoAdvance: false, stage: 3 });
    s = runUntil(s, (x) => x.kills === 1 && x.duel.phase === 'intro');
    expect(s.stage).toBe(3);
  });

  it('boss at x.6 leads to the next world', () => {
    let s = strong({ stage: 6 });
    expect(s.duel.mob.kind).toBe('boss');
    s = runUntil(s, (x) => x.kills === 1 && x.duel.phase === 'intro');
    expect([s.world, s.stage]).toEqual([2, 1]);
  });
});

describe('hero death', () => {
  it('rolls back one stage and turns auto-advance off', () => {
    let s = weak({ world: 3, stage: 1 });
    s = runUntil(s, (x) => x.duel.phase === 'heroDying');
    expect(s.deaths).toBe(1);
    s = runUntil(s, (x) => x.duel.phase === 'intro');
    expect([s.world, s.stage, s.autoAdvance]).toEqual([2, 6, false]);
    expect(s.duel.heroHp).toBe(HERO_MAX_HP);
  });

  it('stays on 1.1 at the very start', () => {
    let s = createState({ ...newProgress(), world: 1, stage: 1 });
    s = { ...s, duel: { ...s.duel, mob: { ...s.duel.mob, hp: 1e9, maxHp: 1e9, damage: 1000 } } };
    s = runUntil(s, (x) => x.deaths === 1 && x.duel.phase === 'intro');
    expect([s.world, s.stage]).toEqual([1, 1]);
  });

  it('dead mob never hits back', () => {
    let s = strong({ world: 3, stage: 1 });
    const events: { tick: number; e: GameEvent }[] = [];
    s = run(s, 5, events);
    expect(events.some((x) => x.e.type === 'damage' && x.e.target === 'hero')).toBe(false);
  });

  it('hero wins a same-tick double KO', () => {
    let s = createState();
    // Both scheduled on the same tick, both lethal.
    s = {
      ...s,
      duel: {
        ...s.duel,
        heroHp: 1,
        mobNextHit: s.duel.heroNextHit,
        mob: { ...s.duel.mob, hp: 1, damage: 999 },
      },
    };
    s = runUntil(s, (x) => x.duel.phase !== 'intro' && x.duel.phase !== 'fighting');
    expect(s.duel.phase).toBe('mobDying');
    expect(s.duel.heroHp).toBe(1);
  });
});

describe('world 1 tutorial', () => {
  it('cuts mob HP in world 1 only', () => {
    expect(mobHp(1, 1)).toBe(2);
    expect(mobHp(2, 1)).toBe(Math.ceil(10 * 1.28 ** 6));
  });
});

describe('actions', () => {
  it('upgrade costs coins and raises the equipped weapon level', () => {
    const s = createState({ ...newProgress(), coins: 5 });
    const next = buyUpgrade(s);
    expect(next.coins).toBe(0);
    expect(next.weaponLevels[0]).toBe(2);
    expect(heroDamage(next)).toBe(2);
    expect(buyUpgrade(next)).toBe(next); // can't afford: unchanged, same object
  });

  it('weapon shop sells the next tier at level 1, equip is instant', () => {
    let s = createState({ ...newProgress(), coins: WEAPONS[1].price });
    s = buyWeapon(s);
    expect(s.coins).toBe(0);
    expect(s.weaponLevels[1]).toBe(1);
    expect(s.equipped).toBe(0);
    expect(buyWeapon(s)).toBe(s);
    s = equip(s, 1);
    expect(heroDamage(s)).toBe(WEAPONS[1].baseDmg);
    expect(equip(s, 3)).toBe(s); // not owned
  });

  it('coins never go negative', () => {
    const s = createState({ ...newProgress(), coins: 4 });
    expect(buyUpgrade(s).coins).toBe(4);
  });

  it('auto-advance toggle', () => {
    const s = createState();
    expect(setAutoAdvance(s, false).autoAdvance).toBe(false);
    expect(setAutoAdvance(s, true)).toBe(s);
  });

  it('does not mutate the input state', () => {
    const s = createState({ ...newProgress(), coins: 100 });
    const before = JSON.stringify(s);
    buyUpgrade(s);
    update(s, TICK);
    expect(JSON.stringify(s)).toBe(before);
  });
});
