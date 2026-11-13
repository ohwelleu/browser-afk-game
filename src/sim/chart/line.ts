/**
 * Line chart: 2px lines, optional p10–p90 band (10 % wash), step lines,
 * end-of-line labels for up to four series, marked points (e.g. a peak), and
 * crosshair hover data.
 */
import { esc } from './format.ts';
import type { SeriesStyle } from './palette.ts';
import { downsample, type Scale } from './scale.ts';
import {
  axisTitles,
  buildAxis,
  emptyChart,
  FONT,
  formatFor,
  r2,
  svgOpen,
  xAxis,
  yAxis,
  type AxisSpec,
  type ChartOut,
  type Margin,
  type Size,
  type XHover,
} from './svg.ts';

export interface Point {
  x: number;
  y: number;
}

export interface LineSeries extends SeriesStyle {
  label: string;
  points: Point[];
  /** p10–p90 (or any low/high) band, drawn under the line. */
  band?: { x: number; lo: number; hi: number }[];
  /** Hold each value until the next point (counts, levels). */
  step?: boolean;
}

export interface LineMarker {
  x: number;
  y: number;
  label: string;
}

export interface LineChartSpec {
  title: string;
  size?: Size;
  x: AxisSpec;
  y: AxisSpec;
  series: LineSeries[];
  /** Direct labels at the line ends (only used for 1–4 series that don't collide). */
  endLabels?: boolean;
  markers?: LineMarker[];
  /** Value format in the tooltip; defaults to the y axis format. */
  hoverFormat?: (v: number) => string;
  emptyText?: string;
}

export const LINE_SIZE: Size = { width: 720, height: 300 };
const END_LABEL_MAX = 4;

function usable(p: Point, x: AxisSpec, y: AxisSpec): boolean {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    (x.type !== 'log' || p.x > 0) &&
    (y.type !== 'log' || p.y > 0)
  );
}

function pathD(pts: Point[], sx: Scale, sy: Scale, step: boolean): string {
  let d = '';
  pts.forEach((p, i) => {
    const X = r2(sx(p.x));
    const Y = r2(sy(p.y));
    if (i === 0) d += `M${X} ${Y}`;
    else if (step) d += `H${X}V${Y}`;
    else d += `L${X} ${Y}`;
  });
  return d;
}

/** Value of a series at x: the last point at or before x (step-hold), or NaN. */
export function valueAt(points: Point[], x: number): number {
  let v = NaN;
  for (const p of points) {
    if (p.x > x + 1e-9) break;
    v = p.y;
  }
  return v;
}

