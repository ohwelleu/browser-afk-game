import { describe, expect, it } from 'vitest';
import { PALETTE_SLOTS, type SpriteDef } from '../sprites/types';
import { COLOR_NAMES, DEFAULT_PALETTES } from '../theme';
import { bossMushroomWalk, heroSlash, slashArcs } from '../sprites';
import { frameAt, framePixels, SLOTS, validateSprite } from './sprites';

const sprite = (frames: string[][], fps?: number): SpriteDef => ({
  name: 'test',
  width: 3,
  height: 2,
  frames,
  fps,
});
const BLANK = ['...', '...'];

describe('validateSprite', () => {
  it('accepts every palette slot', () => {
    expect(() => validateSprite(sprite([['.#o', 'OYR']]))).not.toThrow();
    expect(() => validateSprite(sprite([['PGB', 'KN.']]))).not.toThrow();
  });

  it('rejects wrong sizes and unknown chars', () => {
    expect(() => validateSprite(sprite([['...', '...', '...']]))).toThrow(/rows/);
    expect(() => validateSprite(sprite([['...', '..']]))).toThrow(/row 1/);
    expect(() => validateSprite(sprite([['..x', '...']]))).toThrow(/unknown slot "x"/);
    expect(() => validateSprite(sprite([]))).toThrow(/no frames/);
  });

  it('has a slot for every theme colour', () => {
    const used = Object.values(SLOTS).filter(Boolean).sort();
    expect(used).toEqual(['bg', 'fg', ...COLOR_NAMES].sort());
    expect(new Set(Object.keys(SLOTS))).toEqual(new Set(PALETTE_SLOTS));
  });

  it('accepts the real sprites', () => {
    for (const def of [heroSlash, bossMushroomWalk, ...slashArcs]) {
      expect(() => validateSprite(def)).not.toThrow();
    }
  });
});

describe('framePixels', () => {
  it('maps slots to the theme palette', () => {
    const p = DEFAULT_PALETTES.dark;
    expect(framePixels(sprite([['.#o', 'OKB']]), 0, p)).toEqual([
      null,
      p.fg,
      p.bg,
      p.orange,
      p.pink,
      p.blue,
    ]);
    expect(framePixels(sprite([['N..', '...']]), 0, p)[0]).toBe(p.brown);
  });
});

describe('frameAt', () => {
  it('loops frames at fps', () => {
    const s = sprite([BLANK, BLANK, BLANK], 2);
    expect(frameAt(s, 0)).toBe(0);
    expect(frameAt(s, 0.5)).toBe(1);
    expect(frameAt(s, 1.4)).toBe(2);
    expect(frameAt(s, 1.5)).toBe(0);
  });

  it('stays on frame 0 without fps', () => {
    expect(frameAt(sprite([BLANK, BLANK]), 5)).toBe(0);
  });
});
