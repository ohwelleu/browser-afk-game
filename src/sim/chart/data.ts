/**
 * The report's input: the subset of the simulator's results JSON (design doc
 * §5.1, `runs.json` + the resolved scenario) that the charts read, and the
 * derivations the charts need (percentile bands across seeds, time to stage N,
 * time per stage, spend rates, drop buckets, purchase gaps).
 *
 * This is deliberately its own small interface: the runner's types live in
 * `src/sim/types.ts`, and a single adapter maps one onto the other.
 */
import { parseDuration, worldStart } from './format.ts';
import { downsample, quantile } from './scale.ts';

export const TIERS = ['C', 'B', 'A', 'S', 'SS'] as const;
export type Tier = (typeof TIERS)[number];
/** Tier label as the game shows it (SS is shown as S+). */
export const tierLabel = (t: Tier) => (t === 'SS' ? 'S+' : t);

export const SPEND_KINDS = [
  'weaponUpgrade',
  'weaponBuy',
  'character',
  'companion',
  'ascend',
] as const;
export type SpendKind = (typeof SPEND_KINDS)[number];
export const SPEND_LABELS: Record<SpendKind, string> = {
  weaponUpgrade: 'Weapon upgrades',
  weaponBuy: 'Weapons',
  character: 'Character',
  companion: 'Companions',
  ascend: 'Ascend',
};

export interface ReportSample {
  /** Play time, seconds. */
  t: number;
  /** Wall-clock time (play + gaps), seconds. Defaults to `t`. */
  tWall?: number;
  level: number;
  best: number;
  coins?: number;
  incomePerMin?: number;
  spentTotal?: number;
  spent?: Partial<Record<SpendKind, number>>;
  dpsEff?: number;
  mobHp?: number;
  ttk?: number;
  ttd?: number;
  kills?: number;
  deaths?: number;
  ascends?: number;
  /** Cumulative drops per tier. */
  drops?: Partial<Record<Tier, number>>;
}

export interface ReportPurchase {
  t: number;
  kind: string;
  target?: string;
  levelFrom?: number;
  levelTo?: number;
  cost?: number;
}

export interface ReportRun {
  seed: number;
  samples: ReportSample[];
  /** First time `best` reached each level. */
  milestones: { level: number; t: number }[];
  purchases?: ReportPurchase[];
  ascends?: { t: number; level: number }[];
}

export interface ReportVariant {
  id: string;
  label: string;
  bot?: string;
  /** Sweep values for this variant, by key (e.g. `{"items.dropChance.mob": 0.01}`). */
  params?: Record<string, number | string>;
  runs: ReportRun[];
}

export interface ReportTarget {
  level: number;
  label: string;
  at: number | string;
}

export interface ReportScenario {
  name: string;
  gameVersion?: string;
  seed?: number;
  runs?: number;
  duration: number | string;
  bot?: unknown;
  /** Bot definitions by name, for the header table. */
  bots?: Record<string, Record<string, unknown>>;
  /** Resolved tuning, for the header table. */
  tuning?: Record<string, unknown>;
  sweep?: Record<string, unknown[]>;
  report?: { xAxis?: 'log' | 'linear'; targets?: ReportTarget[] };
}

export interface ReportInput {
  scenario: ReportScenario;
  variants: ReportVariant[];
}

/** Light shape check with errors that name the path. */
export function parseReportInput(json: unknown): ReportInput {
  const fail = (path: string, what: string): never => {
    throw new Error(`report input: ${path} ${what}`);
  };
  const obj = (v: unknown, path: string) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail(path, 'must be an object');
  const arr = (v: unknown, path: string) => (Array.isArray(v) ? v : fail(path, 'must be an array'));
  const root = obj(json, '(root)');
  const sc = obj(root.scenario, 'scenario');
  if (typeof sc.name !== 'string') fail('scenario.name', 'must be a string');
  if (typeof sc.duration !== 'number' && typeof sc.duration !== 'string')
    fail('scenario.duration', 'must be seconds or "8h"');
  parseDuration(sc.duration as number | string);
  arr(root.variants, 'variants').forEach((v, i) => {
    const vo = obj(v, `variants[${i}]`);
    if (typeof vo.id !== 'string') fail(`variants[${i}].id`, 'must be a string');
    if (typeof vo.label !== 'string') fail(`variants[${i}].label`, 'must be a string');
    arr(vo.runs, `variants[${i}].runs`).forEach((r, j) => {
      const ro = obj(r, `variants[${i}].runs[${j}]`);
      arr(ro.samples, `variants[${i}].runs[${j}].samples`);
      arr(ro.milestones, `variants[${i}].runs[${j}].milestones`);
    });
  });
  return json as ReportInput;
}

