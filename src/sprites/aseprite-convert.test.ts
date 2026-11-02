import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { asepriteToStrips } from '../../scripts/sprites/aseprite';
import { buildSprites } from '../../scripts/sprites/build';
import type { SpriteDef } from './types';
import { validateSprite } from './validate';

const FIX = new URL('../../scripts/sprites/fixtures/', import.meta.url);
const dir = (name: string) =>
  decodeURIComponent(new URL(name, FIX).pathname).replace(/^\/(\w:)/, '$1');
const read = (path: string) => readFileSync(new URL(path, FIX));

// Fixture sheet: 3 frames of 4x2, durations 100/150/200 ms.
const F1 = ['.##.', '####'];
const F2 = ['.##.', 'RRRR'];
const F3 = ['....', '.YY.'];

const FILES = { png: 'art/slime.png', json: 'art/slime.json' };
const convert = (json: unknown, png: Buffer = read('sheet-array/slime.png')) =>
  asepriteToStrips(png, JSON.stringify(json), 'slime', FILES);
const arrayJson = () => JSON.parse(read('sheet-array/slime.json').toString('utf8'));

describe('Aseprite sheet converter', () => {
  it('reads "Array" JSON: one strip per tag with durations, pingpong expanded', () => {
    const { strips, errors } = convert(arrayJson());
    expect(errors).toEqual([]);
    expect(strips).toEqual([
      { label: 'slime-idle', width: 4, height: 2, frames: [F1, F2], durations: [100, 150] },
      {
        label: 'slime-hop',
        width: 4,
        height: 2,
        frames: [F1, F2, F3, F2],
        durations: [100, 150, 200, 150],
      },
    ]);
  });

  it('reads "Hash" JSON the same way, reverse tags play backwards', () => {
    const { strips, errors } = asepriteToStrips(
      read('sheet-hash/slime.png'),
      read('sheet-hash/slime.json').toString('utf8'),
      'slime',
      FILES,
    );
    expect(errors).toEqual([]);
    expect(strips.map((s) => [s.label, s.frames, s.durations])).toEqual([
      ['slime-idle', [F1, F2], [100, 150]],
      ['slime-squash', [F3, F2], [200, 150]],
    ]);
  });

  it('without tags the whole sheet is one animation', () => {
    const json = arrayJson();
    json.meta.frameTags = [];
    expect(convert(json).strips).toEqual([
      { label: 'slime', width: 4, height: 2, frames: [F1, F2, F3], durations: [100, 150, 200] },
    ]);
  });

  it('builds a module with fps and durations next to plain PNG strips', () => {
    const { modules, errors } = buildSprites(dir('sheet-array'), undefined, 'art');
    expect(errors).toEqual([]);
    expect(modules.map((m) => [m.name, m.summary])).toEqual([
      ['slime', 'slime-idle 2f, slime-hop 4f, slime-hurt 1f'],
    ]);
    const src = modules[0].source;
    expect(src).toContain('// Source: art/slime.png, art/slime-hurt.png');
    expect(src).toContain(
      [
        'export const slimeHop: SpriteDef = {',
        "  name: 'slime-hop',",
        '  width: 4,',
        '  height: 2,',
        '  fps: 6.67,',
        '  durations: [100, 150, 200, 150],',
        '  frames: [',
      ].join('\n'),
    );
    // The plain strip (no JSON) keeps step-1 output: no fps, no durations.
    expect(src).toContain(
      ["  name: 'slime-hurt',", '  width: 4,', '  height: 2,', '  frames: ['].join('\n'),
    );
    // Converted animations are valid sprites with one duration per frame.
    for (const s of convert(arrayJson()).strips) {
      const def: SpriteDef = { name: s.label, ...s };
      expect(validateSprite(def)).toEqual([]);
      expect(def.durations).toHaveLength(def.frames.length);
    }
  });

  it('reports a PNG that does not match the JSON', () => {
    const { modules, errors } = buildSprites(dir('mismatch'), undefined, 'art');
    expect(errors).toEqual([
      'art/slime.png: image is 8x2, but art/slime.json has 3 frames of 4x2 (12x2)',
    ]);
    expect(modules).toEqual([]);
  });

  it('reports frame geometry problems with file, tag and frame', () => {
    const json = arrayJson();
    json.frames[1].frame.h = 3;
    json.frames[2].frame.x = 0;
    json.frames[2].trimmed = true;
    json.frames[0].duration = 0;
    expect(convert(json).errors).toEqual([
      'art/slime.json slime-idle frame 1: bad duration 0, expected ms > 0',
      'art/slime.json slime-idle frame 2: frame is 4x3, expected 4x2',
      'art/slime.json slime-hop frame 3: frame is at (0,0), expected (8,0); export with Layout: horizontal strip',
      'art/slime.json slime-hop frame 3: frame is trimmed; untick "Trim" in the export',
    ]);
  });

  it('reports bad tags', () => {
    const json = arrayJson();
    json.meta.frameTags = [
      { name: 'idle', from: 0, to: 5, direction: 'forward' },
      { name: 'hop', from: 0, to: 1, direction: 'sideways' },
      { name: 'hop', from: 0, to: 1 },
      { name: 'big jump', from: 0, to: 1 },
    ];
    expect(convert(json).errors).toEqual([
      'art/slime.json tag "idle": frames 1..6 out of range, the sheet has 3 frames',
      'art/slime.json tag "hop": direction "sideways" not supported, use forward, reverse or pingpong',
      'art/slime.json tag "hop": tag name used twice',
      'art/slime.json tag "big jump": use letters, digits and _ only in tag names',
    ]);
  });

  it('reports meta.size that disagrees with the frames', () => {
    const json = arrayJson();
    json.meta.size = { w: 16, h: 2 };
    expect(convert(json).errors).toEqual([
      'art/slime.json: meta.size is 16x2, but 3 frames of 4x2 make 12x2',
    ]);
  });

  it('names the tag and frame in palette errors', () => {
    const png = PNG.sync.read(read('sheet-array/slime.png'));
    png.data.set([0xff, 0x00, 0xfe, 255], (1 * 12 + 9) * 4); // frame 3, (1,1)
    const { errors } = convert(arrayJson(), PNG.sync.write(png));
    expect(errors).toEqual(['slime-hop frame 3 (1,1): #ff00fe is not in the palette']);
  });

  it('rejects files that are not sprite sheet JSON', () => {
    expect(asepriteToStrips(Buffer.alloc(0), '{', 'x', FILES).errors[0]).toMatch(
      /^art\/slime\.json: not valid JSON/,
    );
    expect(asepriteToStrips(Buffer.alloc(0), '{}', 'x', FILES).errors).toEqual([
      'art/slime.json: no "frames", is this an Aseprite sprite sheet export?',
    ]);
  });
});
