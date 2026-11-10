import { describe, expect, it } from 'vitest';
import { BUY_AMOUNTS, COMPANION_IDS, COMPANIONS, WEAPONS } from '../game/balance';
import { weapons } from '../sprites';
import { AMOUNT_BUTTON, AMOUNT_POPOVER } from './amount-popover';
import {
  companionUnlockText,
  HELP_ICON,
  iconScale,
  INVENTORY,
  MENU_TABS,
  pixelSvg,
  SHOP,
  stageName,
} from './menu';

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

describe('upgrade buttons live in the Shop', () => {
  const count = (s: string, re: RegExp) => s.match(new RegExp(re.source, 'g'))?.length ?? 0;

  it('gives every weapon row in Shop → Weapons an Upgrade button and its own amount button', () => {
    for (let i = 0; i < WEAPONS.length; i++) {
      expect(SHOP.weapons).toContain(`data-act="upgrade" data-tier="${i}"`);
    }
    expect(count(SHOP.weapons, /data-act="upgrade"/)).toBe(WEAPONS.length);
    expect(count(SHOP.weapons, /data-act="amount-menu"/)).toBe(WEAPONS.length);
    // Each amount button sits right before its Upgrade button.
    expect(SHOP.weapons).toContain(`${AMOUNT_BUTTON}<button type="button" data-act="upgrade"`);
  });

  it('gives every companion one Upgrade button with an amount button before it', () => {
    for (const id of COMPANION_IDS) {
      expect(SHOP.companions).toContain(`data-act="buy-companion" data-comp="${id}"`);
      expect(SHOP.companions).toContain(
        `${AMOUNT_BUTTON}<button type="button" data-act="comp-up" data-comp="${id}"`,
      );
    }
    expect(count(SHOP.companions, /data-act="comp-up"/)).toBe(COMPANION_IDS.length);
    expect(count(SHOP.companions, /data-act="amount-menu"/)).toBe(COMPANION_IDS.length);
    // One upgrade each: no separate damage / auto attack / speed buttons.
    expect(SHOP.companions).not.toMatch(/data-kind=/);
    expect(SHOP.companions).not.toMatch(/Faster|Auto attack/);
  });

  it('lists a row for every companion in Shop and Inventory', () => {
    for (const id of COMPANION_IDS) {
      expect(count(SHOP.companions, new RegExp(`data-comp="${id}" class="comp-buy"`))).toBe(1);
      expect(INVENTORY.companions).toContain(`data-comp="${id}"`);
      expect(SHOP.companions).toContain(COMPANIONS[id].name);
    }
  });

  it('gives Defence in Shop → Character an amount button before its Buy button', () => {
    expect(SHOP.character).toContain(`${AMOUNT_BUTTON}<button type="button" data-act="buy-char"`);
  });

  it('lists Max HP, Max mana, Defence and Crit chance, each with an amount button and a Buy button', () => {
    expect(SHOP.character).toContain('data-char="hp"');
    expect(SHOP.character).toContain('data-char="mana"');
    expect(SHOP.character).toContain('data-char="defence"');
    expect(SHOP.character).toContain('data-char="crit"');
    expect(count(SHOP.character, /data-act="buy-char"/)).toBe(4);
    expect(count(SHOP.character, /data-act="amount-menu"/)).toBe(4);
    expect(SHOP.character.indexOf('data-char="defence"')).toBeLessThan(
      SHOP.character.indexOf('data-char="crit"'),
    );
  });

  it('has no old four-button amount row anywhere in the shop', () => {
    const shop = Object.values(SHOP).join('');
    expect(shop).not.toContain('class="amounts"');
    expect(shop).not.toContain('data-act="amount"');
  });

  it('leaves Inventory without upgrade buttons or amount buttons, but keeps Equip', () => {
    const inv = Object.values(INVENTORY).join('');
    expect(inv).not.toMatch(/data-act="(upgrade|comp-up|amount-menu|amount)"/);
    expect(count(INVENTORY.weapons, /data-act="equip"/)).toBe(WEAPONS.length);
  });
});

describe('amount popover markup', () => {
  it('has a button with popup semantics and a collapsed state', () => {
    expect(AMOUNT_BUTTON).toContain('aria-haspopup="true"');
    expect(AMOUNT_BUTTON).toContain('aria-expanded="false"');
  });

  it('lists every amount once, as radio items, hidden until opened', () => {
    expect(AMOUNT_POPOVER).toMatch(/role="menu"[^>]* hidden>/);
    const opts = [...AMOUNT_POPOVER.matchAll(/data-amount="([^"]+)"/g)].map((m) => m[1]);
    expect(opts).toEqual(BUY_AMOUNTS.map(String));
    expect(AMOUNT_POPOVER.match(/role="menuitemradio"/g)).toHaveLength(BUY_AMOUNTS.length);
  });
});
