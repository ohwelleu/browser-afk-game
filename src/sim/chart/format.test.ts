import { describe, expect, it } from 'vitest';
import {
  esc,
  fmtDuration,
  fmtDurationShort,
  fmtNum,
  fmtPct,
  fmtStage,
  parseDuration,
  worldStart,
} from './format';

describe('fmtNum', () => {
  it('prints small numbers in full, up to 3 significant digits', () => {
    expect(fmtNum(0)).toBe('0');
    expect(fmtNum(0.5)).toBe('0.5');
    expect(fmtNum(0.0123)).toBe('0.0123');
    expect(fmtNum(12.34)).toBe('12.3');
    expect(fmtNum(99.99)).toBe('100');
    expect(fmtNum(999)).toBe('999');
    expect(fmtNum(150.6)).toBe('151');
  });

  it('groups thousands under 10,000', () => {
    expect(fmtNum(1234)).toBe('1,234');
    expect(fmtNum(9999)).toBe('9,999');
  });

  it('goes compact at 10,000 and up', () => {
    expect(fmtNum(10_000)).toBe('10K');
    expect(fmtNum(12_900)).toBe('12.9K');
    expect(fmtNum(4_200_000)).toBe('4.2M');
    expect(fmtNum(1.5e9)).toBe('1.5B');
    expect(fmtNum(2.5e12)).toBe('2.5T');
  });

  it('rolls over to the next suffix instead of printing 1000K', () => {
    expect(fmtNum(999_999)).toBe('1M');
    expect(fmtNum(999_499)).toBe('999K');
  });

  it('switches to scientific past the last suffix', () => {
    expect(fmtNum(1e36)).toBe('1e36');
    expect(fmtNum(1.234e40)).toBe('1.2e40');
    expect(fmtNum(9.99e40)).toBe('1e41');
  });

  it('handles signs and non-finite values', () => {
    expect(fmtNum(-1234)).toBe('−1,234');
    expect(fmtNum(-12_900)).toBe('−12.9K');
    expect(fmtNum(NaN)).toBe('–');
    expect(fmtNum(Infinity)).toBe('∞');
    expect(fmtNum(-Infinity)).toBe('−∞');
  });

  it('formats percentages from shares', () => {
    expect(fmtPct(0.0125)).toBe('1.25%');
    expect(fmtPct(0.5)).toBe('50%');
  });
});

describe('durations', () => {
  it('short form for axes', () => {
    expect(fmtDurationShort(45)).toBe('45s');
    expect(fmtDurationShort(90)).toBe('1.5m');
    expect(fmtDurationShort(600)).toBe('10m');
    expect(fmtDurationShort(8 * 3600)).toBe('8h');
    expect(fmtDurationShort(5400)).toBe('1.5h');
    expect(fmtDurationShort(2 * 86400)).toBe('2d');
    expect(fmtDurationShort(Infinity)).toBe('–');
  });

  it('long form for tables and tiles', () => {
    expect(fmtDuration(0)).toBe('0s');
    expect(fmtDuration(59.6)).toBe('1m 00s');
    expect(fmtDuration(185)).toBe('3m 05s');
    expect(fmtDuration(2 * 3600 + 7 * 60 + 30)).toBe('2h 07m');
    expect(fmtDuration(86400 + 4 * 3600)).toBe('1d 4h');
    expect(fmtDuration(Infinity)).toBe('–');
  });

  it('parses scenario durations', () => {
    expect(parseDuration(90)).toBe(90);
    expect(parseDuration('45s')).toBe(45);
    expect(parseDuration('5m')).toBe(300);
    expect(parseDuration('1.5h')).toBe(5400);
    expect(parseDuration('2d')).toBe(172800);
    expect(parseDuration('30')).toBe(30);
    expect(() => parseDuration('soon')).toThrow(/bad duration/);
  });
});

describe('stages', () => {
  it('prints levels as world.stage like the game', () => {
    expect(fmtStage(1)).toBe('1.1');
    expect(fmtStage(6)).toBe('1.6');
    expect(fmtStage(7)).toBe('2.1');
    expect(fmtStage(55)).toBe('10.1');
    expect(fmtStage(7.9)).toBe('2.1');
    expect(fmtStage(0)).toBe('–');
    expect(fmtStage(NaN)).toBe('–');
  });

  it('knows where worlds start', () => {
    expect([2, 3, 5, 10].map(worldStart)).toEqual([7, 13, 25, 55]);
  });
});

describe('esc', () => {
  it('escapes everything that matters in text and attributes', () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
    expect(esc(5)).toBe('5');
  });
});
