import { describe, expect, it } from 'vitest';
import type { SpriteDef } from '../sprites/types';
import { DEFAULT_PALETTES } from '../theme';
import { PLACEHOLDER_HERO, PLACEHOLDER_MUSHROOM } from './placeholder-sprites';
import { frameAt, framePixels, validateSprite } from './sprites';

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
    expect(() => validateSprite(sprite([['PGB', 'K..']]))).not.toThrow();
  });

  it('rejects wrong sizes and unknown chars', () => {
    expect(() => validateSprite(sprite([['...', '...', '...']]))).toThrow(/rows/);
    expect(() => validateSprite(sprite([['...', '..']]))).toThrow(/row 1/);
    expect(() => validateSprite(sprite([['..x', '...']]))).toThrow(/unknown slot "x"/);
    expect(() => validateSprite(sprite([]))).toThrow(/no frames/);
  });

  it('placeholder sprites are valid', () => {
    expect(() => validateSprite(PLACEHOLDER_HERO)).not.toThrow();
    expect(() => validateSprite(PLACEHOLDER_MUSHROOM)).not.toThrow();
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
