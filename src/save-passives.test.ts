import { describe, expect, it } from 'vitest';
import { newGear } from './game/items';
import { createState, newProgress } from './game/state';
import {
  decodeSave,
  encodeSave,
  loadSave,
  SAVE_VERSION,
  toSaveData,
  validateSaveData,
  writeSave,
} from './save';
import { loadPassives, loadPick, validatePassives, validatePick } from './save-passives';

const audio = { muted: false, track: 'synthwave', musicVolume: 0.5, sfxVolume: 0.5 };
const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
};
const withPicks = () =>
  createState({
    ...newProgress(),
    items: newGear(3),
    passives: [
      { id: 'speed', tier: 'C', level: 3 },
      { id: 'crit', tier: 'SS', level: 1 },
    ],
    pick: [
      { id: 'defence', tier: 'B' },
      { id: 'extra', tier: 'A' },
    ],
  });

describe('passives in the save', () => {
  it('round-trips the owned passives and the open offer (save string and storage)', () => {
    const data = toSaveData(withPicks(), audio, '0.5.0');
    expect(data.version).toBe(SAVE_VERSION);
    const decoded = decodeSave(encodeSave(data));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.progress.passives).toEqual(data.passives);
    expect(decoded.progress.pick).toEqual(data.pick);

    const store = memory();
    writeSave(store, 'k', data);
    const loaded = loadSave(store, 'k').saved!.progress;
    expect(loaded.passives).toEqual(withPicks().passives);
    expect(loaded.pick).toEqual(withPicks().pick);
    // And the game state built from it has them.
    expect(createState(loaded).passives).toEqual(loaded.passives);
  });

  it('an old save (version 7, no passives) loads unchanged with none', () => {
    const {
      passives: _p,
      pick: _k,
      ...old
    } = toSaveData(createState(newProgress()), audio, '0.5.0');
    const v7 = { ...old, version: 7 };
    const r = validateSaveData(v7);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.progress.passives).toEqual([]);
    expect(r.progress.pick).toBeNull();
    expect(r.progress.coins).toBe(old.coins);
    expect(r.progress.world).toBe(old.world);
  });

  it('a plain-JSON v1 save without the fields is repaired to none', () => {
    const store = memory();
    store.setItem('k', JSON.stringify({ coins: 12, world: 2, stage: 3 }));
    const p = loadSave(store, 'k').saved!.progress;
    expect(p.passives).toEqual([]);
    expect(p.pick).toBeNull();
    expect(p.coins).toBe(12);
  });

  it('the strict check lists problems and repairs nothing', () => {
    const base = toSaveData(withPicks(), audio, '0.5.0');
    const bad = validateSaveData({
      ...base,
      passives: [
        { id: 'nope', tier: 'C', level: 1 },
        { id: 'speed', tier: 'Z', level: 1 },
        { id: 'crit', tier: 'C', level: 0 },
      ],
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.filter((e) => e.startsWith('passives['))).toHaveLength(3);
    expect(
      validateSaveData({
        ...base,
        pick: [
          { id: 'speed', tier: 'C' },
          { id: 'speed', tier: 'B' },
        ],
      }).ok,
    ).toBe(false);
    expect(validateSaveData({ ...base, pick: [] }).ok).toBe(false);
    expect(validateSaveData({ ...base, pick: null }).ok).toBe(true);
  });
});

describe('lenient loaders', () => {
  it('drop bad passives, merge duplicates and survive any input', () => {
    expect(loadPassives(undefined)).toEqual([]);
    expect(loadPassives('x')).toEqual([]);
    expect(
      loadPassives([
        { id: 'speed', tier: 'C', level: 2 },
        { id: 'speed', tier: 'C', level: 3 },
        { id: 'ghost', tier: 'C', level: 1 },
        null,
        { id: 'crit', tier: 'B', level: 1.5 },
      ]),
    ).toEqual([{ id: 'speed', tier: 'C', level: 5 }]);
  });

  it('keep an offer only if it has a valid option, without duplicate passives', () => {
    expect(loadPick(null)).toBeNull();
    expect(loadPick([{ id: 'ghost', tier: 'C' }])).toBeNull();
    expect(
      loadPick([
        { id: 'speed', tier: 'B' },
        { id: 'speed', tier: 'S' },
        { id: 'crit', tier: 'A' },
        { id: 'extra', tier: 'C' },
      ]),
    ).toEqual([
      { id: 'speed', tier: 'B' },
      { id: 'crit', tier: 'A' },
    ]);
  });

  it('strict validators report instead of repairing', () => {
    const errors: string[] = [];
    expect(validatePassives('x', errors)).toBeNull();
    expect(validatePick([{ id: 'speed' }], errors)).toBeNull();
    expect(errors.length).toBe(2);
  });
});
