import { describe, expect, it } from 'vitest';
import { BUY_AMOUNTS, COMPANIONS, WEAPONS } from '../game/balance';
import { weapons } from '../sprites';
import { companionUnlockText, iconScale, INVENTORY, SHOP, stageName } from './menu';

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

describe('upgrade buttons live in the Shop', () => {
  const count = (s: string, re: RegExp) => s.match(new RegExp(re.source, 'g'))?.length ?? 0;

  it('gives every weapon row in Shop → Weapons an Upgrade button and the amount toggle', () => {
    for (let i = 0; i < WEAPONS.length; i++) {
      expect(SHOP.weapons).toContain(`data-act="upgrade" data-tier="${i}"`);
    }
    expect(count(SHOP.weapons, /data-act="upgrade"/)).toBe(WEAPONS.length);
    expect(count(SHOP.weapons, /data-act="amount"/)).toBe(BUY_AMOUNTS.length);
  });

  it('puts the crow upgrades and the amount toggle in Shop → Companions', () => {
    for (const kind of ['dmg', 'auto', 'speed']) {
      expect(SHOP.companions).toContain(`data-act="comp-up" data-kind="${kind}"`);
    }
    expect(count(SHOP.companions, /data-act="amount"/)).toBe(BUY_AMOUNTS.length);
  });

  it('leaves Inventory without upgrade buttons or amount toggle, but keeps Equip', () => {
    const inv = Object.values(INVENTORY).join('');
    expect(inv).not.toMatch(/data-act="(upgrade|comp-up|amount)"/);
    expect(count(INVENTORY.weapons, /data-act="equip"/)).toBe(WEAPONS.length);
  });
});
