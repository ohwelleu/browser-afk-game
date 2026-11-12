import { describe, expect, it } from 'vitest';
import { ITEM_TIERS } from './balance';
import {
  addPassive,
  ascendsOf,
  ASCEND_SHIFT,
  PASSIVE_CAPS,
  PASSIVES,
  passiveTotals,
  pickCount,
  PICK_OPTIONS,
  PICK_TIER_WEIGHTS,
  rollPickOptions,
  tierChances,
  tierWeights,
  type Passive,
} from './passives';
import { nextFloat } from './rng';

const sum = (w: Record<string, number>) => Object.values(w).reduce((a, b) => a + b, 0);

describe('tierWeights', () => {
  it('is the base table at 0 ascends: C heavy, S+ rare', () => {
    expect(tierWeights(0)).toEqual({ C: 60, B: 25, A: 10, S: 4, SS: 1 });
    expect(tierChances(0).C).toBeCloseTo(0.6);
    expect(tierChances(0).SS).toBeCloseTo(0.01);
  });

  it('moves weight from C to the better tiers with every ascend, total unchanged', () => {
    for (let n = 0; n <= 10; n++) {
      expect(sum(tierWeights(n))).toBeCloseTo(sum(PICK_TIER_WEIGHTS), 9);
      if (n === 0) continue;
      const a = tierWeights(n - 1);
      const b = tierWeights(n);
      expect(b.C).toBeLessThan(a.C);
      for (const t of ['B', 'A', 'S', 'SS'] as const) expect(b[t]).toBeGreaterThan(a[t]);
    }
  });

  it('with 3 ascends B is clearly more likely (and S+ about doubles)', () => {
    const w0 = tierChances(0);
    const w3 = tierChances(3);
    expect(w3.B).toBeGreaterThan(w0.B * 1.4);
    expect(w3.B).toBeGreaterThan(w3.C * 0.95); // B has caught up with C
    expect(w3.SS).toBeGreaterThan(w0.SS * 2);
    // The numbers the PR quotes (0.85³ of C is left: 36.8).
    expect(w3.C * 100).toBeCloseTo(60 * (1 - ASCEND_SHIFT.share) ** 3, 6);
  });

  it('keeps a little C for any sane run and ignores nonsense ascends', () => {
    expect(tierWeights(40).C).toBeGreaterThan(0);
    expect(tierWeights(1000).C).toBeGreaterThanOrEqual(0);
    expect(tierWeights(-4)).toEqual(tierWeights(0));
    expect(tierWeights(Number.NaN)).toEqual(tierWeights(0));
    expect(tierWeights(2.9)).toEqual(tierWeights(2));
  });

  it('chances sum to 1', () => {
    for (const n of [0, 1, 3, 12]) expect(sum(tierChances(n))).toBeCloseTo(1, 12);
  });
});

describe('ascendsOf', () => {
  it('reads state.ascends, and counts a bad value as 0', () => {
    expect(ascendsOf({ ascends: 0 })).toBe(0);
    expect(ascendsOf({ ascends: 3 })).toBe(3);
    expect(ascendsOf({ ascends: -1 })).toBe(0);
    expect(ascendsOf({ ascends: Number.NaN })).toBe(0);
    expect(ascendsOf({ ascends: 2.5 })).toBe(0);
  });
});

describe('the passives table', () => {
  it('has every tier for every row, rising C < B < A < S < S+', () => {
    for (const p of PASSIVES) {
      const v = ITEM_TIERS.map((t) => p.values[t]);
      for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
    }
  });

  it('S+ is twice S', () => {
    for (const p of PASSIVES) expect(p.values.SS).toBeCloseTo(p.values.S * 2, 9);
  });

  it('has unique ids and the five v1 options', () => {
    const ids = PASSIVES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PASSIVES.map((p) => p.stat).sort()).toEqual([
      'click',
      'crit',
      'defence',
      'extra',
      'speed',
    ]);
  });
});

