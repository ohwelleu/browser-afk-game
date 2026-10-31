import { describe, expect, it } from 'vitest';
import { accumulate, MAX_FRAME, TICK } from './loop';

describe('accumulate', () => {
  it('runs one tick per 1/60 s', () => {
    expect(accumulate(0, TICK).ticks).toBe(1);
    expect(accumulate(0, TICK * 3).ticks).toBe(3);
  });

  it('carries the remainder to the next frame', () => {
    const a = accumulate(0, TICK * 0.6);
    expect(a.ticks).toBe(0);
    const b = accumulate(a.acc, TICK * 0.6);
    expect(b.ticks).toBe(1);
    expect(b.acc).toBeCloseTo(TICK * 0.2);
  });

  it('caps long frames instead of catching up', () => {
    expect(accumulate(0, 10).ticks).toBe(Math.floor(MAX_FRAME / TICK));
  });

  it('ignores negative frame time', () => {
    expect(accumulate(0, -1)).toEqual({ ticks: 0, acc: 0 });
  });
});
