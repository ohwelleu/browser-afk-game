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
