import { describe, expect, it } from 'vitest';
import { newGear, type Item } from './game/items';
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
    const ring: Item = {
      id: 3,
      slot: 'ring',
      tier: 'B',
      world: 2,
      stage: 1,
      stats: { damage: 4, speed: 0.025 },
    };
    const bagItem: Item = {
      id: 5,
      slot: 'pendant',
      tier: 'C',
      world: 1,
      stage: 6,
      stats: { defence: 1 },
    };
    const items = { ring, pendant: null, bag: [bagItem], rng: 42, nextId: 6 };
    s = { ...s, weaponLevels: [7, 2, 0, 0, 0], equipped: 1, autoAdvance: false, best: 12, items };
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
      items,
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
    expect(progress).toEqual({
      ...newProgress(),
      weaponLevels: [1, 0, 0, 0, 0],
      items: { ...newGear(), rng: expect.any(Number) },
    });
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

  it('migrates a v1 save (no items) to empty gear and keeps the rest', () => {
    const v1 = JSON.stringify({ version: 1, world: 2, stage: 3, coins: 50, weaponLevels: [4, 1] });
    const { progress } = loadSave(storage(v1), 'k')!;
    expect([progress.world, progress.stage, progress.coins]).toEqual([2, 3, 50]);
    expect(progress.items).toEqual({ ...newGear(), rng: expect.any(Number) });
    expect(Number.isSafeInteger(progress.items.rng)).toBe(true);
  });

  it('drops broken or duplicate items and repairs nextId', () => {
    const good = { id: 2, slot: 'ring', tier: 'C', world: 1, stage: 1, stats: { damage: 1 } };
    const raw = JSON.stringify({
      items: {
        ring: { ...good, slot: 'pendant' }, // wrong slot
        pendant: { ...good, id: 9, slot: 'pendant' },
        bag: [good, good, { ...good, id: 4, tier: 'S' }, { ...good, id: 5, stats: { luck: 1 } }],
        rng: -3,
        nextId: 1,
      },
    });
    const { items } = loadSave(storage(raw), 'k')!.progress;
    expect(items.ring).toBeNull();
    expect(items.pendant?.id).toBe(9);
    expect(items.bag.map((i) => i.id)).toEqual([2]);
    expect(items.nextId).toBe(10);
    expect(items.rng).toBeGreaterThanOrEqual(0);
  });
});
