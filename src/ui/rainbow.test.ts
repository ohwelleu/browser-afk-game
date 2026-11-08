import { describe, expect, it } from 'vitest';
import {
  RAINBOW_HUES,
  RAINBOW_LIGHTNESS,
  RAINBOW_PERIOD_MS,
  RAINBOW_STOPS,
  RAINBOW_STYLES,
  rainbowColor,
  rainbowGradient,
  rainbowHsl,
  rainbowPhase,
  rainbowStep,
} from './rainbow';

const CYCLE = RAINBOW_HUES.length - 1;
const slot = RAINBOW_PERIOD_MS / CYCLE;

describe('stop list', () => {
  it('is the agreed 13 hues, closing the loop on red', () => {
    expect([...RAINBOW_HUES]).toEqual([0, 30, 45, 60, 70, 90, 120, 180, 200, 240, 270, 300, 360]);
    expect(RAINBOW_HUES[0]).toBe(0);
    expect(RAINBOW_HUES[RAINBOW_HUES.length - 1]).toBe(360);
  });

  it('only ever goes up, so the gradient has no jump', () => {
    RAINBOW_HUES.forEach((h, i) => i && expect(h).toBeGreaterThan(RAINBOW_HUES[i - 1]));
  });

  it('has one hsl() string per hue at full saturation and the same lightness', () => {
    expect(RAINBOW_STOPS).toHaveLength(RAINBOW_HUES.length);
    RAINBOW_STOPS.forEach((c, i) =>
      expect(c).toBe(`hsl(${RAINBOW_HUES[i]}, 100%, ${RAINBOW_LIGHTNESS}%)`),
    );
  });
});

describe('rainbowHsl / rainbowGradient', () => {
  it('formats hsl strings, with a number or a var() lightness', () => {
    expect(rainbowHsl(120)).toBe('hsl(120, 100%, 75%)');
    expect(rainbowHsl(120, 50)).toBe('hsl(120, 100%, 50%)');
    expect(rainbowHsl(120, 'var(--l)')).toBe('hsl(120, 100%, var(--l))');
  });

  it('is a radial-gradient(circle) through every stop in order', () => {
    const g = rainbowGradient();
    expect(g.startsWith('radial-gradient(circle, ')).toBe(true);
    expect(g).toBe(`radial-gradient(circle, ${RAINBOW_STOPS.join(', ')})`);
  });
});

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
  it('hits each stop exactly at its time and wraps back to red', () => {
    RAINBOW_HUES.slice(0, -1).forEach((h, i) => expect(rainbowColor(i * slot)).toBe(rainbowHsl(h)));
    expect(rainbowColor(RAINBOW_PERIOD_MS)).toBe(rainbowHsl(0));
    expect(rainbowColor(RAINBOW_PERIOD_MS * 5)).toBe(rainbowHsl(0));
  });

  it('slides the hue halfway between two stops', () => {
    expect(rainbowColor(slot / 2)).toBe(rainbowHsl(15)); // 0 -> 30
    expect(rainbowColor(RAINBOW_PERIOD_MS - slot / 2)).toBe(rainbowHsl(330)); // 300 -> 360
  });

  it('never decreases the hue within a cycle and always returns hsl()', () => {
    let last = -1;
    for (let t = 0; t < RAINBOW_PERIOD_MS; t += 97) {
      const c = rainbowColor(t);
      expect(c).toMatch(/^hsl\(\d+(\.\d)?, 100%, 75%\)$/);
      const hue = Number(/hsl\(([\d.]+)/.exec(c)![1]);
      expect(hue).toBeGreaterThanOrEqual(last);
      last = hue;
    }
  });

  it('follows the period and the lightness', () => {
    expect(rainbowColor(1000, 12000)).toBe(rainbowHsl(30));
    expect(rainbowColor(0, 1000, 40)).toBe('hsl(0, 100%, 40%)');
  });
});

describe('rainbowStep (stepped)', () => {
  it('holds one stop for its whole slot, then jumps', () => {
    RAINBOW_HUES.slice(0, -1).forEach((h, i) => {
      expect(rainbowStep(i * slot)).toBe(rainbowHsl(h));
      expect(rainbowStep(i * slot + slot - 1)).toBe(rainbowHsl(h));
    });
  });

  it('wraps after a full period and for negative time', () => {
    expect(rainbowStep(RAINBOW_PERIOD_MS)).toBe(rainbowHsl(0));
    expect(rainbowStep(-1)).toBe(rainbowHsl(300));
  });

  it('only ever returns a stop of the list', () => {
    for (let t = -7000; t < 41000; t += 97) expect(RAINBOW_STOPS).toContain(rainbowStep(t));
  });
});

describe('RAINBOW_STYLES', () => {
  it('uses the radial gradient at twice the box size and pans it around the corners', () => {
    expect(RAINBOW_STYLES).toContain(rainbowGradient('var(--afk-rainbow-l, 75%)'));
    expect(RAINBOW_STYLES).toContain('background-size: 200% 200%');
    const positions = ['0% 0%', '100% 0%', '100% 100%', '0% 100%', '0% 0%'];
    [0, 25, 50, 75, 100].forEach((pct, i) =>
      expect(RAINBOW_STYLES).toContain(`${pct}% { background-position: ${positions[i]}; }`),
    );
    expect(RAINBOW_STYLES).toMatch(/animation: afk-rainbow-flow [^;]*ease-in-out infinite/);
  });

  it('takes its speed from --afk-rainbow-period (default 20s)', () => {
    expect(RAINBOW_STYLES).toContain('var(--afk-rainbow-period, 20s)');
  });

  it('has the frame, fill and text classes', () => {
    expect(RAINBOW_STYLES).toContain('.rainbow-frame::before');
    expect(RAINBOW_STYLES).toContain('.rainbow-fill');
    expect(RAINBOW_STYLES).toMatch(/\.rainbow \{[^}]*background-clip: text/);
  });

  it('stops the animation for prefers-reduced-motion', () => {
    expect(RAINBOW_STYLES).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/);
  });
});
