import { describe, expect, it } from 'vitest';
import { createState, newProgress } from './game/state';
import {
  backupKey,
  clearSave,
  decodeSave,
  encodeSave,
  fnv1a,
  loadSave,
  readSavePreview,
  toSaveData,
  writeSave,
  type AudioSettings,
} from './save';

const storage = (value: string | null) => ({ getItem: () => value });

/** In-memory localStorage stand-in. */
function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const audio = { muted: true, track: 'synthwave', musicVolume: 0.2, sfxVolume: 0.9 };
const dataAt = (world: number, stage: number, coins = 0) =>
  toSaveData(createState({ ...newProgress(), world, stage, best: 99, coins }), audio, '0.2.0');

/** Changes the last checksum digit. */
const tamper = (s: string) => s.slice(0, -1) + (s.endsWith('0') ? '1' : '0');

describe('encodeSave / decodeSave', () => {
  it('round-trips', () => {
    const data = dataAt(3, 4, 500);
    const text = encodeSave(data);
    expect(text).toMatch(/^AFK1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    const r = decodeSave(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual(data);
      expect(r.progress).toMatchObject({ world: 3, stage: 4, coins: 500 });
      expect(r.audio).toEqual(audio);
    }
  });

  it('round-trips non-ASCII text', () => {
    const data = { ...dataAt(1, 1), gameVersion: 'ünï ✓' };
    const r = decodeSave(encodeSave(data));
    expect(r.ok && r.data.gameVersion).toBe('ünï ✓');
  });

  it('rejects a wrong checksum and an edited payload', () => {
    const text = encodeSave(dataAt(1, 2));
    expect(decodeSave(tamper(text)).ok).toBe(false);
    const [prefix, payload, sum] = text.split('.');
    const swapped = payload[10] === 'A' ? 'B' : 'A';
    const edited = `${prefix}.${payload.slice(0, 10)}${swapped}${payload.slice(11)}.${sum}`;
    expect(decodeSave(edited).ok).toBe(false);
  });

  it('rejects garbage without throwing', () => {
    const signed = (json: string) => {
      const payload = btoa(json).replace(/=+$/, '');
      return `AFK1.${payload}.${fnv1a(payload)}`;
    };
    const garbage = [
      '',
      'AFK1',
      'AFK1..',
      'AFK1.x',
      'AFK2.abc.00000000',
      'AFK1.a.b.c',
      `AFK1.!!!!.${fnv1a('!!!!')}`,
      `AFK1.A.${fnv1a('A')}`, // impossible base64 length
      signed('not json'),
      signed('[1,2]'),
      signed('null'),
      signed('{"world":1}'), // fails the schema
      '{"world":1}',
      '\u0000￿',
    ];
    for (const g of garbage) {
      const r = decodeSave(g);
      expect(r.ok, g).toBe(false);
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
    }
  });

  it('checks the track only when a track list is given', () => {
    const text = encodeSave({ ...dataAt(1, 1), audio: { ...audio, track: 'gone' } });
    expect(decodeSave(text).ok).toBe(true);
    expect(decodeSave(text, ['medieval']).ok).toBe(false);
  });
});

describe('writeSave / loadSave', () => {
  it('writes a save string and keeps the previous save as the backup', () => {
    const s = memory();
    expect(writeSave(s, 'k', dataAt(1, 2))).toBe(true);
    const first = s.getItem('k');
    expect(first).toMatch(/^AFK1\./);
    expect(s.getItem(backupKey('k'))).toBeNull();
    writeSave(s, 'k', dataAt(1, 3));
    expect(s.getItem(backupKey('k'))).toBe(first);
    expect(loadSave(s, 'k')).toMatchObject({ status: 'ok', saved: { progress: { stage: 3 } } });
  });

  it('round-trips progress and audio settings', () => {
    let st = createState({ ...newProgress(), world: 2, stage: 4, coins: 123 });
    st = {
      ...st,
      weaponLevels: [7, 2, 0, 0, 0],
      equipped: 1,
      autoAdvance: false,
      best: 12,
      maxDps: 42,
    };
    const s = memory();
    writeSave(s, 'k', toSaveData(st, audio, '0.2.0'));
    const { saved, status } = loadSave(s, 'k');
    expect(status).toBe('ok');
    expect(saved!.progress).toEqual({
      world: 2,
      stage: 4,
      best: 12,
      autoAdvance: false,
      coins: 123,
      weaponLevels: [7, 2, 0, 0, 0],
      equipped: 1,
      kills: 0,
      deaths: 0,
      maxDps: 42,
    });
    expect(saved!.audio).toEqual(audio);
  });

  it('no save: status none', () => {
    expect(loadSave(memory(), 'k')).toEqual({ saved: null, status: 'none' });
    expect(loadSave(undefined, 'k')).toEqual({ saved: null, status: 'none' });
  });

  it('a tampered checksum falls back to the backup', () => {
    const s = memory();
    writeSave(s, 'k', dataAt(1, 2));
    writeSave(s, 'k', dataAt(1, 3));
    s.setItem('k', tamper(s.getItem('k')!));
    const r = loadSave(s, 'k');
    expect(r.status).toBe('backup');
    expect(r.saved!.progress.stage).toBe(2);
    expect(readSavePreview(s, 'k')).toEqual({ stage: '1.2' });
  });

  it('a broken save never overwrites a good backup', () => {
    const s = memory();
    writeSave(s, 'k', dataAt(1, 2));
    writeSave(s, 'k', dataAt(1, 3));
    const bak = s.getItem(backupKey('k'));
    s.setItem('k', 'garbage');
    writeSave(s, 'k', dataAt(1, 4));
    expect(s.getItem(backupKey('k'))).toBe(bak);
  });

  it('both broken: new game, reported', () => {
    const s = memory({ k: 'AFK1.zzz.00000000', [backupKey('k')]: '{oops' });
    expect(loadSave(s, 'k')).toEqual({ saved: null, status: 'reset' });
    expect(readSavePreview(s, 'k')).toBeNull();
    expect(loadSave(memory({ k: 'garbage' }), 'k').status).toBe('reset');
  });

  it('a save string that fails the schema counts as broken', () => {
    const bad = encodeSave({ ...dataAt(1, 1), coins: -5 });
    expect(loadSave(memory({ k: bad }), 'k').status).toBe('reset');
  });

  it('write failures are reported, not thrown', () => {
    const full = {
      getItem: () => null,
      setItem() {
        throw new Error('QuotaExceededError');
      },
    };
    expect(writeSave(full, 'k', dataAt(1, 1))).toBe(false);
    expect(writeSave(undefined, 'k', dataAt(1, 1))).toBe(false);
  });

  it('clearSave removes the save and the backup', () => {
    const s = memory();
    writeSave(s, 'k', dataAt(1, 2));
    writeSave(s, 'k', dataAt(1, 3));
    clearSave(s, 'k');
    expect(s.m.size).toBe(0);
  });
});

describe('v1 migration (plain JSON saves)', () => {
  const v1 = JSON.stringify({
    version: 1,
    gameVersion: '0.1.0',
    world: 2,
    stage: 5,
    best: 15,
    autoAdvance: true,
    coins: 4200,
    weaponLevels: [3, 1, 0, 0, 0],
    equipped: 1,
    kills: 40,
    deaths: 2,
    audio: { muted: false, track: 'medieval', musicVolume: 0.5, sfxVolume: 0.6 },
  });

  it('loads a v1 save and rewrites it as a save string on the next save', () => {
    const s = memory({ k: v1 });
    const { saved, status } = loadSave(s, 'k');
    expect(status).toBe('ok');
    expect(saved!.progress).toMatchObject({ world: 2, stage: 5, coins: 4200, kills: 40 });
    expect(readSavePreview(s, 'k')).toEqual({ stage: '2.5' });

    const st = createState(saved!.progress);
    writeSave(s, 'k', toSaveData(st, saved!.audio as AudioSettings, '0.3.0'));
    expect(s.getItem('k')).toMatch(/^AFK1\./);
    expect(s.getItem(backupKey('k'))).toBe(v1); // the old save is kept as the backup
    const again = loadSave(s, 'k');
    expect(again.status).toBe('ok');
    // A v1 save has no maxDps; createState raises it to the current DPS.
    expect(again.saved!.progress).toEqual({ ...saved!.progress, maxDps: st.maxDps });
  });

  it('repairs bad v1 values instead of crashing', () => {
    const bad = JSON.stringify({
      world: -1,
      stage: 9,
      coins: 'lots',
      weaponLevels: [0, 1.5, null],
      equipped: 3,
      autoAdvance: 'yes',
      audio: { muted: 1, musicVolume: 2 },
    });
    const { saved } = loadSave(storage(bad), 'k');
    expect(saved!.progress).toEqual({ ...newProgress(), weaponLevels: [1, 0, 0, 0, 0] });
    expect(saved!.audio).toEqual({});
  });
});

describe('readSavePreview', () => {
  it('returns null without a usable save', () => {
    expect(readSavePreview(storage(null), 'k')).toBeNull();
    expect(readSavePreview(undefined, 'k')).toBeNull();
    expect(readSavePreview(storage('{oops'), 'k')).toBeNull();
  });

  it('reads world.stage from both formats', () => {
    expect(readSavePreview(storage(JSON.stringify({ world: 2, stage: 3 })), 'k')).toEqual({
      stage: '2.3',
    });
    expect(readSavePreview(storage(encodeSave(dataAt(4, 6))), 'k')).toEqual({ stage: '4.6' });
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
