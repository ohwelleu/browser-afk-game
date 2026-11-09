import { describe, expect, it } from 'vitest';
import { newGear, type Item } from './game/items';
import { createState, newProgress } from './game/state';
import {
  backupKey,
  clearSave,
  decodeSave,
  encodeSave,
  fnv1a,
  loadSave,
  migrateSave,
  readSavePreview,
  SAVE_VERSION,
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
      revealedWeapons: [true, true, false, false, false],
      equipped: 1,
      kills: 0,
      deaths: 0,
      maxDps: 42,
      items: st.items,
      companion: null,
      character: { defenceLevel: 0, critLevel: 0, hpLevel: 0 },
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
    expect(saved!.progress).toEqual({
      ...newProgress(),
      weaponLevels: [1, 0, 0, 0, 0],
      items: { ...newGear(), rng: expect.any(Number) },
      companion: null,
    });
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

describe('items in the save (v2)', () => {
  const load = (raw: string) => loadSave(memory({ k: raw }), 'k').saved!;

  it('round-trips gear', () => {
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
    const st = { ...createState(), items };
    const s = memory();
    writeSave(s, 'k', toSaveData(st, audio, '0.2.0'));
    expect(loadSave(s, 'k').saved!.progress.items).toEqual(items);
  });

  it('round-trips an S+ item (internal tier id SS)', () => {
    const ss: Item = {
      id: 1,
      slot: 'pendant',
      tier: 'SS',
      world: 4,
      stage: 3,
      stats: { damage: 40, defence: 6, speed: 0.08, crit: 0.08 },
    };
    const items = {
      ring: null,
      pendant: ss,
      bag: [{ ...ss, id: 2, slot: 'ring' as const }],
      rng: 9,
      nextId: 3,
    };
    const s = memory();
    writeSave(s, 'k', toSaveData({ ...createState(), items }, audio, '0.2.0'));
    expect(loadSave(s, 'k').saved!.progress.items).toEqual(items);
  });

  it('migrates a v1 save (no items) to empty gear and keeps the rest', () => {
    const v1 = JSON.stringify({ version: 1, world: 2, stage: 3, coins: 50, weaponLevels: [4, 1] });
    const { progress } = load(v1);
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
    const { items } = load(raw).progress;
    expect(items.ring).toBeNull();
    expect(items.pendant?.id).toBe(9);
    expect(items.bag.map((i) => i.id)).toEqual([2]);
    expect(items.nextId).toBe(10);
    expect(items.rng).toBeGreaterThanOrEqual(0);
  });
});

describe('companion in the save (v3)', () => {
  const load = (raw: string) => loadSave(memory({ k: raw }), 'k').saved!;

  it('keeps the companion across a save round trip', () => {
    const companion = { id: 'crow' as const, dmgLevel: 4, autoUnlocked: true, speedLevel: 3 };
    const st = createState({ ...newProgress(), stage: 2, companion });
    const data = toSaveData(st, audio, '0.3.0');
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.companion).toEqual(companion);
    const s = memory();
    writeSave(s, 'k', data);
    expect(loadSave(s, 'k').saved!.progress.companion).toEqual(companion);
  });

  it('repairs a broken companion in a plain JSON save', () => {
    const comp = (companion: unknown) =>
      load(JSON.stringify({ version: 2, companion })).progress.companion;
    expect(comp({ id: 'dragon', dmgLevel: 3 })).toBeNull();
    expect(comp('crow')).toBeNull();
    expect(comp({ id: 'crow', dmgLevel: 0, autoUnlocked: 'yes', speedLevel: 99 })).toEqual({
      id: 'crow',
      dmgLevel: 1,
      autoUnlocked: false,
      speedLevel: 21,
    });
  });
});

describe('save migration', () => {
  it('v1/v2 saves (and saves without a version) get an empty companion slot', () => {
    const want = {
      version: SAVE_VERSION,
      coins: 5,
      companion: null,
      character: { defenceLevel: 0, critLevel: 0, hpLevel: 0 },
      revealedWeapons: [true, false, false, false, false],
    };
    expect(migrateSave({ version: 1, coins: 5 })).toEqual(want);
    expect(migrateSave({ version: 2, coins: 5 })).toEqual(want);
    expect(migrateSave({ coins: 5 })).toEqual(want);
  });

  it('does not touch current or newer saves, nor its input', () => {
    const current = { version: SAVE_VERSION, companion: { id: 'crow' } };
    expect(migrateSave(current)).toEqual(current);
    const v1 = { version: 1 };
    migrateSave(v1);
    expect(v1).toEqual({ version: 1 });
    expect(migrateSave({ version: 99 })).toEqual({ version: 99 });
  });

  it('loads a real plain-JSON v1 save from 0.2.0 (the live site today)', () => {
    const v1 = {
      version: 1,
      gameVersion: '0.2.0',
      world: 1,
      stage: 3,
      best: 3,
      autoAdvance: true,
      coins: 40,
      weaponLevels: [3, 0, 0, 0, 0],
      equipped: 0,
      kills: 12,
      deaths: 0,
      audio: { muted: false, track: 'medieval', musicVolume: 0.5, sfxVolume: 0.6 },
    };
    const { saved, status } = loadSave(memory({ k: JSON.stringify(v1) }), 'k');
    expect(status).toBe('ok');
    expect(saved!.progress).toEqual({
      ...newProgress(),
      stage: 3,
      best: 3,
      coins: 40,
      weaponLevels: [3, 0, 0, 0, 0],
      kills: 12,
      items: { ...newGear(), rng: expect.any(Number) },
      companion: null,
    });
  });
});

