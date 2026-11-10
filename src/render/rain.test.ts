import { describe, expect, it } from 'vitest';
import { RAIN_MAX_LINES } from '../game/rain';
import { DEFAULT_PALETTES } from '../theme';
import { RainField, type RainArea } from './rain';

const H = 50;
/** A 40 px column in the middle of a 100 px scene, from row 10 down to the ground at `H`. */
const AREA: RainArea = { left: 30, right: 70, top: 10, bottom: H };
const TICKS_PER_SEC = 60;

type Rect = { fill: string; x: number; y: number; w: number; h: number };
function fakeCtx() {
  const rects: Rect[] = [];
  const ctx = {
    fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({ fill: String(this.fillStyle), x, y, w, h });
    },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}
const palette = DEFAULT_PALETTES.dark;
const run = (
  f: RainField,
  from: number,
  seconds: number,
  counts: { rainbow: number; yellow: number },
) => {
  for (let t = from; t <= from + seconds * TICKS_PER_SEC; t += 2) f.advance(t, counts, AREA);
  return from + seconds * TICKS_PER_SEC;
};

describe('RainField', () => {
  it('shows one streak per line', () => {
    const f = new RainField();
    f.advance(0, { rainbow: 2, yellow: 3 }, AREA);
    expect(f.count).toBe(5);
    f.advance(1, { rainbow: 0, yellow: 0 }, AREA);
    expect(f.count).toBe(0);
  });

  it('draws whole-pixel streaks 1–2 wide and 6–10 tall inside the area, yellow and not', () => {
    const f = new RainField();
    const counts = { rainbow: 3, yellow: 3 };
    f.advance(0, counts, AREA);
    for (let t = 2; t < 20 * TICKS_PER_SEC; t += 2) {
      f.advance(t, counts, AREA);
      const { ctx, rects } = fakeCtx();
      f.draw(ctx, t, palette, AREA);
      for (const r of rects) {
        expect(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.h)).toBe(true);
        expect([1, 2]).toContain(r.w);
        expect(r.h).toBeGreaterThan(0);
        expect(r.h).toBeLessThanOrEqual(10);
        expect(r.y).toBeGreaterThanOrEqual(AREA.top);
        expect(r.y + r.h).toBeLessThanOrEqual(AREA.bottom);
        expect(r.x).toBeGreaterThanOrEqual(AREA.left);
        expect(r.x + r.w).toBeLessThanOrEqual(AREA.right);
      }
    }
  });

  it('colours S lines with the palette yellow and S+ lines with the rainbow', () => {
    const f = new RainField();
    const counts = { rainbow: 2, yellow: 2 };
    f.advance(0, counts, AREA, true); // still: every streak is on screen
    const { ctx, rects } = fakeCtx();
    f.draw(ctx, 0, palette, AREA, true);
    expect(rects.map((r) => r.fill).slice(2)).toEqual([palette.yellow, palette.yellow]);
    const [a, b] = rects.slice(0, 2).map((r) => r.fill);
    expect(a).toMatch(/^hsl\(/);
    expect(b).toMatch(/^hsl\(/);
    expect(a).not.toBe(b);
  });

  it('keeps falling: streaks come back at new places', () => {
    const f = new RainField();
    const counts = { rainbow: 0, yellow: 1 };
    f.advance(0, counts, AREA);
    const xs = new Set<number>();
    let t = 0;
    for (let i = 0; i < 40; i++) {
      t = run(f, t, 1, counts);
      const { ctx, rects } = fakeCtx();
      f.draw(ctx, t, palette, AREA);
      for (const r of rects) xs.add(r.x);
    }
    expect(xs.size).toBeGreaterThan(5);
  });

  it('moves down while ticks pass and stands still when they do not (paused)', () => {
    const f = new RainField();
    const counts = { rainbow: 0, yellow: 1 };
    f.advance(0, counts, AREA);
    const bottom = (t: number) => {
      f.advance(t, counts, AREA);
      const { ctx, rects } = fakeCtx();
      f.draw(ctx, t, palette, AREA);
      return rects.length ? rects[0].y + rects[0].h : null;
    };
    // The new streak waits above the top; step until its tail shows, mid-scene.
    let t = 0;
    let before = bottom(t);
    while ((before === null || before >= H - 12) && t < 600) {
      t += 2;
      before = bottom(t);
    }
    expect(before).not.toBeNull();
    expect(bottom(t + 6)).toBeGreaterThan(before!);
    // Paused: the same tick again changes nothing.
    expect(bottom(t + 6)).toBe(bottom(t + 6));
  });

  it('stands still with reduced motion, with all streaks on screen', () => {
    const f = new RainField();
    const counts = { rainbow: 2, yellow: 2 };
    f.advance(0, counts, AREA, true);
    const a = fakeCtx();
    f.draw(a.ctx, 0, palette, AREA, true);
    f.advance(600, counts, AREA, true);
    const b = fakeCtx();
    f.draw(b.ctx, 600, palette, AREA, true);
    expect(a.rects).toHaveLength(4);
    expect(b.rects).toEqual(a.rects);
  });

  it('does not jump after a long gap or when the tick count goes back', () => {
    const f = new RainField();
    const counts = { rainbow: 0, yellow: RAIN_MAX_LINES };
    f.advance(1000, counts, AREA);
    expect(() => f.advance(5, counts, AREA)).not.toThrow(); // new game: ticks restart
    expect(() => f.advance(5 + 100000, counts, AREA)).not.toThrow(); // hidden tab
    expect(f.count).toBe(RAIN_MAX_LINES);
  });

  it('moves into a new area (resize) and fits a column narrower than a streak', () => {
    const f = new RainField();
    const counts = { rainbow: 2, yellow: 4 };
    f.advance(0, counts, AREA);
    const moved: RainArea = { left: 5, right: 6, top: 2, bottom: 30 };
    let t = 0;
    for (let i = 0; i < 4 * TICKS_PER_SEC; i += 2) f.advance((t += 2), counts, moved);
    const { ctx, rects } = fakeCtx();
    f.draw(ctx, t, palette, moved);
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) {
      expect(r.x).toBe(5);
      expect(r.w).toBe(1);
      expect(r.y).toBeGreaterThanOrEqual(2);
      expect(r.y + r.h).toBeLessThanOrEqual(30);
    }
  });

  it('rainbow lines change colour as ticks pass; yellow stays the palette yellow', () => {
    const f = new RainField();
    const counts = { rainbow: 1, yellow: 1 };
    f.advance(0, counts, AREA, true);
    const fills = new Set<string>();
    for (let t = 0; t < 6 * TICKS_PER_SEC; t += 10) {
      const { ctx, rects } = fakeCtx();
      f.draw(ctx, t, palette, AREA);
      fills.add(rects[0].fill);
      expect(rects[1].fill).toBe(palette.yellow);
    }
    expect(fills.size).toBeGreaterThan(6);
  });
});
