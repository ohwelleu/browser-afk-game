import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  band,
  dropsPerBucket,
  hasWallTime,
  horizons,
  parseReportInput,
  purchaseGaps,
  purchaseGroup,
  quantileWithNever,
  spendPerMin,
  timePerStage,
  timeToReach,
  wallOf,
  type ReportInput,
} from './data';

const small = JSON.parse(
  readFileSync(new URL('./fixtures/small.json', import.meta.url), 'utf8'),
) as ReportInput;
const [idle, greedy] = small.variants;

describe('parseReportInput', () => {
  it('accepts the fixture', () => {
    expect(parseReportInput(small).variants).toHaveLength(2);
  });

  it('names the broken path', () => {
    expect(() => parseReportInput({})).toThrow('scenario must be an object');
    expect(() =>
      parseReportInput({ scenario: { name: 'x', duration: '1h' }, variants: [{}] }),
    ).toThrow('variants[0].id');
    expect(() =>
      parseReportInput({
        scenario: { name: 'x', duration: '1h' },
        variants: [{ id: 'a', label: 'a', runs: [{ samples: [] }] }],
      }),
    ).toThrow('variants[0].runs[0].milestones must be an array');
    expect(() =>
      parseReportInput({ scenario: { name: 'x', duration: 'soon' }, variants: [] }),
    ).toThrow(/bad duration/);
  });
});

describe('bands across runs', () => {
  it('p10 / median / p90 of a field on the time grid', () => {
    const b = band(idle, (s) => s.best);
    expect(b.map((p) => p.x)).toEqual([60, 600, 1800, 3600]);
    expect(b[1]).toEqual({ x: 600, lo: 3.1, mid: 3.5, hi: 3.9 });
  });

  it('holds the last value until the next sample', () => {
    expect(band(idle, (s) => s.best, 'play', [100])[0].mid).toBe(2);
  });
});

describe('time to reach a level', () => {
  it('counts runs that never got there as slower than any that did', () => {
    expect(quantileWithNever([100, Infinity], 0.5)).toBe(Infinity);
    expect(quantileWithNever([100, 200, Infinity], 0.5)).toBe(200);
    expect(quantileWithNever([], 0.5)).toBeNaN();
    const r = timeToReach(idle, 5);
    expect(r).toMatchObject({ never: 1, runs: 2, mid: Infinity });
    expect(timeToReach(idle, 4).mid).toBe(700);
  });

  it('uses the first milestone at or above the level (levels can be skipped)', () => {
    expect(timeToReach(greedy, 5).mid).toBe(290);
  });

  it('maps play time to wall time', () => {
    expect(hasWallTime(small)).toBe(true);
    const run = greedy.runs[0];
    expect(wallOf(run, 1800)).toBe(3600);
    expect(wallOf(run, 2000)).toBe(3800);
    expect(wallOf(run, 10)).toBe(10);
    expect(timeToReach(greedy, 13, 'wall').mid).toBe(3600 + 1200);
  });
});

describe('derived series', () => {
  it('time per stage is the gap to the next first reach', () => {
    const rows = timePerStage(idle);
    expect(rows[0]).toEqual({ level: 1, seconds: 42.5, deaths: 0 });
    expect(rows.find((r) => r.level === 4)?.deaths).toBe(1.5);
  });

  it('spend per minute from cumulative spend', () => {
    const s = spendPerMin(greedy);
    expect(s.find((p) => p.x === 600)?.mid).toBeCloseTo(((400 - 10) / 540) * 60);
    expect(spendPerMin(idle).every((p) => p.mid === 0)).toBe(true);
  });

  it('drops per bucket from cumulative drops', () => {
    const d = dropsPerBucket(greedy, 3600);
    expect(d.size).toBe(300);
    const total = (t: keyof typeof d.perTier) => d.perTier[t].reduce((a, b) => a + b, 0);
    expect(total('C')).toBe(6);
    expect(total('SS')).toBe(1);
  });

  it('purchase gaps and groups', () => {
    const gaps = purchaseGaps(greedy);
    expect(gaps.map((g) => g.gap)).toEqual([270, 600, 1100, 1500]);
    expect(purchaseGroup('weaponUpgrade')).toBe('Weapon');
    expect(purchaseGroup('weaponBuy')).toBe('Weapon');
    expect(purchaseGroup('character')).toBe('Character');
    expect(purchaseGroup('companion')).toBe('Other');
    expect(purchaseGroup('mana-skill')).toBe('Other');
  });

  it('horizons stop at the run length', () => {
    expect(horizons(3600)).toEqual([600, 3600]);
    expect(horizons(86400 * 2)).toEqual([600, 3600, 28800, 86400, 172800]);
  });
});
