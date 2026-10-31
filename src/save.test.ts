import { describe, expect, it } from 'vitest';
import { createState, newProgress } from './game/state';
import { loadSave, readSavePreview, toSaveData, writeSave } from './save';

const storage = (value: string | null) => ({ getItem: () => value });

describe('readSavePreview', () => {
  it('returns null without a save', () => {
    expect(readSavePreview(storage(null), 'k')).toBeNull();
    expect(readSavePreview(undefined, 'k')).toBeNull();
  });

  it('reads world.stage', () => {
    expect(readSavePreview(storage(JSON.stringify({ world: 2, stage: 3 })), 'k')).toEqual({
      stage: '2.3',
    });
  });

  it('handles saves without a stage and broken JSON', () => {
    expect(readSavePreview(storage('{}'), 'k')).toEqual({ stage: null });
    expect(readSavePreview(storage('{oops'), 'k')).toBeNull();
  });

  it('survives storage that throws', () => {
    const blocked = {
      getItem(): string | null {
        throw new Error('SecurityError');
      },
    };
    expect(readSavePreview(blocked, 'k')).toBeNull();
  });
});

describe('loadSave / toSaveData', () => {
  it('round-trips progress and audio settings', () => {
    let s = createState({ ...newProgress(), world: 2, stage: 4, coins: 123 });
    s = { ...s, weaponLevels: [7, 2, 0, 0, 0], equipped: 1, autoAdvance: false, best: 12 };
    const audio = { muted: true, track: 'synthwave', musicVolume: 0.2, sfxVolume: 0.9 };
    const data = toSaveData(s, audio, '0.2.0');
    let written = '';
    expect(writeSave({ setItem: (_k, v) => (written = v) }, 'k', data)).toBe(true);
    const loaded = loadSave(storage(written), 'k')!;
    expect(loaded.progress).toEqual({
      world: 2,
      stage: 4,
      best: 12,
      autoAdvance: false,
      coins: 123,
      weaponLevels: [7, 2, 0, 0, 0],
      equipped: 1,
      kills: 0,
      deaths: 0,
    });
    expect(loaded.audio).toEqual(audio);
  });

  it('repairs bad values instead of crashing', () => {
    const bad = JSON.stringify({
      world: -1,
      stage: 9,
      coins: 'lots',
      weaponLevels: [0, 1.5, null],
      equipped: 3,
      autoAdvance: 'yes',
      audio: { muted: 1, musicVolume: 2 },
    });
    const { progress, audio } = loadSave(storage(bad), 'k')!;
    expect(progress).toEqual({ ...newProgress(), weaponLevels: [1, 0, 0, 0, 0] });
    expect(audio).toEqual({});
  });

  it('write failures are reported, not thrown', () => {
    const full = {
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    const audio = { muted: false, track: 'medieval', musicVolume: 0.5, sfxVolume: 0.6 };
    const data = toSaveData(createState(), audio, '0.2.0');
    expect(writeSave(full, 'k', data)).toBe(false);
  });
});
