import { describe, expect, it } from 'vitest';
import { ITEMS } from '../game/balance';
import { forceNextDrop, newGear, onKill, rollItem } from '../game/items';
import { createState, newProgress } from '../game/state';
import { backupKey, loadSave, toSaveData, validateSaveData, writeSave } from '../save';
import { DEFAULT_FONT } from './font';
import {
  clearBag,
  corruptSaveString,
  describeStored,
  extraStats,
  findFont,
  FONT_LETTERS,
  FONT_SAMPLE,
  fontInfoText,
  fromFormView,
  giveItem,
  saveStatus,
  toFormView,
} from './debug';

const audio = { muted: false, track: 'synthwave', musicVolume: 0.5, sfxVolume: 0.5 };
const save = (p: Partial<ReturnType<typeof newProgress>> = {}) =>
  toSaveData(createState({ ...newProgress(), items: newGear(42), ...p }), audio, '0.2.0');
const crow = { id: 'crow' as const, dmgLevel: 4, autoUnlocked: true, speedLevel: 11 };

function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe('crow fields', () => {
  it('round-trips an owned crow and validates', () => {
    const data = save({ companion: crow });
    const back = fromFormView(toFormView(data));
    expect(back.companion).toEqual(crow);
    expect(validateSaveData(back).ok).toBe(true);
  });

  it('turns "not owned" into no companion, and gives a missing crow default fields', () => {
    const view = toFormView(save());
    expect(view.companion).toEqual({
      owned: false,
      dmgLevel: 1,
      autoUnlocked: false,
      speedLevel: 1,
    });
    expect(fromFormView(view).companion).toBeNull();
    const owned = { ...view, companion: { ...(view.companion as object), owned: true } };
    expect(fromFormView(owned).companion).toEqual({
      id: 'crow',
      dmgLevel: 1,
      autoUnlocked: false,
      speedLevel: 1,
    });
  });

  it('leaves bad levels for validation to reject', () => {
    const view = toFormView(save({ companion: crow }));
    (view.companion as Record<string, unknown>).dmgLevel = Number.NaN;
    expect(validateSaveData(fromFormView(view)).ok).toBe(false);
  });
});

describe('giveItem / clearBag', () => {
  it('adds an item of the chosen slot and tier that passes validation', () => {
    const data = save({ world: 3, stage: 2 });
    for (const tier of ['C', 'B', 'A', 'S', 'SS'] as const) {
      const r = giveItem(data, 'pendant', tier);
      if (typeof r === 'string') throw new Error(r);
      const it = r.items.bag[0];
      expect(it).toMatchObject({ id: 1, slot: 'pendant', tier, world: 3, stage: 2 });
      expect(Object.keys(it.stats)).toHaveLength(ITEMS.statCount[tier]);
      expect(r.items.nextId).toBe(2);
      expect(r.items.rng).not.toBe(data.items.rng);
      expect(validateSaveData(r).ok).toBe(true);
    }
  });

  it('refuses when the bag is full', () => {
    const rng = { state: 1 };
    const bag = Array.from({ length: ITEMS.inventorySize }, (_, i) =>
      rollItem(rng, i + 1, 1, 1, 0),
    );
    const data = save({ items: { ...newGear(1), bag, nextId: bag.length + 1 } });
    expect(giveItem(data, 'ring', 'S')).toMatch(/full/);
    const cleared = clearBag(data);
    expect(cleared.items.bag).toEqual([]);
    expect(validateSaveData(cleared).ok).toBe(true);
  });
});

describe('forceNextDrop', () => {
  it('makes exactly the next kill drop an item', () => {
    const s = createState({ ...newProgress(), items: newGear(7) });
    forceNextDrop();
    onKill(s, 1, 1);
    expect(s.items.bag).toHaveLength(1);
    // Disarmed again: 0.5 % per kill, so 20 kills almost never drop with this seed.
    const before = s.items.nextId;
    let drops = 0;
    for (let i = 0; i < 20; i++) {
      onKill(s, 1, 1);
      drops = s.items.nextId - before;
    }
    expect(drops).toBeLessThan(20);
  });
});

describe('extraStats', () => {
  it('shows crow DPS, item totals and the drop chance', () => {
    const ring = { id: 1, slot: 'ring' as const, tier: 'B' as const, world: 1, stage: 1 };
    const text = extraStats(
      save({
        stage: 6,
        companion: crow,
        items: { ...newGear(1), ring: { ...ring, stats: { damage: 5, speed: 0.1 } }, nextId: 2 },
      }),
    );
    // dmg 4, auto every 3.0 − 0.1 × 10 = 2.0 s → 2 DPS.
    expect(text).toContain('crow dmg 4 every 2.0s dps 2');
    expect(text).toContain('items dmg +5 def +0 (total 0) spd +10% find +0%');
    expect(text).toContain(`drop ${ITEMS.dropChance.boss * 100}% bag 0/`);
    expect(extraStats(save(), true)).toContain('crow none');
    expect(extraStats(save(), true)).toContain('drop 100% (forced)');
  });
});

describe('save string and backup', () => {
  it('a corrupted main save falls back to the backup', () => {
    const storage = memory();
    writeSave(storage, 'k', save({ world: 2, stage: 3 }));
    writeSave(storage, 'k', save({ world: 2, stage: 4 }));
    storage.setItem('k', corruptSaveString(storage.getItem('k')!));
    expect(describeStored(storage.getItem('k'))).toMatch(/^broken/);
    expect(describeStored(storage.getItem(backupKey('k')))).toBe('ok 2.3 v0.2.0');
    const { saved, status } = loadSave(storage, 'k');
    expect(status).toBe('backup');
    expect(saved?.progress.stage).toBe(3);
    expect(saveStatus(storage, 'k', status)).toBe(
      'main: broken (Checksum does not match: the save is damaged or edited.)\n' +
        'backup: ok 2.3 v0.2.0\n' +
        'page loaded: BACKUP (main save was damaged)',
    );
  });

  it('describes missing and old saves', () => {
    expect(describeStored(null)).toBe('missing');
    expect(describeStored('{"world":1}')).toBe('old JSON save');
  });
});

describe('font picker', () => {
  it('falls back to the default font for unknown or missing ids', () => {
    expect(findFont(null)).toBe(DEFAULT_FONT);
    expect(findFont('nope')).toBe(DEFAULT_FONT);
    expect(findFont('tiny5').id).toBe('tiny5');
  });

  it('describes grid, sizes and licence', () => {
    expect(fontInfoText(findFont('pixelify'))).toContain('not snapped');
    const info = fontInfoText(findFont('press-start-2p'));
    expect(info).toContain('grid 8 px');
    expect(info).toContain('UI 8px 16px');
    expect(info).toContain('OFL-1.1');
  });

  it('shows every Lithuanian letter, both cases', () => {
    for (const c of 'ąčęėįšųūžĄČĘĖĮŠŲŪŽ') {
      expect(FONT_SAMPLE + FONT_LETTERS).toContain(c);
    }
  });
});
