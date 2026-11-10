import { describe, expect, it } from 'vitest';
import { newGear, rollDrop } from '../game/items';
import { createState, newProgress, type Progress } from '../game/state';
import { encodeSave, toSaveData } from '../save';
import { parseSaveText, SAVE_ERRORS, saveFileName, savePreviewText, toImport } from './save-panel';

const audio = { muted: true, track: 'synthwave', musicVolume: 0.2, sfxVolume: 0.9 };
const progress = (over: Partial<Progress> = {}): Progress => ({ ...newProgress(), ...over });
const saveOf = (p: Progress) => toSaveData(createState(p), audio, '0.0.0');

describe('parseSaveText', () => {
  it('reads a save string', () => {
    const p = progress({ world: 3, stage: 4, best: 20, coins: 12400 });
    const r = parseSaveText(`  ${encodeSave(saveOf(p))}\n`);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.progress.coins).toBe(12400);
      expect(r.audio).toEqual(audio);
    }
  });

  it('reads a plain-JSON v1 save, repairing what is missing', () => {
    const r = parseSaveText(JSON.stringify({ world: 2, stage: 3, coins: 50 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.progress.world, r.progress.stage, r.progress.coins]).toEqual([2, 3, 50]);
  });

  it('explains bad input', () => {
    const text = encodeSave(saveOf(progress()));
    const tampered = text.slice(0, -1) + (text.endsWith('0') ? '1' : '0');
    expect(parseSaveText('   ')).toEqual({ ok: false, error: SAVE_ERRORS.empty });
    expect(parseSaveText('hello')).toEqual({ ok: false, error: SAVE_ERRORS.notSave });
    expect(parseSaveText('{nope')).toEqual({ ok: false, error: SAVE_ERRORS.notSave });
    expect(parseSaveText('{"a":1}')).toEqual({ ok: false, error: SAVE_ERRORS.notJsonSave });
    expect(parseSaveText(tampered)).toEqual({ ok: false, error: SAVE_ERRORS.checksum });
    expect(SAVE_ERRORS.notSave).toMatch(/^Not a save string/);
    expect(SAVE_ERRORS.checksum).toMatch(/^Checksum doesn't match/);
  });

  it('lists schema problems of a correctly signed save', () => {
    const r = parseSaveText(encodeSave({ ...saveOf(progress()), coins: -1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^This save has problems: coins must be/);
  });

  it('checks the track against the known tracks', () => {
    expect(parseSaveText(encodeSave(saveOf(progress())), ['chill']).ok).toBe(false);
  });
});

describe('savePreviewText', () => {
  it('sums up stage, coins, companion and items', () => {
    let items = newGear(1);
    items = rollDrop(items, 1, 1, true).gear;
    items = rollDrop(items, 1, 1, true).gear;
    const companions = { crow: 1, wolf: 0 };
    expect(savePreviewText(progress({ world: 3, stage: 4, coins: 12400, items, companions }))).toBe(
      'Stage 3.4, 12,400 coins, crow, 2 items',
    );
    expect(savePreviewText(progress({ companions: { crow: 3, wolf: 2 } }))).toContain(
      'crow + wolf',
    );
    expect(savePreviewText(progress({ coins: 0 }))).toBe(
      'Stage 1.1, 0 coins, no companion, 0 items',
    );
  });
});

describe('saveFileName', () => {
  it('uses the local date', () => {
    expect(saveFileName(new Date(2026, 0, 5))).toBe('afk-save-2026-01-05.txt');
  });
});

describe('toImport', () => {
  it('keeps current audio the save does not set', () => {
    const current = saveOf(progress());
    const r = parseSaveText(JSON.stringify({ world: 2, stage: 1, audio: { muted: false } }));
    if (!r.ok) throw new Error(r.error);
    const data = toImport(current, r);
    expect(data.world).toBe(2);
    expect(data.audio).toEqual({ ...audio, muted: false });
    expect(data.version).toBe(current.version);
  });
});
