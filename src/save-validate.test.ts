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
});