export function lineChart(spec: LineChartSpec): ChartOut {
  const size = spec.size ?? LINE_SIZE;
  const series = spec.series.map((s) => ({
    ...s,
    points: s.points.filter((p) => usable(p, spec.x, spec.y)).sort((a, b) => a.x - b.x),
    band: s.band?.filter(
      (b) =>
        usable({ x: b.x, y: b.lo }, spec.x, spec.y) && usable({ x: b.x, y: b.hi }, spec.x, spec.y),
    ),
  }));
  const withData = series.filter((s) => s.points.length > 0);
  const wantLabels = spec.endLabels && withData.length > 0 && withData.length <= END_LABEL_MAX;
  const m: Margin = { top: 28, right: wantLabels ? 104 : 16, bottom: 34, left: 52 };

  const xs = series.flatMap((s) => [
    ...s.points.map((p) => p.x),
    ...(s.band ?? []).map((b) => b.x),
  ]);
  const ys = series.flatMap((s) => [
    ...s.points.map((p) => p.y),
    ...(s.band ?? []).flatMap((b) => [b.lo, b.hi]),
  ]);
  for (const mk of spec.markers ?? []) {
    xs.push(mk.x);
    ys.push(mk.y);
  }
  const X = buildAxis(spec.x, xs, [m.left, size.width - m.right], 6);
  const Y = buildAxis(spec.y, ys, [size.height - m.bottom, m.top], 4);

  let body = yAxis(Y.scale, Y.ticks, spec.y.kind, m, size);
  body += xAxis(X.scale, X.ticks, spec.x.kind, m, size);
  body += axisTitles(m, size, spec.x.label, spec.y.label);

  if (withData.length === 0) {
    return emptyChart(spec.title, size, m, spec.emptyText);
  }

  for (const s of series) {
    if (!s.band || s.band.length === 0) continue;
    const hi = s.band.map((b) => ({ x: b.x, y: b.hi }));
    const lo = s.band.map((b) => ({ x: b.x, y: b.lo })).reverse();
    const d = `${pathD(hi, X.scale, Y.scale, !!s.step)}${pathD(lo, X.scale, Y.scale, !!s.step).replace(/^M/, 'L')}Z`;
    body += `<path class="band" d="${d}" style="fill:${s.color}"/>`;
  }
  for (const s of series) {
    if (s.points.length === 0) continue;
    const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : '';
    if (s.points.length === 1) {
      const p = s.points[0];
      body += `<circle class="dot" cx="${r2(X.scale(p.x))}" cy="${r2(Y.scale(p.y))}" r="4" style="fill:${s.color}"/>`;
    } else {
      body += `<path class="line" d="${pathD(s.points, X.scale, Y.scale, !!s.step)}" style="stroke:${s.color}"${dash}/>`;
    }
  }
  for (const mk of spec.markers ?? []) {
    const cx = r2(X.scale(mk.x));
    const cy = r2(Y.scale(mk.y));
    body += `<circle class="dot ring" cx="${cx}" cy="${cy}" r="5" style="fill:${series[0]?.color ?? 'var(--ink-1)'}"/>`;
    body += `<text class="label" x="${cx}" y="${r2(cy - 12)}" text-anchor="middle">${esc(mk.label)}</text>`;
  }
  if (wantLabels) body += endLabels(withData, X.scale, Y.scale, size, m);

  const hover = lineHover(series, X.scale, spec, m, size);
  body +=
    `<line class="xhair" x1="0" x2="0" y1="${m.top}" y2="${size.height - m.bottom}" visibility="hidden"/>` +
    `<rect class="hit" x="${m.left}" y="${m.top}" width="${size.width - m.left - m.right}" height="${size.height - m.top - m.bottom}"/>`;
  return { svg: `${svgOpen(size, spec.title, 'has-xhover')}${body}</svg>`, hover };
}

/** Direct labels at the right end; skipped entirely when two would collide. */
function endLabels(
  series: (LineSeries & { points: Point[] })[],
  sx: Scale,
  sy: Scale,
  size: Size,
  m: Margin,
): string {
  const ends = series.map((s) => {
    const p = s.points[s.points.length - 1];
    return { s, x: sx(p.x), y: sy(p.y) };
  });
  const sorted = [...ends].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].y - sorted[i - 1].y < FONT + 2) return '';
  const lx = size.width - m.right + 8;
  return ends
    .map(
      (e) =>
        `<circle class="dot ring" cx="${r2(e.x)}" cy="${r2(e.y)}" r="4" style="fill:${e.s.color}"/>` +
        `<text class="label" x="${lx}" y="${r2(e.y)}" dominant-baseline="middle">${esc(e.s.label)}</text>`,
    )
    .join('');
}

function lineHover(
  series: (LineSeries & { points: Point[] })[],
  sx: Scale,
  spec: LineChartSpec,
  m: Margin,
  size: Size,
): XHover {
  const fmtX = formatFor(spec.x.kind);
  const fmtY = spec.hoverFormat ?? formatFor(spec.y.kind);
  const all = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const grid = downsample(all, 400);
  return {
    xs: grid.map((x) => r2(sx(x))),
    labels: grid.map(fmtX),
    top: m.top,
    bottom: size.height - m.bottom,
    rows: series.map((s) => ({
      label: s.label,
      color: s.color,
      dash: s.dash,
      values: grid.map((x) => {
        const v = valueAt(s.points, x);
        return Number.isNaN(v) ? '–' : fmtY(v);
      }),
    })),
  };
}

/** Same x scale for stacked panels: compute once from all panels' points. */
export function sharedXDomain(spec: AxisSpec, xs: number[]): [number, number] {
  return buildAxis(spec, xs, [0, 1], 6).scale.domain;
}
