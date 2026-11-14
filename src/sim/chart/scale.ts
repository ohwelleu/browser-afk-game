/**
 * Scales and tick maths. Pure numbers in, numbers out: every domain is made
 * safe first (empty, one point, zero or negative values on a log axis), so a
 * chart never divides by zero or draws NaN.
 */
import { STAGES_PER_WORLD } from './format.ts';

export type ScaleType = 'linear' | 'log';

export interface Scale {
  type: ScaleType;
  domain: [number, number];
  range: [number, number];
  (v: number): number;
}

/**
 * A domain that a scale can use. Linear: [0, 1] when empty, ±1 around a single
 * value (or [0, 2v] when `zero`). Log: only positive values count; [1, 10]
 * when none, one decade around a single value.
 */
export function safeDomain(values: number[], type: ScaleType, zero = false): [number, number] {
  const vs = values.filter((v) => Number.isFinite(v) && (type === 'linear' || v > 0));
  if (vs.length === 0) return type === 'log' ? [1, 10] : [0, 1];
  let lo = Math.min(...vs);
  let hi = Math.max(...vs);
  if (type === 'log') {
    if (lo === hi) return [lo / Math.SQRT2 / 2.5, hi * Math.SQRT2 * 2.5];
    return [lo, hi];
  }
  if (zero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  if (lo === hi) return lo === 0 ? [0, 1] : zero ? [0, 2 * hi] : [lo - 1, hi + 1];
  return [lo, hi];
}

export function makeScale(type: ScaleType, domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const f =
    type === 'log'
      ? (v: number) => {
          const l0 = Math.log10(d0);
          const span = Math.log10(d1) - l0 || 1;
          return r0 + ((Math.log10(Math.max(v, d0 / 1e6)) - l0) / span) * (r1 - r0);
        }
      : (v: number) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
  return Object.assign(f, { type, domain, range }) as Scale;
}

/** Classic "nice number": 1, 2, 2.5 or 5 × 10^k close to `x`. */
function niceStep(rough: number): number {
  const exp = Math.floor(Math.log10(rough));
  const f = rough / 10 ** exp;
  const nf = f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10;
  return nf * 10 ** exp;
}

/** Round a float tick to remove 0.30000000000000004 noise. */
const clean = (v: number) => Number(v.toPrecision(12));

/** Nice linear ticks covering the domain; returns the extended domain too. */
export function linearTicks(
  domain: [number, number],
  count = 5,
): { ticks: number[]; domain: [number, number] } {
  const [lo, hi] = domain;
  const step = niceStep((hi - lo) / Math.max(1, count));
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(clean(v));
  return { ticks, domain: [clean(start), clean(end)] };
}

/** Log ticks: powers of ten (thinned to ≤ `max`), with 2 and 5 when the span is small. */
export function logTicks(
  domain: [number, number],
  max = 7,
): { ticks: number[]; domain: [number, number] } {
  const e0 = Math.floor(Math.log10(domain[0]) + 1e-9);
  const e1 = Math.ceil(Math.log10(domain[1]) - 1e-9);
  const decades = Math.max(1, e1 - e0);
  if (decades <= 2) {
    const ticks: number[] = [];
    for (let e = e0; e <= e1; e++) {
      for (const m of [1, 2, 5]) {
        const v = clean(m * 10 ** e);
        if (v >= domain[0] / 1.0001 && v <= domain[1] * 1.0001) ticks.push(v);
      }
    }
    const lo = ticks.length ? Math.min(domain[0], ticks[0]) : domain[0];
    if (ticks.length >= 2) return { ticks, domain: [lo, domain[1]] };
  }
  const every = Math.ceil((decades + 1) / max);
  const ticks: number[] = [];
  for (let e = e0; e <= e1; e += every) ticks.push(clean(10 ** e));
  return {
    ticks,
    domain: [clean(10 ** e0), clean(10 ** (e0 + Math.ceil(decades / every) * every))],
  };
}

const TIME_STEPS = [
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800,
  604800,
];
/** Round clock values for a log time axis; the first list is preferred when it gives ≥ 3 ticks. */
const TIME_LOG_MAJOR = [1, 10, 60, 600, 3600, 8 * 3600, 86400, 7 * 86400, 30 * 86400];
const TIME_LOG_ALL = [
  1,
  2,
  5,
  10,
  20,
  30,
  60,
  120,
  300,
  600,
  1200,
  1800,
  3600,
  2 * 3600,
  4 * 3600,
  8 * 3600,
  86400,
  2 * 86400,
  7 * 86400,
  30 * 86400,
];

/** Ticks on a time axis in seconds: round clock values (1m, 10m, 1h, 8h, 1d…). */
export function timeTicks(
  domain: [number, number],
  type: ScaleType,
  count = 6,
): { ticks: number[]; domain: [number, number] } {
  if (type === 'log') {
    // Widen to the round values around the data (strictly outside, so no dot
    // sits on the baseline).
    const lo = [...TIME_LOG_ALL].reverse().find((t) => t < domain[0] * 0.999) ?? domain[0];
    const hi = TIME_LOG_ALL.find((t) => t >= domain[1] / 1.0001) ?? domain[1];
    const inside = (list: number[]) => list.filter((t) => t >= lo && t <= hi);
    let ticks = inside(TIME_LOG_MAJOR);
    if (ticks.length < 3) ticks = inside(TIME_LOG_ALL);
    if (ticks.length > count) {
      const k = Math.ceil(ticks.length / count);
      ticks = ticks.filter((_, i) => i % k === 0);
    }
    if (ticks.length < 2) return logTicks(domain, count);
    return { ticks, domain: [lo, hi] };
  }
  const span = domain[1] - domain[0];
  const step = TIME_STEPS.find((s) => span / s <= count) ?? niceStep(span / count);
  const start = Math.floor(domain[0] / step) * step;
  const end = Math.ceil(domain[1] / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(v);
  return { ticks, domain: [start, end] };
}

/** Ticks on a stage-level axis: world starts (1, 7, 13 …), every k worlds. */
export function stageTicks(
  domain: [number, number],
  count = 6,
): { ticks: number[]; domain: [number, number] } {
  const w0 = Math.floor((Math.max(1, domain[0]) - 1) / STAGES_PER_WORLD);
  const w1 = Math.ceil((Math.max(1, domain[1]) - 1) / STAGES_PER_WORLD);
  const worlds = Math.max(1, w1 - w0);
  if (worlds <= 1 && domain[1] - domain[0] <= STAGES_PER_WORLD) {
    // Inside one world: one tick per stage.
    const lo = Math.max(1, Math.floor(domain[0]));
    const hi = Math.max(lo + 1, Math.ceil(domain[1]));
    const ticks: number[] = [];
    for (let l = lo; l <= hi; l++) ticks.push(l);
    return { ticks, domain: [lo, hi] };
  }
  const every = [1, 2, 5, 10, 20, 50, 100].find((k) => worlds / k <= count) ?? niceStep(worlds);
  // World numbers 1, k, 2k, 3k … (so the labels read 1.1, 5.1, 10.1, not 1.1, 6.1, 11.1).
  const top = Math.ceil((w1 + 1) / every) * every;
  const worldsShown = [1];
  for (let w = every; w <= top; w += every) if (w > 1) worldsShown.push(w);
  // From the last shown world at or below the data to the first one at or above it.
  let first = 0;
  while (first + 1 < worldsShown.length && worldsShown[first + 1] - 1 <= w0) first++;
  let last = first;
  while (last + 1 < worldsShown.length && worldsShown[last] - 1 < w1) last++;
  const ticks = worldsShown.slice(first, last + 1).map((w) => (w - 1) * STAGES_PER_WORLD + 1);
  return { ticks, domain: [ticks[0], ticks[ticks.length - 1]] };
}

/** Quantile of a sample with linear interpolation (q in 0–1). NaN for an empty list. */
export function quantile(values: number[], q: number): number {
  const vs = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (vs.length === 0) return NaN;
  const pos = (vs.length - 1) * q;
  const i = Math.floor(pos);
  const frac = pos - i;
  return i + 1 < vs.length ? vs[i] + (vs[i + 1] - vs[i]) * frac : vs[i];
}

/** Keep at most `max` points: first, last, every k-th, and any index in `keep`. */
export function downsample<T>(points: T[], max = 600, keep?: (p: T) => boolean): T[] {
  if (points.length <= max) return points;
  const k = Math.ceil(points.length / max);
  return points.filter((p, i) => i === 0 || i === points.length - 1 || i % k === 0 || keep?.(p));
}
