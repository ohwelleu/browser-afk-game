import { describe, expect, it } from 'vitest';
import { COMPANIONS } from '../game/balance';
import { weapons } from '../sprites';
import { companionUnlockText, HELP_ICON, iconScale, MENU_TABS, pixelSvg, stageName } from './menu';

describe('stageName', () => {
  it('turns a stage level into world.stage', () => {
    expect(stageName(1)).toBe('1.1');
    expect(stageName(6)).toBe('1.6');
    expect(stageName(7)).toBe('2.1');
    expect(stageName(13)).toBe('3.1');
  });
});

describe('companionUnlockText', () => {
  it('names the stage to clear (unlockLevel is the level after it)', () => {
    expect(companionUnlockText({ unlockLevel: 2 })).toBe('Unlocks after clearing 1.1');
    expect(companionUnlockText({ unlockLevel: 8 })).toBe('Unlocks after clearing 2.1');
  });

  it('uses the crow balance value', () => {
    expect(companionUnlockText(COMPANIONS.crow)).toMatch(/^Unlocks after clearing \d+\.\d+$/);
  });
});

describe('iconScale', () => {
  it('fits every weapon pose used as an icon inside the 56 px box', () => {
    for (const w of weapons) {
      const def = w.poses.upFwd.sprite;
      const scale = iconScale(def);
      expect(Number.isInteger(scale)).toBe(true);
      expect(Math.max(def.width, def.height) * scale).toBeLessThanOrEqual(56);
    }
  });

  it('keeps small icons at 3× and never goes below 1×', () => {
    expect(iconScale({ width: 12, height: 12 })).toBe(3);
    expect(iconScale({ width: 90, height: 10 })).toBe(1);
  });
});

describe('menu tabs', () => {
  it('has Shop and Inventory only; Help is the (i) button', () => {
    expect(MENU_TABS).toEqual(['shop', 'inventory']);
  });
});

describe('help icon', () => {
  it('is an 11×11 pixel grid, mirrored left to right except the "i"', () => {
    expect(HELP_ICON).toHaveLength(11);
    for (const row of HELP_ICON) expect(row).toMatch(/^[.#]{11}$/);
    const ring = HELP_ICON.map((r) => r.slice(0, 4) + '...' + r.slice(7));
    for (const row of ring) expect(row).toBe([...row].reverse().join(''));
  });

  it('draws one square per pixel in the text colour', () => {
    const svg = pixelSvg(['#.', '.#']);
    expect(svg).toContain('viewBox="0 0 2 2"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('d="M0 0h1v1h-1zM1 1h1v1h-1z"');
  });
});
