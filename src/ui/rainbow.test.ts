import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTES } from '../theme';
import {
  RAINBOW_PERIOD_MS,
  RAINBOW_STOPS,
  RAINBOW_STYLES,
  rainbowColor,
  rainbowPhase,
  rainbowStep,
} from './rainbow';

const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('rainbowPhase', () => {
  it('is 0..1 and repeats every period', () => {
    expect(rainbowPhase(0)).toBe(0);
    expect(rainbowPhase(RAINBOW_PERIOD_MS / 4)).toBeCloseTo(0.25);
    expect(rainbowPhase(RAINBOW_PERIOD_MS)).toBe(0);
    expect(rainbowPhase(RAINBOW_PERIOD_MS * 3 + 1500, 6000)).toBeCloseTo(0.25);
  });

  it('wraps negative time into 0..1', () => {
    expect(rainbowPhase(-1500, 6000)).toBeCloseTo(0.75);
    expect(rainbowPhase(-6000, 6000)).toBeCloseTo(0);
  });

  it('falls back to 0 for NaN, Infinity or a bad period', () => {
    expect(rainbowPhase(Number.NaN)).toBe(0);
    expect(rainbowPhase(Infinity)).toBe(0);
    expect(rainbowPhase(100, 0)).toBe(0);
    expect(rainbowPhase(100, -5)).toBe(0);
    expect(rainbowPhase(100, Number.NaN)).toBe(0);
  });
});

describe('rainbowColor (smooth)', () => {
  const step = RAINBOW_PERIOD_MS / RAINBOW_STOPS.length;

  it('hits each stop exactly at its time and wraps back to the first', () => {
    RAINBOW_STOPS.forEach((c, i) => expect(rainbowColor(i * step)).toBe(c));
    expect(rainbowColor(RAINBOW_PERIOD_MS)).toBe(RAINBOW_STOPS[0]);
    expect(rainbowColor(RAINBOW_PERIOD_MS * 5)).toBe(RAINBOW_STOPS[0]);
  });

  it('blends halfway between two stops', () => {
    // #e11d1d and #d95a00 -> #dd3c0f (rounded)
    expect(rainbowColor(step / 2)).toBe('#dd3c0f');
  });

  it('blends the last stop back into the first (no jump at the wrap)', () => {
    const last = RAINBOW_STOPS.length - 1;
    expect(rainbowColor(last * step + step / 2)).not.toBe(RAINBOW_STOPS[last]);
    // pink #d6307f and red #e11d1d -> #dc274e
    expect(rainbowColor(RAINBOW_PERIOD_MS - step / 2)).toBe('#dc274e');
  });

  it('always returns #rrggbb', () => {
    for (let t = -7000; t < 14000; t += 137) expect(rainbowColor(t)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('follows the period', () => {
    expect(rainbowColor(1000, 7000)).toBe(RAINBOW_STOPS[1]);
  });
});

describe('rainbowStep (stepped)', () => {
  const step = RAINBOW_PERIOD_MS / RAINBOW_STOPS.length;

  it('holds one stop for its whole slot, then jumps', () => {
    RAINBOW_STOPS.forEach((c, i) => {
      expect(rainbowStep(i * step)).toBe(c);
      expect(rainbowStep(i * step + step - 1)).toBe(c);
    });
  });

  it('wraps after a full period and for negative time', () => {
    expect(rainbowStep(RAINBOW_PERIOD_MS)).toBe(RAINBOW_STOPS[0]);
    expect(rainbowStep(-1)).toBe(RAINBOW_STOPS[RAINBOW_STOPS.length - 1]);
  });

  it('only ever returns a stop', () => {
    for (let t = -7000; t < 14000; t += 97) expect(RAINBOW_STOPS).toContain(rainbowStep(t));
  });
});

describe('contrast (rainbow is fixed in both themes)', () => {
  const backgrounds = [DEFAULT_PALETTES.light.bg, DEFAULT_PALETTES.dark.bg];

  it('every stop and every blend is at least 3:1 on the light and the dark background', () => {
    const colours = [
      ...RAINBOW_STOPS,
      ...Array.from({ length: 360 }, (_, i) => rainbowColor(i * 16.67)),
    ];
    for (const c of colours) {
      for (const bg of backgrounds)
        expect(contrast(c, bg), `${c} on ${bg}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('RAINBOW_STYLES', () => {
  it('has a looping keyframe through every stop, back to the first', () => {
    for (const c of RAINBOW_STOPS) expect(RAINBOW_STYLES).toContain(`color: ${c};`);
    expect(RAINBOW_STYLES).toContain(`100% { color: ${RAINBOW_STOPS[0]}; }`);
    expect(RAINBOW_STYLES).toContain('infinite');
  });

  it('stops the animation for prefers-reduced-motion', () => {
    expect(RAINBOW_STYLES).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/);
  });
});