describe('character upgrades in the save (v4)', () => {
  it('keeps the defence level across a save round trip', () => {
    const st = createState({
      ...newProgress(),
      character: { defenceLevel: 7, critLevel: 3, hpLevel: 4 },
    });
    const data = toSaveData(st, audio, '0.4.0');
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.character).toEqual({ defenceLevel: 7, critLevel: 3, hpLevel: 4 });
    const s = memory();
    writeSave(s, 'k', data);
    expect(loadSave(s, 'k').saved!.progress.character).toEqual({
      defenceLevel: 7,
      critLevel: 3,
      hpLevel: 4,
    });
  });

  it('v3 → v4 adds character with defence level 0', () => {
    const v3 = { version: 3, coins: 5, companion: null };
    expect(migrateSave(v3)).toMatchObject({
      ...v3,
      version: SAVE_VERSION,
      character: { defenceLevel: 0, critLevel: 0, hpLevel: 0 },
    });
  });

  it('repairs a missing or broken character in a plain JSON save', () => {
    const char = (character: unknown) =>
      loadSave(memory({ k: JSON.stringify({ version: 3, character }) }), 'k').saved!.progress
        .character;
    expect(char(undefined)).toEqual({ defenceLevel: 0, critLevel: 0, hpLevel: 0 });
    expect(char({ defenceLevel: -2 })).toEqual({ defenceLevel: 0, critLevel: 0, hpLevel: 0 });
    expect(char({ defenceLevel: 3 })).toEqual({ defenceLevel: 3, critLevel: 0, hpLevel: 0 });
    expect(char({ defenceLevel: 3, critLevel: 5, hpLevel: 2 })).toEqual({
      defenceLevel: 3,
      critLevel: 5,
      hpLevel: 2,
    });
    expect(char({ critLevel: 1.5 })).toEqual({ defenceLevel: 0, critLevel: 0, hpLevel: 0 });
    expect(char({ hpLevel: 1.5 })).toEqual({ defenceLevel: 0, critLevel: 0, hpLevel: 0 });
  });
});

describe('revealed weapons in the save (v5)', () => {
  const v4 = (coins: number, weaponLevels = [3, 1, 0, 0, 0]) => ({
    version: 4,
    coins,
    weaponLevels,
    companion: null,
    character: { defenceLevel: 0 },
  });

  it('v4 → v5 reveals owned weapons plus what the coins reach 90% of', () => {
    expect(migrateSave(v4(0))).toEqual({
      ...v4(0),
      character: { defenceLevel: 0, critLevel: 0, hpLevel: 0 },
      version: SAVE_VERSION,
      revealedWeapons: [true, true, false, false, false],
    });
    // 2,700 is 90% of the stone sword (3,000); not yet the iron sword.
    expect(migrateSave(v4(2_700)).revealedWeapons).toEqual([true, true, true, false, false]);
    // A long AFK: several at once.
    expect(migrateSave(v4(2_430_000)).revealedWeapons).toEqual([true, true, true, true, true]);
    // Owned is always revealed, even when broke.
    expect(migrateSave(v4(0, [1, 1, 1, 1, 0])).revealedWeapons).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('a v4 save string loads with the migrated list', () => {
    const st = createState({ ...newProgress(), coins: 2_800 });
    const { revealedWeapons: _, ...old } = toSaveData(st, audio, '0.4.0');
    const r = decodeSave(encodeSave({ ...old, version: 4 } as never));
    expect(r.ok && r.progress.revealedWeapons).toEqual([true, true, true, false, false]);
  });

  it('keeps revealed weapons across a save round trip, even after spending', () => {
    const st = createState({ ...newProgress(), coins: 2_800 });
    expect(st.revealedWeapons).toEqual([true, true, true, false, false]);
    const s = memory();
    writeSave(s, 'k', toSaveData({ ...st, coins: 0 }, audio, '0.5.0'));
    const loaded = loadSave(s, 'k').saved!.progress;
    expect(loaded.coins).toBe(0);
    expect(loaded.revealedWeapons).toEqual([true, true, true, false, false]);
    expect(createState(loaded).revealedWeapons).toEqual([true, true, true, false, false]);
  });

  it('repairs a missing or broken list in a plain JSON save', () => {
    const rev = (revealedWeapons: unknown) =>
      loadSave(
        memory({
          k: JSON.stringify({
            version: 5,
            coins: 95,
            weaponLevels: [1, 0, 0, 0, 0],
            revealedWeapons,
          }),
        }),
        'k',
      ).saved!.progress.revealedWeapons;
    expect(rev(undefined)).toEqual([true, true, false, false, false]);
    expect(rev('x')).toEqual([true, true, false, false, false]);
    expect(rev([false, false, false, true])).toEqual([true, true, false, true, false]);
  });
});

describe('max HP upgrade in the save (v7)', () => {
  it('v6 → v7 adds hpLevel 0 and keeps the other levels', () => {
    const v6 = { version: 6, coins: 9, character: { defenceLevel: 3, critLevel: 2 } };
    expect(migrateSave(v6)).toEqual({
      ...v6,
      version: SAVE_VERSION,
      character: { defenceLevel: 3, critLevel: 2, hpLevel: 0 },
    });
  });
});