export const durationOf = (input: ReportInput) => parseDuration(input.scenario.duration);

export type Clock = 'play' | 'wall';

export function hasWallTime(input: ReportInput): boolean {
  return input.variants.some((v) =>
    v.runs.some((r) => r.samples.some((s) => s.tWall !== undefined && s.tWall !== s.t)),
  );
}

/** Wall time of a play time in one run (step-interpolated from the samples). */
export function wallOf(run: ReportRun, t: number): number {
  let prev: ReportSample | undefined;
  for (const s of run.samples) {
    if (s.t > t) break;
    prev = s;
  }
  if (!prev) return t;
  return (prev.tWall ?? prev.t) + (t - prev.t);
}

const sampleTime = (s: ReportSample, clock: Clock) => (clock === 'wall' ? (s.tWall ?? s.t) : s.t);

/** Value of a sample field in one run at time x (last sample at or before x). */
function runValueAt(
  run: ReportRun,
  x: number,
  get: (s: ReportSample) => number | undefined,
  clock: Clock,
) {
  let v = NaN;
  for (const s of run.samples) {
    if (sampleTime(s, clock) > x + 1e-9) break;
    const g = get(s);
    v = g === undefined ? NaN : g;
  }
  return v;
}

export interface BandPoint {
  x: number;
  lo: number;
  mid: number;
  hi: number;
}

/** The time grid of a variant: every sample time of its runs, at most `max` points. */
export function timeGrid(v: ReportVariant, clock: Clock, max = 400): number[] {
  const all = [...new Set(v.runs.flatMap((r) => r.samples.map((s) => sampleTime(s, clock))))].sort(
    (a, b) => a - b,
  );
  return downsample(all, max);
}

/** p10 / median / p90 of a sample field across a variant's runs, on its time grid. */
export function band(
  v: ReportVariant,
  get: (s: ReportSample) => number | undefined,
  clock: Clock = 'play',
  grid = timeGrid(v, clock),
): BandPoint[] {
  return grid
    .map((x) => {
      const vals = v.runs.map((r) => runValueAt(r, x, get, clock)).filter(Number.isFinite);
      return { x, lo: quantile(vals, 0.1), mid: quantile(vals, 0.5), hi: quantile(vals, 0.9) };
    })
    .filter((p) => Number.isFinite(p.mid));
}

/**
 * Quantile where "never" (Infinity) is a real value: a run that never reached
 * the stage counts as slower than every run that did. Nearest rank, so no
 * Infinity arithmetic.
 */
export function quantileWithNever(values: number[], q: number): number {
  const vs = values.filter((v) => !Number.isNaN(v)).sort((a, b) => a - b);
  if (vs.length === 0) return NaN;
  const pos = (vs.length - 1) * q;
  const i = Math.floor(pos);
  const j = Math.ceil(pos);
  if (!Number.isFinite(vs[i]) || !Number.isFinite(vs[j])) return Infinity;
  return vs[i] + (vs[j] - vs[i]) * (pos - i);
}

export interface Reach {
  lo: number;
  mid: number;
  hi: number;
  /** Runs that never reached the level. */
  never: number;
  runs: number;
}

/** Time to first reach a stage level, across a variant's runs. */
export function timeToReach(v: ReportVariant, level: number, clock: Clock = 'play'): Reach {
  const ts = v.runs.map((r) => {
    const m = r.milestones.find((x) => x.level >= level);
    if (!m) return Infinity;
    return clock === 'wall' ? wallOf(r, m.t) : m.t;
  });
  return {
    lo: quantileWithNever(ts, 0.1),
    mid: quantileWithNever(ts, 0.5),
    hi: quantileWithNever(ts, 0.9),
    never: ts.filter((t) => !Number.isFinite(t)).length,
    runs: ts.length,
  };
}

export const WORLDS = [2, 3, 5, 10];
export const worldLevel = worldStart;

/** Time between first reaching a level and the next one (median over runs), and deaths there. */
export function timePerStage(
  v: ReportVariant,
): { level: number; seconds: number; deaths: number }[] {
  const maxLevel = Math.max(0, ...v.runs.flatMap((r) => r.milestones.map((m) => m.level)));
  const out: { level: number; seconds: number; deaths: number }[] = [];
  for (let level = 1; level < maxLevel; level++) {
    const secs: number[] = [];
    const deaths: number[] = [];
    for (const r of v.runs) {
      const a = r.milestones.find((m) => m.level === level);
      const b = r.milestones.find((m) => m.level > level);
      if (a && b) secs.push(b.t - a.t);
      let d = 0;
      for (let i = 1; i < r.samples.length; i++) {
        const s = r.samples[i];
        if (s.level === level) d += Math.max(0, (s.deaths ?? 0) - (r.samples[i - 1].deaths ?? 0));
      }
      deaths.push(d);
    }
    if (secs.length)
      out.push({ level, seconds: quantile(secs, 0.5), deaths: quantile(deaths, 0.5) });
  }
  return out;
}

