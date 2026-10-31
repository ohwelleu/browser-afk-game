import { describe, expect, it } from 'vitest';
import { formatNumber } from './format';

describe('formatNumber', () => {
  it('formats with suffixes', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1240)).toBe('1.2K');
    expect(formatNumber(3_450_000)).toBe('3.4M');
    expect(formatNumber(123_456)).toBe('123K');
    expect(formatNumber(7.8e12)).toBe('7.8T');
    expect(formatNumber(1.23e15)).toBe('1.2e15');
  });

  it('never shows NaN', () => {
    expect(formatNumber(NaN)).toBe('0');
    expect(formatNumber(Infinity)).toBe('0');
  });
});
