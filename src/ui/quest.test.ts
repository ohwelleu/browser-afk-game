import { describe, expect, it } from 'vitest';
import {
  ARROW_SIZE,
  arrowPlacement,
  arrowTarget,
  doneText,
  QUEST_STYLES,
  questText,
} from './quest';

describe('questText', () => {
  it('names the stage to clear before the crow unlocks', () => {
    expect(questText('unlock').text).toBe('Quest: clear stage 1.1 to unlock the crow');
  });

  it('points the two steps to Shop → Companions', () => {
    expect(questText('buy').text).toBe('Quest: buy the crow to start clicking');
    expect(questText('upgrade').text).toBe('Quest: upgrade the crow');
    expect(questText('buy').sub).toContain('Shop → Companions');
  });
});

describe('doneText', () => {
  it('confirms each finished step', () => {
    expect(doneText('buy', 'upgrade')).toMatch(/Crow bought/);
    expect(doneText('upgrade', null)).toMatch(/Quest complete/);
  });

  it('says nothing for other changes', () => {
    expect(doneText('unlock', 'buy')).toBeNull();
    expect(doneText(null, null)).toBeNull();
    expect(doneText('buy', 'buy')).toBeNull();
  });
});

const box = { left: 100, top: 50, width: 400, height: 300 };

describe('arrowPlacement', () => {
  it('sits left of the target, pointing right', () => {
    const target = { left: 440, top: 60, width: 40, height: 28 };
    const p = arrowPlacement(target, box);
    expect(p.side).toBe('left');
    expect(p.left).toBe(440 - 100 - 4 - ARROW_SIZE);
    expect(p.top).toBe(60 - 50 + (28 - ARROW_SIZE) / 2); // centred on the target
  });

  it('moves to the next side that fits', () => {
    const target = { left: 102, top: 150, width: 60, height: 30 }; // touches the left edge
    expect(arrowPlacement(target, box).side).toBe('right');
    expect(arrowPlacement(target, box, ['above', 'below']).side).toBe('above');
  });

  it('uses the preferred order and centres on the target', () => {
    const target = { left: 250, top: 100, width: 100, height: 20 };
    const p = arrowPlacement(target, box, ['below', 'above']);
    expect(p.side).toBe('below');
    expect(p.left).toBe(150 + (100 - ARROW_SIZE) / 2);
    expect(p.top).toBe(100 - 50 + 20 + 4);
  });

  it('never leaves the box, even when no side fits (compact layout)', () => {
    const target = { left: 100, top: 50, width: 400, height: 300 }; // fills the box
    const p = arrowPlacement(target, box);
    expect(p.left).toBeGreaterThanOrEqual(0);
    expect(p.top).toBeGreaterThanOrEqual(0);
    expect(p.left + ARROW_SIZE).toBeLessThanOrEqual(box.width);
    expect(p.top + ARROW_SIZE).toBeLessThanOrEqual(box.height);
  });
});

describe('arrowTarget', () => {
  const shop = { open: true, tab: 'shop', sub: 'companions' };

  it('points the way: menu → Shop tab → Companions → button', () => {
    expect(arrowTarget('buy', { open: false, tab: null, sub: null })).toBe('menu');
    expect(arrowTarget('buy', { open: true, tab: 'inventory', sub: null })).toBe('shop');
    expect(arrowTarget('buy', { ...shop, sub: 'weapons' })).toBe('companions');
    expect(arrowTarget('buy', shop)).toBe('action');
    expect(arrowTarget('upgrade', shop)).toBe('action');
  });

  it('points at nothing while there is no step to act on', () => {
    expect(arrowTarget('unlock', shop)).toBeNull();
    expect(arrowTarget(null, shop)).toBeNull();
  });
});

describe('arrow styles', () => {
  it('is a pixel arrow in palette yellow that lets clicks through', () => {
    expect(QUEST_STYLES).toMatch(/\.quest-arrow \{[^}]*color: var\(--_yellow\)/);
    expect(QUEST_STYLES).toMatch(/\.quest-arrow \{[^}]*pointer-events: none/);
  });

  it('bounces in 2 steps and stands still when animations are reduced', () => {
    expect(QUEST_STYLES).toMatch(/animation: afk-quest-bounce [\d.]+s steps\(1\) infinite/);
    expect(QUEST_STYLES).toContain('.motion-reduced .quest-arrow { animation: none; }');
  });

  it('has no yellow outline any more', () => {
    expect(QUEST_STYLES).not.toContain('quest-hint');
    expect(QUEST_STYLES).not.toContain('outline');
  });
});
