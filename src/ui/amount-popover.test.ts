import { describe, expect, it } from 'vitest';
import { BUY_AMOUNTS } from '../game/balance';
import {
  amountLabel,
  AMOUNT_STYLES,
  optionStep,
  parseAmount,
  placePopover,
} from './amount-popover';

// Node environment (no DOM / layout): the placement and key logic are pure
// functions. The visual check (desktop and phone widths) is in the PR.

const bounds = { left: 100, top: 50, right: 700, bottom: 520 };
const size = { width: 100, height: 190 };
const anchorAt = (top: number, right = 600) => ({ left: right - 70, top, right, bottom: top + 42 });

describe('placePopover', () => {
  it('opens below the button, right edges lined up, relative to the bounds', () => {
    const p = placePopover(anchorAt(100), bounds, size);
    expect(p.above).toBe(false);
    expect(p).toMatchObject({ left: 600 - 100 - 100, top: 142 + 4 - 50 });
  });

  it('opens above when there is no room below but room above', () => {
    const p = placePopover(anchorAt(400), bounds, size);
    expect(p.above).toBe(true);
    expect(p.top + bounds.top).toBe(400 - 4 - size.height);
  });

  it('stays inside the bounds sideways, even for a button at the left edge', () => {
    const p = placePopover(anchorAt(100, 130), bounds, size);
    expect(p.left).toBe(4);
    const q = placePopover(anchorAt(100, 900), bounds, size);
    expect(q.left + size.width).toBeLessThanOrEqual(bounds.right - bounds.left - 4);
  });

  it('stays inside the bounds vertically when neither side has full room', () => {
    const tiny = { left: 0, top: 0, right: 300, bottom: 200 };
    const p = placePopover({ left: 200, top: 80, right: 270, bottom: 122 }, tiny, size);
    expect(p.top).toBeGreaterThanOrEqual(4);
    expect(p.top + size.height).toBeLessThanOrEqual(200 - 4);
  });
});

describe('optionStep', () => {
  it('moves with arrows, wraps, and jumps with Home/End', () => {
    expect(optionStep('ArrowDown', 0, 4)).toBe(1);
    expect(optionStep('ArrowDown', 3, 4)).toBe(0);
    expect(optionStep('ArrowUp', 0, 4)).toBe(3);
    expect(optionStep('Home', 2, 4)).toBe(0);
    expect(optionStep('End', 0, 4)).toBe(3);
  });

  it('ignores other keys', () => {
    expect(optionStep('a', 0, 4)).toBeNull();
    expect(optionStep('Enter', 0, 4)).toBeNull();
  });
});

describe('amount values', () => {
  it('labels ×1, ×10, ×100 and MAX', () => {
    expect(BUY_AMOUNTS.map(amountLabel)).toEqual(['×1', '×10', '×100', 'MAX']);
  });

  it('parses every data-amount value and falls back to ×1', () => {
    for (const a of BUY_AMOUNTS) expect(parseAmount(String(a))).toBe(a);
    expect(parseAmount(undefined)).toBe(1);
    expect(parseAmount('7')).toBe(1);
  });
});

describe('amount styles', () => {
  it('gives phone-width options a 44 px tap target', () => {
    const phone = /@container afk-box \(max-width: 767px\) \{([^}]*)\}/.exec(AMOUNT_STYLES)?.[1];
    expect(phone).toMatch(/\.amount-opt \{[^}]*min-height: 44px/);
  });
});
