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

describe('accumulate speed', () => {
  const ticksAt = (speed: number) => accumulate(0, TICK, speed).ticks;

  it('runs ×N ticks per frame at ×N', () => {
    expect(ticksAt(1)).toBe(1);
    expect(ticksAt(2)).toBe(2);
    expect(ticksAt(5)).toBe(5);
    expect(ticksAt(10)).toBe(10);
    expect(ticksAt(20)).toBe(20);
  });

  it('carries the half tick at ×0.5, so one tick every other frame', () => {
    const a = accumulate(0, TICK, 0.5);
    expect(a.ticks).toBe(0);
    expect(accumulate(a.acc, TICK, 0.5).ticks).toBe(1);
  });

  it('is plain real time by default', () => {
    expect(accumulate(0.003, TICK * 2.5)).toEqual(accumulate(0.003, TICK * 2.5, 1));
  });

  it('still caps a long frame (before the multiplier)', () => {
    expect(accumulate(0, 10, 20).ticks).toBe(Math.floor((MAX_FRAME * 20) / TICK));
  });
});
