import { RAIN_MAX_LINES, type RainCounts } from '../game/rain';
import { nextFloat, type Rng } from '../game/rng';
import { TICK_RATE } from '../loop';
import type { Palette } from '../theme';
import { rainbowStep } from '../ui/rainbow';

/** Streak length and width, in art pixels. */
const LENGTH = { min: 6, max: 10 };
const WIDTH = { min: 1, max: 2 };
/** Fall speed in art pixels per second (the scene is ~50 art pixels tall: about a second down). */
const SPEED = { min: 50, max: 80 };
/** A respawned streak waits above the top for up to this share of the scene height. */
const RESPAWN_SPREAD = 0.5;
/** Longest step we move in one frame, in seconds (a tab that was hidden doesn't jump). */
const MAX_STEP = 0.25;
/** One trip through the rainbow stops for a rainbow line, in milliseconds. */
export const RAIN_RAINBOW_PERIOD_MS = 6000;

type Streak = {
  /** Left edge and top, in art pixels. `y` is above the scene while it waits to fall. */
  x: number;
  y: number;
  len: number;
  width: number;
  speed: number;
};

const rand = (rng: Rng, min: number, max: number): number => min + nextFloat(rng) * (max - min);
const randInt = (rng: Rng, min: number, max: number): number =>
  min + Math.floor(nextFloat(rng) * (max - min + 1));

/**
 * The falling lines behind the scene. A fixed pool of `RAIN_MAX_LINES` streaks
 * (the first ones rainbow, the next yellow, the rest idle), reused for ever:
 * nothing is allocated per frame. Time comes from the game's tick count, so the
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
   * Moves the streaks to game tick `ticks` in a scene `width` × `height` art
   * pixels. `reduced` (prefers-reduced-motion): the streaks stand still.
   */
  advance(ticks: number, counts: RainCounts, width: number, height: number, reduced = false): void {
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
        this.respawn(st, width);
        // New lines start above the top, or somewhere on screen when still.
        st.y = reduced
          ? Math.floor(nextFloat(this.rng) * height)
          : -st.len - this.spread(height, 1);
        continue;
      }
      if (reduced) continue;
      st.y += st.speed * dt;
      if (st.y > height || st.x + st.width > width) {
        this.respawn(st, width);
        st.y = -st.len - this.spread(height, RESPAWN_SPREAD);
      }
    }
  }

  /** Draws the streaks in art pixels; call with the scene transform set. Needs `advance` first. */
  draw(ctx: CanvasRenderingContext2D, ticks: number, p: Palette, height: number, reduced = false) {
    const ms = reduced ? 0 : (ticks / TICK_RATE) * 1000;
    // Each rainbow line is a different step of the cycle, so the lines are not one colour.
    const offset = RAIN_RAINBOW_PERIOD_MS / RAIN_MAX_LINES;
    for (let i = 0; i < this.count; i++) {
      const st = this.streaks[i];
      ctx.fillStyle =
        i < this.rainbow ? rainbowStep(ms + i * offset, RAIN_RAINBOW_PERIOD_MS) : p.yellow;
      // Whole pixels, cut at the top and bottom of the scene.
      const top = Math.max(0, Math.round(st.y));
      const bottom = Math.min(height, Math.round(st.y) + st.len);
      if (bottom > top) ctx.fillRect(st.x, top, st.width, bottom - top);
    }
  }

  private spread(height: number, share: number): number {
    return Math.floor(nextFloat(this.rng) * height * share);
  }

  /** New random size, speed and column; the caller sets `y`. */
  private respawn(st: Streak, width: number): void {
    st.len = randInt(this.rng, LENGTH.min, LENGTH.max);
    st.width = randInt(this.rng, WIDTH.min, WIDTH.max);
    st.speed = rand(this.rng, SPEED.min, SPEED.max);
    st.x = Math.floor(nextFloat(this.rng) * Math.max(1, width - st.width + 1));
  }
}
