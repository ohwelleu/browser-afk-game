import { describe, expect, it } from 'vitest';
import { createState } from './game/state';
import { toSaveData, validateSaveData } from './save';

const TRACKS = ['medieval', 'synthwave', ''];
const audio = { muted: false, track: 'medieval', musicVolume: 0.5, sfxVolume: 0.6 };
const valid = () => JSON.parse(JSON.stringify(toSaveData(createState(), audio, '0.2.0')));

describe('validateSaveData', () => {
  it('accepts a save written by the game', () => {
    const r = validateSaveData(valid(), TRACKS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.progress.stage).toBe(1);
      expect(r.audio).toEqual(audio);
    }
  });

  it('accepts edited values in range', () => {
    const d = {
      ...valid(),
      world: 3,
      stage: 6,
      best: 20,
      coins: 999,
      weaponLevels: [4, 2, 1, 0, 0],
    };
    d.equipped = 2;
    expect(validateSaveData(d, TRACKS).ok).toBe(true);
  });

  it.each([
    ['world', 0],
    ['world', 1.5],
    ['stage', 7],
    ['coins', -1],
    ['coins', Number.NaN],
    ['coins', '12'],
    ['best', 0],
    ['autoAdvance', 'yes'],
    ['equipped', 3],
    ['kills', null],
    ['maxDps', -1],
    ['maxDps', undefined],
  ])('rejects %s = %s', (key, value) => {
    const r = validateSaveData({ ...valid(), [key]: value }, TRACKS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain(key);
  });

  it('rejects best below the current stage', () => {
    const r = validateSaveData({ ...valid(), world: 2, stage: 3, best: 4 }, TRACKS);
    expect(r.ok).toBe(false);
  });

  it('rejects broken weapon levels and audio', () => {
    expect(validateSaveData({ ...valid(), weaponLevels: [0, 0, 0, 0, 0] }, TRACKS).ok).toBe(false);
    expect(validateSaveData({ ...valid(), weaponLevels: [1, 0] }, TRACKS).ok).toBe(false);
    const badAudio = { ...valid(), audio: { ...audio, track: 'jazz', sfxVolume: 2 } };
    const r = validateSaveData(badAudio, TRACKS);
    expect(r.ok ? [] : r.errors).toHaveLength(2);
  });

  it('checks revealedWeapons strictly', () => {
    const ok = validateSaveData(
      { ...valid(), revealedWeapons: [false, false, true, false, false] },
      TRACKS,
    );
    // The owned stick always counts as revealed.
    expect(ok.ok && ok.progress.revealedWeapons).toEqual([true, false, true, false, false]);
    for (const revealedWeapons of [null, [], [true, false], [1, 0, 0, 0, 0], undefined]) {
      const r = validateSaveData({ ...valid(), revealedWeapons }, TRACKS);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join(' ')).toContain('revealedWeapons');
    }
  });

  it('checks character levels strictly', () => {
    const ok = validateSaveData(
      { ...valid(), character: { defenceLevel: 4, critLevel: 2, hpLevel: 3 } },
      TRACKS,
    );
    expect(ok.ok && ok.progress.character).toEqual({ defenceLevel: 4, critLevel: 2, hpLevel: 3 });
    for (const character of [
      null,
      [],
      { defenceLevel: -1, critLevel: 0, hpLevel: 0 },
      { defenceLevel: 1.5, critLevel: 0, hpLevel: 0 },
      { defenceLevel: 0, critLevel: -1, hpLevel: 0 },
      { defenceLevel: 0, critLevel: 2.5, hpLevel: 0 },
      { defenceLevel: 0, critLevel: 0, hpLevel: -1 },
      { defenceLevel: 0, critLevel: 0, hpLevel: 2.5 },
      { defenceLevel: 0, critLevel: 0 },
      { defenceLevel: 0 },
      {},
    ]) {
      const r = validateSaveData({ ...valid(), character }, TRACKS);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.join(' ')).toContain('character');
    }
  });

  it('accepts an S+ item and rejects an unknown tier', () => {
    const item = {
      id: 1,
      slot: 'ring',
      tier: 'SS',
      world: 1,
      stage: 2,
      stats: { damage: 4, defence: 1, speed: 0.04, crit: 0.04 },
    };
    const save = (it: unknown) => ({
      ...valid(),
      items: { ring: it, pendant: null, earring: null, belt: null, bag: [], rng: 7, nextId: 2 },
    });
    const r = validateSaveData(save(item), TRACKS);
    expect(r.ok && r.progress.items.ring).toEqual(item);
    for (const tier of ['S+', 'SSS', 'X', '']) {
      const bad = validateSaveData(save({ ...item, tier }), TRACKS);
      expect(bad.ok).toBe(false);
      if (!bad.ok) expect(bad.errors.join(' ')).toContain('tier must be');
    }
  });

  it('accepts earring and belt, and old saves without them', () => {
    const earring = {
      id: 1,
      slot: 'earring',
      tier: 'B',
      world: 1,
      stage: 2,
      stats: { crit: 0.03, itemFind: 0.07 },
    };
    const belt = { id: 2, slot: 'belt', tier: 'C', world: 1, stage: 2, stats: { defence: 2 } };
    const gear = { ring: null, pendant: null, earring, belt, bag: [], rng: 7, nextId: 3 };
    const r = validateSaveData({ ...valid(), items: gear }, TRACKS);
    expect(r.ok && r.progress.items).toEqual(gear);

    const old = { ring: null, pendant: null, bag: [], rng: 7, nextId: 1 };
    const o = validateSaveData({ ...valid(), items: old }, TRACKS);
    expect(o.ok && o.progress.items).toEqual({ ...old, earring: null, belt: null });
  });

  it('rejects an earring or belt in the wrong slot', () => {
    const belt = { id: 2, slot: 'belt', tier: 'C', world: 1, stage: 2, stats: { defence: 2 } };
    const gear = {
      ring: null,
      pendant: null,
      earring: belt,
      belt: null,
      bag: [],
      rng: 7,
      nextId: 3,
    };
    const r = validateSaveData({ ...valid(), items: gear }, TRACKS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual(['items.earring must hold a earring.']);
  });

  it('rejects non-objects', () => {
    expect(validateSaveData(null, TRACKS).ok).toBe(false);
    expect(validateSaveData([1, 2], TRACKS).ok).toBe(false);
  });

  it('accepts edited items and rejects broken ones', () => {
    const item = {
      id: 1,
      slot: 'ring',
      tier: 'B',
      world: 1,
      stage: 2,
      stats: { damage: 2, speed: 0.03 },
    };
    const ok = { ...valid(), items: { ring: item, pendant: null, bag: [], rng: 7, nextId: 2 } };
    const r = validateSaveData(ok, TRACKS);
    expect(r.ok && r.progress.items.ring).toEqual(item);

    const bad = {
      ...valid(),
      items: {
        ring: { ...item, slot: 'pendant' },
        pendant: null,
        bag: [{ ...item, stats: { damage: 2 } }],
        rng: 1.5,
        nextId: 1,
      },
    };
    const res = validateSaveData(bad, TRACKS);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors).toEqual([
        'items.ring must hold a ring.',
        'items.bag[0]: a B item has 2 stats.',
        'items.rng must be a whole number from 0 to 4294967295.',
        'items.nextId must be a whole number above every item id (1).',
      ]);
    }
  });

  it('requires items', () => {
    const { items: _, ...noItems } = valid();
    const r = validateSaveData(noItems, TRACKS);
    expect(!r.ok && r.errors).toEqual(['items must be an object.']);
  });

  it('accepts a companion or an empty slot, and migrates v1 saves', () => {
    const crow = { id: 'crow', dmgLevel: 5, autoUnlocked: true, speedLevel: 21 };
    const r = validateSaveData({ ...valid(), companion: crow }, TRACKS);
    expect(r.ok && r.progress.companion).toEqual(crow);
    expect(validateSaveData({ ...valid(), companion: null }, TRACKS).ok).toBe(true);
    const v1 = { ...valid(), version: 1 };
    delete v1.companion;
    const m = validateSaveData(v1, TRACKS);
    expect(m.ok && m.progress.companion).toBeNull();
  });

  it.each([
    [{ id: 'dragon', dmgLevel: 1, autoUnlocked: false, speedLevel: 1 }, 'companion.id'],
    [{ id: 'crow', dmgLevel: 0, autoUnlocked: false, speedLevel: 1 }, 'companion.dmgLevel'],
    [{ id: 'crow', dmgLevel: 1, autoUnlocked: 1, speedLevel: 1 }, 'companion.autoUnlocked'],
    [{ id: 'crow', dmgLevel: 1, autoUnlocked: true, speedLevel: 22 }, 'companion.speedLevel'],
    ['crow', 'companion must be'],
  ])('rejects companion %j', (companion, msg) => {
    const r = validateSaveData({ ...valid(), companion }, TRACKS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toContain(msg);
  });

  it('requires the companion field on current saves', () => {
    const d = valid();
    delete d.companion;
    expect(validateSaveData(d, TRACKS).ok).toBe(false);
  });
});
