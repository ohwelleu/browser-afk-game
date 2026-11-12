import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import { ASCEND_SPEED_PER, DUEL, HERO_MAX_HP, mobCoins, mobHp, WEAPONS } from './balance';
import { newGear, type Item } from './items';
import {
  buyUpgrade,
  buyWeapon,
  createState,
  equip,
  heroDamage,
  heroDps,
  heroSpeed,
  newProgress,
  secToTicks,
  setAutoAdvance,
  stageSwitchTarget,
  switchStage,
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

describe('ascend speed', () => {
  const ring = (speed: number): Item => ({
    id: 1,
    slot: 'ring',
    tier: 'S',
    world: 1,
    stage: 1,
    stats: { speed },
  });
  const interval = (p: Partial<Progress>) => {
    const events: { tick: number; e: GameEvent }[] = [];
    run(weak({ world: 3, stage: 6, ...p }), 4.5, events);
    const t = events
      .filter((x) => x.e.type === 'damage' && x.e.target === 'mob')
      .map((x) => x.tick);
    return t[2] - t[1];
  };

  it('each ascend shortens the hero attack interval by +10 % speed', () => {
    expect(interval({ ascends: 0 })).toBe(secToTicks(1));
    expect(interval({ ascends: 1 })).toBe(secToTicks(1 / 1.1));
    expect(interval({ ascends: 5 })).toBe(secToTicks(1 / 1.5));
  });

  it('adds to the gear speed, and the item cap (0.25) stays on items only', () => {
    // Two rings' worth of speed (0.4) is capped to 0.25; 2 ascends add 0.2 on top.
    const items = { ...newGear(1), ring: ring(0.4) };
    expect(heroSpeed({ items, ascends: 0 })).toBeCloseTo(0.25);
    expect(heroSpeed({ items, ascends: 2 })).toBeCloseTo(0.25 + 2 * ASCEND_SPEED_PER);
    expect(interval({ items, ascends: 2 })).toBe(secToTicks(1 / 1.45));
  });

  it('counts in the DPS', () => {
    const base = { weaponLevels: [100, 0, 0, 0, 0] };
    expect(heroDps(createState({ ...newProgress(), ...base }))).toBe(100);
    expect(heroDps(createState({ ...newProgress(), ...base, ascends: 3 }))).toBe(130);
    expect(createState({ ...newProgress(), ...base, ascends: 3 }).maxDps).toBe(130);
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

  it('weapon shop sells the next tier at level 1 and equips it when stronger', () => {
    let s = createState({ ...newProgress(), coins: WEAPONS[1].price });
    s = buyWeapon(s);
    expect(s.coins).toBe(0);
    expect(s.weaponLevels[1]).toBe(1);
    expect(s.equipped).toBe(1);
    expect(heroDamage(s)).toBe(WEAPONS[1].baseDmg);
    expect(s.events).toContainEqual({ type: 'save' });
    expect(buyWeapon(s)).toBe(s);
  });

  it('buying keeps a stronger, upgraded weapon equipped', () => {
    let s = createState({
      ...newProgress(),
      coins: WEAPONS[1].price,
      weaponLevels: [1000, 0, 0, 0, 0],
    });
    const before = heroDamage(s);
    s = buyWeapon(s);
    expect(s.weaponLevels[1]).toBe(1);
    expect(s.equipped).toBe(0);
    expect(heroDamage(s)).toBe(before);
  });

  it('equip is instant and a no-op for unowned weapons', () => {
    let s = createState({ ...newProgress(), weaponLevels: [1000, 1, 0, 0, 0] });
    s = equip(s, 1);
    expect(s.equipped).toBe(1);
    expect(heroDamage(s)).toBe(WEAPONS[1].baseDmg);
    expect(s.events).toContainEqual({ type: 'save' });
    expect(equip(s, 3)).toBe(s); // not owned
    expect(equip(s, 99)).toBe(s); // no such tier
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

describe('max DPS', () => {
  it('DPS is damage per hit ÷ seconds between attacks', () => {
    expect(heroDps(createState())).toBe(1); // stick lvl 1, 1 hit/s
    expect(heroDps(createState({ ...newProgress(), weaponLevels: [5, 0, 0, 0, 0] }))).toBe(5);
  });

  it('old saves without maxDps start at the current DPS', () => {
    const s = createState({ ...newProgress(), weaponLevels: [7, 0, 0, 0, 0], maxDps: 0 });
    expect(s.maxDps).toBe(7);
    expect(createState({ ...newProgress(), maxDps: 99 }).maxDps).toBe(99);
  });

  it('rises on upgrade and equip, never drops on equipping a weaker weapon', () => {
    let s = createState({ ...newProgress(), coins: 5 });
    s = buyUpgrade(s);
    expect(s.maxDps).toBe(2);
    s = createState({ ...newProgress(), weaponLevels: [1, 1, 0, 0, 0] });
    s = equip(s, 1);
    expect(s.maxDps).toBe(WEAPONS[1].baseDmg);
    s = equip(s, 0);
    expect(heroDps(s)).toBe(1);
    expect(s.maxDps).toBe(WEAPONS[1].baseDmg);
  });

  it('fighting does not change it', () => {
    const s = run(strong(), 10);
    expect(s.maxDps).toBe(1000);
  });
});

describe('stage switch', () => {
  const at = (world: number, stage: number, best: number, p: Partial<Progress> = {}) =>
    weak({ world, stage, best, ...p });
  const pos = (s: GameState) => [s.world, s.stage];

  it('back at 1.1 stays put', () => {
    const s = at(1, 1, 1);
    expect(switchStage(s, 'prev')).toBe(s);
    expect(stageSwitchTarget(s, 'prev')).toBeNull();
  });

  it('back goes one stage, and across a world boundary 2.1 → 1.6', () => {
    expect(pos(switchStage(at(1, 4, 4), 'prev'))).toEqual([1, 3]);
    expect(pos(switchStage(at(2, 1, 7), 'prev'))).toEqual([1, 6]);
  });

  it('next is locked above the best stage', () => {
    const s = at(1, 3, 3);
    expect(switchStage(s, 'next')).toBe(s);
    expect(stageSwitchTarget(s, 'next')).toBeNull();
    const boss = at(1, 6, 6);
    expect(switchStage(boss, 'next')).toBe(boss);
  });

  it('next works when unlocked', () => {
    expect(pos(switchStage(at(1, 2, 5), 'next'))).toEqual([1, 3]);
    expect(stageSwitchTarget(at(1, 5, 5), 'next')).toBeNull();
  });

  it('next crosses a world boundary 1.6 → 2.1 when unlocked', () => {
    expect(pos(switchStage(at(1, 6, 7), 'next'))).toEqual([2, 1]);
    // 2.1 is level 7: best 6 keeps it locked.
    expect(stageSwitchTarget(at(1, 6, 6), 'next')).toBeNull();
  });

  it('starts a fresh short duel, keeps the haul and plays no stage clear', () => {
    const base = at(3, 3, 16, { coins: 123, autoAdvance: true });
    const hurt = run(base, 2.2);
    expect(hurt.duel.phase).toBe('fighting');
    const s = switchStage(hurt, 'next');
    expect(pos(s)).toEqual([3, 4]);
    expect(s.duel.phase).toBe('intro');
    expect(s.duel.tick).toBe(0);
    expect(s.duel.heroHp).toBe(HERO_MAX_HP);
    expect(s.duel.mob.hp).toBe(mobHp(3, 4));
    expect(s.duel.introTicks).toBe(secToTicks(DUEL.shortIntro));
    expect(s.coins).toBe(hurt.coins);
    expect(s.weaponLevels).toEqual(hurt.weaponLevels);
    expect(s.best).toBe(16);
    expect(s.events).toEqual([{ type: 'save' }]);
  });

  it('leaves auto-advance as it is', () => {
    expect(switchStage(at(1, 3, 5, { autoAdvance: true }), 'prev').autoAdvance).toBe(true);
    expect(switchStage(at(1, 3, 5, { autoAdvance: false }), 'prev').autoAdvance).toBe(false);
  });

  it('is not allowed while the hero is dying (the rollback still applies)', () => {
    const dead = runUntil(
      weak({ world: 3, stage: 2, best: 14 }),
      (x) => x.duel.phase === 'heroDying',
    );
    expect(stageSwitchTarget(dead, 'prev')).toBeNull();
    expect(switchStage(dead, 'prev')).toBe(dead);
    // After the death the hero is on the rolled-back stage and may switch again.
    const gap = runUntil(dead, (x) => x.duel.phase === 'transition');
    expect(pos(gap)).toEqual([3, 1]);
    expect(pos(switchStage(gap, 'prev'))).toEqual([2, 6]);
  });

  it('a win still resolving keeps its unlock when the player switches away', () => {
    // Auto on, mob dying on 1.3 (best 3): going back must still unlock 1.4.
    const won = runUntil(strong({ stage: 3, best: 3 }), (x) => x.duel.phase === 'mobDying');
    expect(won.stage).toBe(3);
    const back = switchStage(won, 'prev');
    expect(pos(back)).toEqual([1, 2]);
    expect(back.best).toBe(4);
    expect(pos(switchStage(back, 'next'))).toEqual([1, 3]);
    // 1.4 is a new stage: the full intro, like the normal advance.
    const fwd = switchStage(won, 'next');
    expect(pos(fwd)).toEqual([1, 4]);
    expect(fwd.duel.introTicks).toBe(secToTicks(DUEL.intro));
    expect(fwd.best).toBe(4);
    // Auto off: no advance was pending, so 1.4 stays locked.
    const off = runUntil(
      strong({ stage: 3, best: 3, autoAdvance: false }),
      (x) => x.duel.phase === 'mobDying',
    );
    expect(stageSwitchTarget(off, 'next')).toBeNull();
    expect(switchStage(off, 'prev').best).toBe(3);
  });

  it('in the transition after a win the advanced stage counts as reached', () => {
    const gap = runUntil(strong({ stage: 3, best: 3 }), (x) => x.duel.phase === 'transition');
    expect(pos(gap)).toEqual([1, 4]);
    const back = switchStage(gap, 'prev');
    expect(pos(back)).toEqual([1, 3]);
    expect(back.best).toBe(4);
  });

  it('does not mutate the old state', () => {
    const s = at(1, 4, 4);
    switchStage(s, 'prev');
    expect(pos(s)).toEqual([1, 4]);
  });

  it('a death after switching still rolls back and turns auto off', () => {
    let s = switchStage(at(3, 3, 16, { autoAdvance: true }), 'next');
    s = runUntil(s, (x) => x.duel.phase === 'transition');
    expect([s.world, s.stage, s.autoAdvance]).toEqual([3, 3, false]);
  });
});

describe('buying a weapon equips it when it hits at least as hard', () => {
  /** A ring that adds `damage` flat hit damage, worn from the start. */
  const withRing = (damage: number, p: Partial<Progress> = {}) => {
    const items = newGear(1);
    items.ring = { id: 1, slot: 'ring', tier: 'C', world: 1, stage: 1, stats: { damage } };
    return createState({ ...newProgress(), items, ...p });
  };

  it('equips the new weapon even with flat item damage worn (gear counts on both sides)', () => {
    // Stick lvl 1 + a +500 ring hits for 501. The new weapon must be compared with the ring
    // too, not on its own (its base damage alone is far below 501).
    let s = withRing(500, { coins: WEAPONS[1].price });
    s = buyWeapon(s);
    expect(s.weaponLevels[1]).toBe(1);
    expect(s.equipped).toBe(1);
    expect(heroDamage(s)).toBe(WEAPONS[1].baseDmg + 500);
  });

  it('still keeps a stronger, upgraded weapon equipped with flat item damage worn', () => {
    let s = withRing(500, { coins: WEAPONS[1].price, weaponLevels: [1000, 0, 0, 0, 0] });
    s = buyWeapon(s);
    expect(s.weaponLevels[1]).toBe(1);
    expect(s.equipped).toBe(0);
  });

  it('equips on equal damage (>=), keeps the old weapon when it hits harder', () => {
    // Stick damage = level; the wooden sword at level 1 hits for 6.
    const buyWith = (stickLevel: number) =>
      buyWeapon(
        createState({
          ...newProgress(),
          coins: WEAPONS[1].price,
          weaponLevels: [stickLevel, 0, 0, 0, 0],
        }),
      );
    expect(buyWith(5).equipped).toBe(1); // 5 < 6
    expect(buyWith(6).equipped).toBe(1); // 6 = 6: a tie equips
    expect(buyWith(7).equipped).toBe(0); // 7 > 6: base damage is higher, but the stick hits harder now
  });

  it('after an ascend, items stay worn and the first buy still equips', () => {
    // An ascend resets weapons to the stick; the ring stays. Same comparison as before.
    const worn = withRing(500, { ascends: 1, coins: WEAPONS[1].price });
    expect(worn.equipped).toBe(0);
    const s = buyWeapon(worn);
    expect(s.equipped).toBe(1);
  });
});
