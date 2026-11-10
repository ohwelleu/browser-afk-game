import { RAIN_LINES_PER_ITEM, RAIN_MAX_LINES, type RainCounts } from '../game/rain';
import { nextFloat, type Rng } from '../game/rng';
import { TICK_RATE } from '../loop';
import type { Palette } from '../theme';
import { RAINBOW_HUES, rainbowHsl } from '../ui/rainbow';

/** Streak length and width, in art pixels. */
const LENGTH = { min: 6, max: 10 };
const WIDTH = { min: 1, max: 2 };
/** Fall speed in art pixels per second (the hero is ~64 art pixels tall: about a second down). */
const SPEED = { min: 50, max: 80 };
/** Longest step we move in one frame, in seconds (a tab that was hidden doesn't jump). */
const MAX_STEP = 0.25;
/** One trip through the rainbow stops for a rainbow line, in milliseconds. */
export const RAIN_RAINBOW_PERIOD_MS = 6000;
/** Time a rain line shows one colour, in milliseconds. */
const STEP_MS = RAIN_RAINBOW_PERIOD_MS / (RAINBOW_HUES.length - 1);
/** The rainbow's stops as CSS colours, built once (hue 360 repeats red, so it is left out). */
const RAINBOW_CYCLE: readonly string[] = RAINBOW_HUES.slice(0, -1).map((h) => rainbowHsl(h));
/** Rows of one gold band (orange or yellow) along a gold line. */
const GOLD_BAND_ROWS = 2;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * Where the rain falls, in art pixels: the columns `left` (inclusive) to
 * `right` (exclusive) and the rows `top` to `bottom`. Streaks are cut at both.
 */
export type RainArea = { left: number; right: number; top: number; bottom: number };

type Streak = {
  /**
   * Left edge and top, in art pixels. `y` stays in `[top - len + 1, bottom - 1]`,
   * so at least 1 px of every streak is always on screen.
   */
  x: number;
  y: number;
  len: number;
  width: number;
  speed: number;
};

/** Highest place a streak can be with its last pixel still inside the area. */
const firstY = (st: Streak, area: RainArea): number => area.top - st.len + 1;

const rand = (rng: Rng, min: number, max: number): number => min + nextFloat(rng) * (max - min);
const randInt = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(nextFloat(rng) * (max - min + 1));

/**
 * The falling lines behind the hero. A fixed pool of `RAIN_MAX_LINES` streaks
 * (the first ones rainbow, the next gold, the rest idle), reused for ever:
 * nothing is allocated per frame. Every line is always on screen: one that
 * leaves at the bottom comes back in at the top (new column, size and speed).
 * New lines start spread over the height, `RAIN_LINES_PER_ITEM` per item, so
 * an item's lines don't fall in step. Time comes from the game's tick count, so the
 * rain stands still when the game is paused. Its random numbers come from a
 * private generator, never the game's.
 */
export class RainField {
  private readonly streaks: Streak[] = Array.from({ length: RAIN_MAX_LINES }, () => ({
    x: 0,
    y: 0,
    len: LENGTH.min,
    width: WIDTH.min,
    speed: SPEED.min,
  }));
  private readonly rng: Rng = { state: 0x5a17ed };
  private rainbow = 0;
  private yellow = 0;
  private lastTick = Number.NaN;

  /** Streaks currently shown. */
  get count(): number {
    return this.rainbow + this.yellow;
  }

  /**
   * Moves the streaks to game tick `ticks` inside `area`. `reduced` (the
   * Animations setting is Reduced): the streaks stand still.
   */
  advance(ticks: number, counts: RainCounts, area: RainArea, reduced = false): void {
    const height = area.bottom - area.top;
    const before = this.count;
    this.rainbow = counts.rainbow;
    this.yellow = counts.yellow;
    const dt = Number.isNaN(this.lastTick)
      ? 0
      : Math.min(MAX_STEP, Math.max(0, (ticks - this.lastTick) / TICK_RATE));
    this.lastTick = ticks;

    for (let i = 0; i < this.count; i++) {
      const st = this.streaks[i];
      if (i >= before) {
        this.respawn(st, area);
        // Line k of its item's group starts k/5 of the way down (plus a little jitter).
        const group = i < this.rainbow ? i : i - this.rainbow;
        const k = group % RAIN_LINES_PER_ITEM;
        const share = (k + nextFloat(this.rng) * 0.5) / RAIN_LINES_PER_ITEM;
        st.y = firstY(st, area) + share * Math.max(0, height + st.len - 2);
        continue;
      }
      if (st.x < area.left || st.x + st.width > area.right) this.place(st, area); // area moved
      if (!reduced) st.y += st.speed * dt;
      if (st.y > area.bottom - 1) {
        // Out at the bottom: back in at the top, as a new line.
        this.respawn(st, area);
        st.y = firstY(st, area);
      } else if (st.y < firstY(st, area)) {
        st.y = firstY(st, area); // area moved down
      }
    }
  }

  /** Draws the streaks in art pixels; call with the scene transform set. Needs `advance` first. */
  draw(ctx: CanvasRenderingContext2D, ticks: number, p: Palette, area: RainArea, reduced = false) {
    const step = reduced ? 0 : Math.floor(((ticks / TICK_RATE) * 1000) / STEP_MS);
    for (let i = 0; i < this.count; i++) {
      const st = this.streaks[i];
      const rainbow = i < this.rainbow;
      // Whole pixels, cut at the top and bottom of the area. `row` counts from the
      // line's own top, so the colours fall with it and flow down along it: row r
      // shows the colour row r - 1 showed one step ago. Line i starts i steps on.
      const y0 = Math.round(st.y);
      const top = Math.max(area.top, y0);
      const bottom = Math.min(area.bottom, y0 + st.len);
      let runTop = top;
      let runColour = '';
      for (let y = top; y <= bottom; y++) {
        const row = y - y0;
        const colour =
          y === bottom
            ? ''
            : rainbow
              ? RAINBOW_CYCLE[mod(step + i - row, RAINBOW_CYCLE.length)]
              : mod(step + i - Math.floor(row / GOLD_BAND_ROWS), 2) === 0
                ? p.orange
                : p.yellow;
        if (colour === runColour) continue;
        // Colour changed: flush the run above (equal rows are drawn as one rect).
        if (runColour && y > runTop) {
          ctx.fillStyle = runColour;
          ctx.fillRect(st.x, runTop, st.width, y - runTop);
        }
        runTop = y;
        runColour = colour;
      }
    }
  }

  /** New random size, speed and column inside `area`; the caller sets `y`. */
  private respawn(st: Streak, area: RainArea): void {
    st.len = randInt(this.rng, LENGTH.min, LENGTH.max);
    st.width = randInt(this.rng, WIDTH.min, WIDTH.max);
    st.speed = rand(this.rng, SPEED.min, SPEED.max);
    this.place(st, area);
  }

  /** New random column inside `area`. */
  private place(st: Streak, area: RainArea): void {
    // A column too narrow for this streak gets a 1 px one.
    if (st.width > area.right - area.left) st.width = WIDTH.min;
    const room = Math.max(1, area.right - area.left - st.width + 1);
    st.x = area.left + Math.floor(nextFloat(this.rng) * room);
  }
}
