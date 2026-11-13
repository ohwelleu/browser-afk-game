import { describe, expect, it } from 'vitest';
import {
  downsample,
  linearTicks,
  logTicks,
  makeScale,
  quantile,
  safeDomain,
  stageTicks,
  timeTicks,
} from './scale';

describe('safeDomain', () => {
  it('gives a usable domain for empty data', () => {
    expect(safeDomain([], 'linear')).toEqual([0, 1]);
    expect(safeDomain([], 'log')).toEqual([1, 10]);
    expect(safeDomain([NaN, Infinity], 'linear')).toEqual([0, 1]);
  });

  it('widens a single value', () => {
    expect(safeDomain([5], 'linear')).toEqual([4, 6]);
    expect(safeDomain([5], 'linear', true)).toEqual([0, 5]);
    expect(safeDomain([0], 'linear')).toEqual([0, 1]);
    const [lo, hi] = safeDomain([100], 'log');
    expect(lo).toBeLessThan(100);
    expect(hi).toBeGreaterThan(100);
  });

  it('ignores zero and negative values on a log axis', () => {
    expect(safeDomain([0, -3, 10, 1000], 'log')).toEqual([10, 1000]);
  });

  it('includes zero when asked', () => {
    expect(safeDomain([3, 8], 'linear', true)).toEqual([0, 8]);
  });
});

describe('makeScale', () => {
  it('maps linear and log domains onto the range', () => {
    const lin = makeScale('linear', [0, 10], [0, 100]);
    expect(lin(5)).toBe(50);
    const log = makeScale('log', [1, 1000], [0, 300]);
    expect(log(10)).toBeCloseTo(100);
    expect(log(1000)).toBeCloseTo(300);
  });

  it('never returns NaN for a flat domain or a zero on a log axis', () => {
    expect(Number.isFinite(makeScale('linear', [3, 3], [0, 100])(3))).toBe(true);
    expect(Number.isFinite(makeScale('log', [1, 10], [0, 100])(0))).toBe(true);
  });
});

describe('ticks', () => {
  it('linear ticks are round and cover the data', () => {
    expect(linearTicks([0, 9.3], 5)).toEqual({ ticks: [0, 2, 4, 6, 8, 10], domain: [0, 10] });
    expect(linearTicks([0, 0.3], 3).ticks).toEqual([0, 0.1, 0.2, 0.3]);
    expect(linearTicks([0, 2_500_000], 5).ticks).toEqual([
      0, 500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000,
    ]);
  });

  it('log ticks are powers of ten, thinned on wide spans', () => {
    expect(logTicks([1, 1000]).ticks).toEqual([1, 10, 100, 1000]);
    const wide = logTicks([1, 1e20], 7).ticks;
    expect(wide.length).toBeLessThanOrEqual(7);
    expect(wide[0]).toBe(1);
  });

  it('log ticks add 2 and 5 inside a narrow span', () => {
    expect(logTicks([10, 60]).ticks).toEqual([10, 20, 50]);
  });

  it('time ticks use clock values', () => {
    expect(timeTicks([5, 8 * 3600], 'log').ticks).toEqual([10, 60, 600, 3600, 28800]);
    expect(timeTicks([0, 8 * 3600], 'linear').ticks).toEqual([0, 7200, 14400, 21600, 28800]);
    // A narrow log range falls back to the denser list and widens past the data.
    const narrow = timeTicks([700, 1300], 'log');
    expect(narrow.ticks).toEqual([600, 1200, 1800]);
    expect(narrow.domain).toEqual([600, 1800]);
  });

  it('stage ticks sit on world starts', () => {
    expect(stageTicks([1, 14]).ticks).toEqual([1, 7, 13, 19]);
    // 15 worlds: every 5th world, labelled 1.1, 5.1, 10.1, 15.1.
    expect(stageTicks([1, 85]).ticks).toEqual([1, 25, 55, 85]);
    // Inside one world: one tick per stage.
    expect(stageTicks([1, 4]).ticks).toEqual([1, 2, 3, 4]);
    expect(stageTicks([3, 3]).ticks).toEqual([3, 4]);
  });
});

describe('quantile and downsample', () => {
  it('interpolates quantiles and skips non-finite values', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([10], 0.9)).toBe(10);
    expect(quantile([], 0.5)).toBeNaN();
    expect(quantile([1, NaN, 3], 0.5)).toBe(2);
  });

  it('keeps first, last and requested points', () => {
    const xs = Array.from({ length: 1000 }, (_, i) => i);
    const out = downsample(xs, 100, (x) => x === 555);
    expect(out.length).toBeLessThanOrEqual(102);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(999);
    expect(out).toContain(555);
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });
});