describe('rollPickOptions', () => {
  it('offers two options, never the same passive twice', () => {
    const rng = { state: 7 };
    for (let i = 0; i < 2000; i++) {
      const o = rollPickOptions(rng, i % 5);
      expect(o).toHaveLength(PICK_OPTIONS);
      expect(new Set(o.map((x) => x.id)).size).toBe(o.length);
      for (const x of o) {
        expect(PASSIVES.some((p) => p.id === x.id)).toBe(true);
        expect(ITEM_TIERS).toContain(x.tier);
      }
    }
  });

  it('is repeatable from the same seed and advances the rng', () => {
    const a = { state: 99 };
    const b = { state: 99 };
    expect(rollPickOptions(a, 0)).toEqual(rollPickOptions(b, 0));
    expect(a.state).toBe(b.state);
    expect(a.state).not.toBe(99);
  });

  it('rolls each option’s tier on its own', () => {
    const rng = { state: 1234 };
    const seenDifferent = Array.from({ length: 500 }, () => rollPickOptions(rng, 0)).some(
      (o) => o[0].tier !== o[1].tier,
    );
    expect(seenDifferent).toBe(true);
  });

  it('follows the tier chances, and 3 ascends give more B', () => {
    const count = (ascends: number) => {
      const rng = { state: 2024 };
      const n: Record<string, number> = { C: 0, B: 0, A: 0, S: 0, SS: 0 };
      for (let i = 0; i < 20_000; i++) for (const o of rollPickOptions(rng, ascends)) n[o.tier]++;
      return n;
    };
    const total = 40_000;
    const n0 = count(0);
    const n3 = count(3);
    for (const t of ITEM_TIERS) {
      expect(n0[t] / total).toBeCloseTo(tierChances(0)[t], 1);
      expect(n3[t] / total).toBeCloseTo(tierChances(3)[t], 1);
    }
    expect(n3.B).toBeGreaterThan(n0.B * 1.3);
  });

  it('gives fewer options only when the table is smaller than the count', () => {
    expect(rollPickOptions({ state: 1 }, 0, 99)).toHaveLength(PASSIVES.length);
  });

  it('draws every passive eventually (uniform pool)', () => {
    const rng = { state: 5 };
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) for (const o of rollPickOptions(rng, 0)) seen.add(o.id);
    expect(seen.size).toBe(PASSIVES.length);
    expect(nextFloat(rng)).toBeLessThan(1);
  });
});

describe('addPassive', () => {
  it('stacks the same passive at the same tier as +1 level', () => {
    let list: Passive[] = [];
    list = addPassive(list, { id: 'speed', tier: 'C' });
    list = addPassive(list, { id: 'speed', tier: 'C' });
    expect(list).toEqual([{ id: 'speed', tier: 'C', level: 2 }]);
  });

  it('keeps another tier of the same passive as a separate entry, nothing replaced', () => {
    let list = addPassive([], { id: 'speed', tier: 'A' });
    list = addPassive(list, { id: 'speed', tier: 'C' });
    expect(list).toEqual([
      { id: 'speed', tier: 'C', level: 1 },
      { id: 'speed', tier: 'A', level: 1 },
    ]);
    expect(pickCount(list)).toBe(2);
  });

  it('does not change the list it was given, and sorts by table then tier', () => {
    const before: Passive[] = [{ id: 'extra', tier: 'S', level: 1 }];
    const copy = JSON.parse(JSON.stringify(before));
    const after = addPassive(before, { id: 'speed', tier: 'B' });
    expect(before).toEqual(copy);
    expect(after.map((p) => p.id)).toEqual(['speed', 'extra']);
  });
});

describe('passiveTotals', () => {
  it('is all zero without passives', () => {
    expect(passiveTotals([])).toEqual({ speed: 0, crit: 0, defence: 0, click: 0, extra: 0 });
    expect(passiveTotals(undefined).speed).toBe(0);
  });

  it('sums level × tier value per stat', () => {
    const t = passiveTotals([
      { id: 'speed', tier: 'C', level: 3 },
      { id: 'speed', tier: 'S', level: 1 },
      { id: 'defence', tier: 'B', level: 2 },
    ]);
    expect(t.speed).toBeCloseTo(0.03 + 0.04, 9);
    expect(t.defence).toBe(6);
  });

  it('applies the caps and ignores unknown ids', () => {
    const t = passiveTotals([
      { id: 'speed', tier: 'SS', level: 100 },
      { id: 'extra', tier: 'SS', level: 100 },
      { id: 'nope', tier: 'C', level: 5 },
    ]);
    expect(t.speed).toBe(PASSIVE_CAPS.speed);
    expect(t.extra).toBe(PASSIVE_CAPS.extra);
  });
});

/** Expected C-equivalent value of one pick, at the base weights. */
const evPerPick = (ascends: number) => {
  const c = tierChances(ascends);
  return ITEM_TIERS.reduce((sum, t) => sum + c[t] * [1, 1.5, 2.5, 4, 8][ITEM_TIERS.indexOf(t)], 0);
};

describe('totals after many picks (the numbers quoted in the PR)', () => {
  it('stay modest: 10 and 50 picks spread over the five passives, at 0 ascends', () => {
    const per = (picks: number) => (picks / PASSIVES.length) * evPerPick(0);
    // ≈1.47 C-equivalents per pick; one passive gets a fifth of the picks.
    expect(evPerPick(0)).toBeCloseTo(1.465, 3);
    expect(per(10) * 0.01).toBeLessThan(0.04); // attack speed after 10 picks
    expect(per(50) * 0.01).toBeLessThan(0.16); // after 50 picks
    expect(per(50) * 0.005).toBeLessThan(0.08); // crit chance after 50 picks
  });

  it('even 50 picks all on one passive stay under its cap or small', () => {
    const all = passiveTotals([{ id: 'speed', tier: 'C', level: 50 }]);
    expect(all.speed).toBeLessThanOrEqual(PASSIVE_CAPS.speed!);
  });
});
