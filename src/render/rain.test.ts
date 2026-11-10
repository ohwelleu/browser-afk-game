import { describe, expect, it } from 'vitest';
import { RAIN_LINES_PER_ITEM, RAIN_MAX_LINES, rainForItems } from '../game/rain';
import { DEFAULT_PALETTES } from '../theme';
import { goldLight } from '../ui/rainbow';
import { RainField, STEP_MS, type RainArea } from './rain';

const H = 50;
/**
 * A wide column (1 px lines: two in one column would run together in `lines()`),
 * from row 10 down to the ground at `H`.
 */
const AREA: RainArea = { left: 30, right: 1030, top: 10, bottom: H };
const TICKS_PER_SEC = 60;
/** A tall area: after a moment a line is mid-way down and cut at neither end. */
const TALL: RainArea = { left: 30, right: 1030, top: 10, bottom: 400 };
/** One line, fully on screen: runs the field for 2 s in `TALL`, so the line is mid-way down. */
function midLine(counts: { rainbow: number; yellow: number }) {
  const f = new RainField();
  for (let t = 0; t <= 2 * TICKS_PER_SEC; t += 2) f.advance(t, counts, TALL);
  return { f, t: 2 * TICKS_PER_SEC };
}

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

/** One falling line as drawn: its rects (runs of rows) from top to bottom. */
type Line = Rect[];
/** Groups rects into lines: a line is a run of rects with the same x and width that touch. */
function lines(rects: Rect[]): Line[] {
  const out: Line[] = [];
  for (const r of rects) {
    const last = out[out.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && prev.x === r.x && prev.w === r.w && prev.y + prev.h === r.y) last.push(r);
    else out.push([r]);
  }
  return out;
}
/** The colour of every row of a line, top to bottom. */
const rowColours = (line: Line): string[] =>
  line.flatMap((r) => Array.from({ length: r.h }, () => r.fill));
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

  it('draws whole-pixel streaks exactly 1 wide and 6–10 tall inside the area, yellow and not', () => {
    const f = new RainField();
    const counts = { rainbow: 3, yellow: 3 };
    f.advance(0, counts, AREA);
    for (let t = 2; t < 20 * TICKS_PER_SEC; t += 2) {
      f.advance(t, counts, AREA);
      const { ctx, rects } = fakeCtx();
      f.draw(ctx, t, palette, AREA);
      for (const r of rects) {
        expect(Number.isInteger(r.x) && Number.isInteger(r.y) && Number.isInteger(r.h)).toBe(true);
        expect(r.w).toBe(1);
        expect(r.h).toBeGreaterThan(0);
        expect(r.h).toBeLessThanOrEqual(10);
        expect(r.y).toBeGreaterThanOrEqual(AREA.top);
        expect(r.y + r.h).toBeLessThanOrEqual(AREA.bottom);
        expect(r.x).toBeGreaterThanOrEqual(AREA.left);
        expect(r.x + r.w).toBeLessThanOrEqual(AREA.right);
      }
    }
  });

  it('colours S lines gold (palette orange / yellow) and S+ lines with the rainbow', () => {
    const f = new RainField();
    const counts = { rainbow: 2, yellow: 2 };
    f.advance(0, counts, AREA, true); // still: every streak is on screen
    const { ctx, rects } = fakeCtx();
    f.draw(ctx, 0, palette, AREA, true);
    const [r1, r2, g1, g2] = lines(rects);
    // Gold lines are the light orange and the palette yellow only.
    for (const g of [g1, g2]) {
      for (const c of rowColours(g)) expect([goldLight(palette), palette.yellow]).toContain(c);
    }
    // Rainbow lines are hsl, and differ from each other.
    for (const r of [r1, r2]) for (const c of rowColours(r)) expect(c).toMatch(/^hsl\(/);
    expect(rowColours(r1)[0]).not.toBe(rowColours(r2)[0]);
  });

  it('changes colour ALONG a line: every row of a rainbow line is a step further on', () => {
    const { f, t } = midLine({ rainbow: 1, yellow: 0 });
    const { ctx, rects } = fakeCtx();
    f.draw(ctx, t, palette, TALL);
    const rows = rowColours(lines(rects)[0]);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (let r = 1; r < rows.length; r++) expect(rows[r]).not.toBe(rows[r - 1]);
  });

  it('makes gold lines in orange / yellow bands 2 rows tall', () => {
    const { f, t } = midLine({ rainbow: 0, yellow: 1 });
    const { ctx, rects } = fakeCtx();
    f.draw(ctx, t, palette, TALL);
    const line = lines(rects)[0];
    const rows = rowColours(line);
    expect(rows.length).toBeGreaterThanOrEqual(6);
    // Runs are whole bands (2 rows), alternating orange / yellow; the last may be cut short.
    for (const r of line.slice(0, -1)) expect(r.h).toBe(2);
    for (let i = 1; i < line.length; i++) expect(line[i].fill).not.toBe(line[i - 1].fill);
    expect(new Set(rows)).toEqual(new Set([goldLight(palette), palette.yellow]));
  });

  it('moves the colours down the line as time passes (falling pattern)', () => {
    const { f, t } = midLine({ rainbow: 1, yellow: 0 });
    const at = (ticks: number) => {
      const { ctx, rects } = fakeCtx();
      f.draw(ctx, ticks, palette, TALL); // only the time changes: the line stays where it is
      return rowColours(lines(rects)[0]);
    };
    const a = at(t);
    const b = at(t + (STEP_MS / 1000) * TICKS_PER_SEC); // one step later
    expect(b.slice(1)).toEqual(a.slice(0, -1));
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
    expect(lines(a.rects)).toHaveLength(4);
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

  it('rainbow lines step through the rainbow; gold lines step orange ↔ yellow', () => {
    const f = new RainField();
    const counts = { rainbow: 1, yellow: 1 };
    f.advance(0, counts, AREA, true);
    const fills = new Set<string>();
    const golds = new Set<string>();
    for (let t = 0; t < 6 * TICKS_PER_SEC; t += 10) {
      const { ctx, rects } = fakeCtx();
      f.draw(ctx, t, palette, AREA);
      const [r, g] = lines(rects);
      rowColours(r).forEach((c) => fills.add(c));
      rowColours(g).forEach((c) => golds.add(c));
    }
    expect(fills.size).toBeGreaterThan(6);
    expect(golds).toEqual(new Set([goldLight(palette), palette.yellow]));
  });

  it('never uses the palette orange (the darkest) on a gold line', () => {
    const f = new RainField();
    f.advance(0, { rainbow: 0, yellow: 5 }, AREA);
    for (let t = 0; t < 4 * TICKS_PER_SEC; t += 6) {
      f.advance(t, { rainbow: 0, yellow: 5 }, AREA);
      const { ctx, rects } = fakeCtx();
      f.draw(ctx, t, palette, AREA);
      for (const r of rects) expect(r.fill).not.toBe(palette.orange);
    }
  });

  it('shows the colour flow within a second: a line changes colour several times as it falls', () => {
    for (const [counts, min] of [
      [{ rainbow: 1, yellow: 0 }, 4],
      [{ rainbow: 0, yellow: 1 }, 2], // gold has two looks: orange first, or yellow first
    ] as const) {
      const { f, t } = midLine(counts);
      const seen = new Set<string>();
      for (let dt = 0; dt < TICKS_PER_SEC; dt += 6) {
        const { ctx, rects } = fakeCtx();
        f.draw(ctx, t + dt, palette, TALL); // time only: the line stays put
        seen.add(rowColours(lines(rects)[0]).join());
      }
      expect(seen.size).toBeGreaterThanOrEqual(min);
    }
  });

  it('spreads the lines over the real height even if the first frame had a tiny area (page start)', () => {
    // The game draws once before it knows its size (a 1 x 1 view), then again at the real size.
    const f = new RainField();
    const counts = rainForItems(0, 1);
    f.advance(0, counts, { left: 30, right: 1030, top: 10, bottom: 11 });
    f.advance(1, counts, AREA);
    const { ctx, rects } = fakeCtx();
    f.draw(ctx, 1, palette, AREA);
    const tops = lines(rects).map((l) => l[0].y);
    expect(tops).toHaveLength(RAIN_LINES_PER_ITEM);
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan((AREA.bottom - AREA.top) / 2);
  });

  it('shows all 5 lines of every item on screen, every frame (1 item = 5, 2 items = 10)', () => {
    for (const [sPlus, sItems] of [
      [1, 0],
      [1, 1],
      [2, 2],
    ]) {
      const counts = rainForItems(sPlus, sItems);
      expect(counts.rainbow + counts.yellow).toBe((sPlus + sItems) * RAIN_LINES_PER_ITEM);
      const f = new RainField();
      for (let t = 0; t < 10 * TICKS_PER_SEC; t += 2) {
        f.advance(t, counts, AREA);
        const { ctx, rects } = fakeCtx();
        f.draw(ctx, t, palette, AREA);
        expect(lines(rects)).toHaveLength(counts.rainbow + counts.yellow);
      }
    }
  });

  it('fills the whole pool when every slot is S+ (cap = 5 × slots), all on screen', () => {
    const f = new RainField();
    const counts = { rainbow: RAIN_MAX_LINES, yellow: 0 };
    f.advance(0, counts, AREA);
    const { ctx, rects } = fakeCtx();
    f.draw(ctx, 0, palette, AREA);
    expect(lines(rects)).toHaveLength(RAIN_MAX_LINES);
  });

  it("staggers an item's 5 lines over the height (they don't fall in step)", () => {
    const f = new RainField();
    f.advance(0, rainForItems(0, 1), AREA);
    const { ctx, rects } = fakeCtx();
    f.draw(ctx, 0, palette, AREA);
    const tops = lines(rects)
      .map((l) => l[l.length - 1].y + l[l.length - 1].h)
      .sort((a, b) => a - b);
    expect(new Set(tops).size).toBe(RAIN_LINES_PER_ITEM);
    // Spread over most of the zone, not bunched up.
    expect(tops[tops.length - 1] - tops[0]).toBeGreaterThan((AREA.bottom - AREA.top) / 2);
  });
});
