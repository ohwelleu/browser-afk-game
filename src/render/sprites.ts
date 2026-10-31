import type { SpriteDef } from '../sprites/types';
import type { Palette } from '../theme';

const SLOTS: Record<string, keyof Palette | null> = {
  '.': null,
  '#': 'fg',
  o: 'bg',
  O: 'orange',
  Y: 'yellow',
  R: 'red',
  P: 'purple',
  G: 'green',
  B: 'blue',
  K: 'pink',
};

/** Checks a sprite against its declared size and the palette slots. Throws on the first problem. */
export function validateSprite(def: SpriteDef): void {
  if (def.frames.length === 0) throw new Error(`sprite "${def.name}": no frames`);
  def.frames.forEach((rows, f) => {
    if (rows.length !== def.height) {
      throw new Error(
        `sprite "${def.name}" frame ${f}: ${rows.length} rows, expected ${def.height}`,
      );
    }
    rows.forEach((row, y) => {
      if (row.length !== def.width) {
        throw new Error(
          `sprite "${def.name}" frame ${f} row ${y}: ${row.length} px, expected ${def.width}`,
        );
      }
      for (const ch of row) {
        if (!(ch in SLOTS)) {
          throw new Error(`sprite "${def.name}" frame ${f} row ${y}: unknown slot "${ch}"`);
        }
      }
    });
  });
}

/** Resolves one frame to a colour per pixel (row-major, null = transparent). */
export function framePixels(def: SpriteDef, frame: number, palette: Palette): (string | null)[] {
  const out: (string | null)[] = [];
  for (const row of def.frames[frame]) {
    for (const ch of row) {
      const slot = SLOTS[ch];
      out.push(slot ? palette[slot] : null);
    }
  }
  return out;
}

/** Frame index for an animation at `time` seconds. */
export function frameAt(def: SpriteDef, time: number): number {
  if (!def.fps || def.frames.length < 2) return 0;
  return Math.floor(time * def.fps) % def.frames.length;
}

/**
 * Renders sprite frames to 1×-scale offscreen canvases once and caches them.
 * Call `setPalette` on theme change; frames are rebuilt lazily.
 */
export class SpriteCache {
  private cache = new Map<SpriteDef, HTMLCanvasElement[]>();
  private tinted = new Map<string, HTMLCanvasElement>();

  constructor(private palette: Palette) {}

  setPalette(palette: Palette): void {
    this.palette = palette;
    this.cache.clear();
    this.tinted.clear();
  }

  /** The frame as a solid silhouette in `color` (hit flash). */
  tint(def: SpriteDef, index: number, color: string): HTMLCanvasElement {
    const key = `${def.name}|${index}|${color}`;
    let canvas = this.tinted.get(key);
    if (!canvas) {
      const src = this.frame(def, index);
      canvas = document.createElement('canvas');
      canvas.width = src.width;
      canvas.height = src.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(src, 0, 0);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, src.width, src.height);
      this.tinted.set(key, canvas);
    }
    return canvas;
  }

  frame(def: SpriteDef, index: number): HTMLCanvasElement {
    let frames = this.cache.get(def);
    if (!frames) {
      validateSprite(def);
      frames = [];
      this.cache.set(def, frames);
    }
    return (frames[index] ??= this.draw(def, index));
  }

  private draw(def: SpriteDef, index: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = def.width;
    canvas.height = def.height;
    const ctx = canvas.getContext('2d')!;
    const pixels = framePixels(def, index, this.palette);
    for (let i = 0; i < pixels.length; i++) {
      const color = pixels[i];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(i % def.width, Math.floor(i / def.width), 1, 1);
    }
    return canvas;
  }
}
