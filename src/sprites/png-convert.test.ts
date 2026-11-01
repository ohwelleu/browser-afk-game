import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  checkSameSize,
  exportName,
  parseFrameSize,
  pngToStrip,
  renderModule,
} from '../../scripts/sprites/convert';
import { heroIdle } from './hero';
import { heroIdle as generatedHeroIdle } from './generated/hero';

type Px = [number, number, number, number];

/** Builds a PNG where every pixel is `fill`, then applies `set` overrides. */
function makePng(w: number, h: number, fill: Px, set: [number, number, Px][] = []): Buffer {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) png.data.set(fill, i * 4);
  for (const [x, y, px] of set) png.data.set(px, (y * w + x) * 4);
  return PNG.sync.write(png);
}

const INK: Px = [0x1f, 0x1f, 0x1f, 255];
const CLEAR: Px = [0, 0, 0, 0];

describe('sprite converter', () => {
  it('art/hero-idle.png gives exactly the hero idle frame from hero.ts', () => {
    const png = readFileSync(new URL('../../art/hero-idle.png', import.meta.url));
    const { strip, errors } = pngToStrip(png, 'hero-idle', { width: 32, height: 64 });
    expect(errors).toEqual([]);
    expect(strip.frames).toEqual([heroIdle.frames[0]]);
  });

  it('checked-in generated file is up to date', () => {
    const png = readFileSync(new URL('../../art/hero-idle.png', import.meta.url));
    const { strip } = pngToStrip(png, 'hero-idle', parseFrameSize('32x64'));
    expect(generatedHeroIdle.frames).toEqual(strip.frames);
    const file = readFileSync(new URL('./generated/hero.ts', import.meta.url), 'utf8');
    expect(file).toBe(renderModule([strip], ['art/hero-idle.png']));
  });

  it('maps every palette colour to its slot and splits a strip into frames', () => {
    const colors: [string, Px][] = [
      ['#', [0x1f, 0x1f, 0x1f, 255]],
      ['o', [0xec, 0xe9, 0xe2, 255]],
      ['O', [0xff, 0x6b, 0x00, 255]],
      ['Y', [0xea, 0xb3, 0x08, 255]],
      ['R', [0xdc, 0x26, 0x26, 255]],
      ['P', [0x7c, 0x3a, 0xed, 255]],
      ['G', [0x16, 0xa3, 0x4a, 255]],
      ['B', [0x25, 0x63, 0xeb, 255]],
      ['K', [0xdb, 0x27, 0x77, 255]],
      ['.', [0x12, 0x34, 0x56, 0]], // any colour with alpha 0 is transparent
    ];
    const png = makePng(
      10,
      1,
      CLEAR,
      colors.map(([, px], x) => [x, 0, px]),
    );
    const { strip, errors } = pngToStrip(png, 't', { width: 5, height: 1 });
    expect(errors).toEqual([]);
    expect(strip.frames).toEqual([['#oOYR'], ['PGBK.']]);
  });

  it('reports colours not in the palette with frame and position', () => {
    const png = makePng(8, 4, CLEAR, [[6, 3, [0xff, 0x00, 0xfe, 255]]]);
    const { errors } = pngToStrip(png, 'hero-idle', { width: 4, height: 4 });
    expect(errors).toEqual(['hero-idle frame 2 (2,3): #ff00fe is not in the palette']);
  });

  it('reports semi-transparent pixels', () => {
    const png = makePng(2, 2, INK, [[1, 0, [0x1f, 0x1f, 0x1f, 128]]]);
    const { errors } = pngToStrip(png, 'mob', undefined);
    expect(errors).toEqual([
      'mob frame 1 (1,0): #1f1f1f is semi-transparent (alpha 128), use 0 or 255',
    ]);
  });

  it('reports marker colours as not supported yet', () => {
    const png = makePng(3, 1, INK, [
      [0, 0, [0xff, 0x00, 0xff, 255]],
      [1, 0, [0x00, 0xff, 0xff, 255]],
      [2, 0, [0x00, 0xff, 0x00, 255]],
    ]);
    expect(pngToStrip(png, 'm', undefined).errors).toEqual([
      'm frame 1 (0,0): #ff00ff is a marker (anchor), not supported yet',
      'm frame 1 (1,0): #00ffff is a marker (hit), not supported yet',
      'm frame 1 (2,0): #00ff00 is a marker (fx), not supported yet',
    ]);
  });

  it('rejects an image that is not a strip of the frame size', () => {
    const png = makePng(70, 64, INK);
    expect(pngToStrip(png, 'hero-slash', { width: 32, height: 64 }).errors).toEqual([
      'hero-slash: image is 70x64, not a horizontal strip of 32x64 frames',
    ]);
  });

  it('rejects animations of one character with different frame sizes', () => {
    const a = pngToStrip(makePng(32, 64, INK), 'hero-idle').strip;
    const b = pngToStrip(makePng(32, 48, INK), 'hero-hurt').strip;
    expect(checkSameSize([a, b])).toEqual([
      'hero-hurt: frames are 32x48, expected 32x64 like hero-idle',
    ]);
  });

  it('parses frame sizes and export names', () => {
    expect(parseFrameSize('32x64')).toEqual({ width: 32, height: 64 });
    expect(() => parseFrameSize('32')).toThrow('bad frame size');
    expect(exportName('hero-idle')).toBe('heroIdle');
  });
});