/** Coins spent per minute between samples (median over runs). */
export function spendPerMin(v: ReportVariant, clock: Clock = 'play'): BandPoint[] {
  const rateAt = (r: ReportRun, x: number) => {
    let li = -1;
    for (let i = 0; i < r.samples.length; i++) {
      if (sampleTime(r.samples[i], clock) > x + 1e-9) break;
      li = i;
    }
    if (li <= 0) return NaN;
    const s = r.samples[li];
    const p = r.samples[li - 1];
    const dt = s.t - p.t;
    return dt > 0 ? (((s.spentTotal ?? 0) - (p.spentTotal ?? 0)) / dt) * 60 : NaN;
  };
  return timeGrid(v, clock)
    .map((x) => {
      const vals = v.runs.map((r) => rateAt(r, x)).filter(Number.isFinite);
      return { x, lo: quantile(vals, 0.1), mid: quantile(vals, 0.5), hi: quantile(vals, 0.9) };
    })
    .filter((p) => Number.isFinite(p.mid));
}

/** Bucket size for `n` buckets over a duration: a round clock value. */
export function bucketSize(duration: number, n = 16): number {
  const steps = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400];
  return steps.find((s) => duration / s <= n) ?? Math.ceil(duration / n / 86400) * 86400;
}

/** Drops per tier per time bucket, mean over runs. */
export function dropsPerBucket(
  v: ReportVariant,
  duration: number,
): { start: number; size: number; perTier: Record<Tier, number[]> } {
  const size = bucketSize(duration);
  const n = Math.max(1, Math.ceil(duration / size));
  const perTier = Object.fromEntries(TIERS.map((t) => [t, new Array(n).fill(0)])) as Record<
    Tier,
    number[]
  >;
  const runs = Math.max(1, v.runs.length);
  for (const r of v.runs) {
    for (const t of TIERS) {
      const at = (x: number) => {
        const val = runValueAt(r, x, (s) => s.drops?.[t] ?? 0, 'play');
        return Number.isFinite(val) ? val : 0;
      };
      for (let b = 0; b < n; b++) perTier[t][b] += (at((b + 1) * size) - at(b * size)) / runs;
    }
  }
  return { start: 0, size, perTier };
}

/** Purchase groups for the gap chart (three: the all-pairs validated colour slots). */
export const PURCHASE_GROUPS = ['Weapon', 'Character', 'Other'] as const;
export type PurchaseGroup = (typeof PURCHASE_GROUPS)[number];
export function purchaseGroup(kind: string): PurchaseGroup {
  if (kind === 'weaponUpgrade' || kind === 'weaponBuy' || kind === 'weapon') return 'Weapon';
  if (kind === 'character') return 'Character';
  return 'Other';
}

/** Every purchase with the time until the next one, over all runs of a variant. */
export function purchaseGaps(v: ReportVariant): (ReportPurchase & { gap: number; seed: number })[] {
  return v.runs.flatMap((r) => {
    const ps = [...(r.purchases ?? [])].sort((a, b) => a.t - b.t);
    return ps.slice(0, -1).map((p, i) => ({ ...p, gap: ps[i + 1].t - p.t, seed: r.seed }));
  });
}

/** The last sample of a run, if any. */
export const lastSample = (r: ReportRun): ReportSample | undefined =>
  r.samples[r.samples.length - 1];

/** The sweep key for "best ascend moment", if the scenario sweeps one. */
export function ascendSweepKey(input: ReportInput): string | undefined {
  return Object.keys(input.scenario.sweep ?? {}).find((k) => /ascend\.atLevel$/i.test(k));
}

/** Numeric sweep keys whose values every variant carries. */
export function numericSweepKeys(input: ReportInput): string[] {
  return Object.keys(input.scenario.sweep ?? {}).filter((k) =>
    input.variants.every((v) => typeof v.params?.[k] === 'number'),
  );
}

/** Horizons for "progress after …" tables: 10m, 1h, 8h, 24h within the run, and the end. */
export function horizons(duration: number): number[] {
  const hs = [600, 3600, 8 * 3600, 86400].filter((h) => h < duration);
  return [...hs, duration];
}
