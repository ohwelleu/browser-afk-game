/**
 * Dot chart: 8px dots with a 2px surface ring, at most three colour groups
 * (the all-pairs validated slots). Hover is a nearest-point layer (the
 * pointer only has to be closest, within 24px), so dense dots stay cheap.
 */
import { MAX_SCATTER_GROUPS, type SeriesStyle } from './palette.ts';
import { downsample } from './scale.ts';
import {
  axisTitles,
  buildAxis,
  emptyChart,
  r2,
  svgOpen,
  xAxis,
  yAxis,
  type AxisSpec,
  type ChartOut,
  type Margin,
  type PointHover,
  type Size,
} from './svg.ts';

export interface ScatterPoint {
  x: number;
  y: number;
  /** Tooltip lines: header, then "value  label" lines. */
  tip: string[];
}

export interface ScatterGroup extends SeriesStyle {
  label: string;
  points: ScatterPoint[];
}

export interface ScatterSpec {
  title: string;
  size?: Size;
  x: AxisSpec;
  y: AxisSpec;
  groups: ScatterGroup[];
  /** Max dots drawn per group (evenly thinned). */
  maxPoints?: number;
  emptyText?: string;
}

export function scatter(spec: ScatterSpec): ChartOut {
  if (spec.groups.length > MAX_SCATTER_GROUPS)
    throw new Error(`scatter: at most ${MAX_SCATTER_GROUPS} colour groups, fold the rest`);
  const size = spec.size ?? { width: 720, height: 260 };
  const m: Margin = { top: 28, right: 16, bottom: 34, left: 52 };
  const ok = (p: ScatterPoint) =>
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    (spec.x.type !== 'log' || p.x > 0) &&
    (spec.y.type !== 'log' || p.y > 0);
  const groups = spec.groups.map((g) => ({
    ...g,
    points: downsample(g.points.filter(ok), spec.maxPoints ?? 300),
  }));
  const pts = groups.flatMap((g) => g.points);
  const X = buildAxis(
    spec.x,
    pts.map((p) => p.x),
    [m.left, size.width - m.right],
    6,
  );
  const Y = buildAxis(
    spec.y,
    pts.map((p) => p.y),
    [size.height - m.bottom, m.top],
    4,
  );
  let body = yAxis(Y.scale, Y.ticks, spec.y.kind, m, size);
  body += xAxis(X.scale, X.ticks, spec.x.kind, m, size);
  body += axisTitles(m, size, spec.x.label, spec.y.label);
  if (pts.length === 0) {
    return emptyChart(spec.title, size, m, spec.emptyText);
  }
  const hover: PointHover = { pts: [], tips: [] };
  for (const g of groups) {
    for (const p of g.points) {
      const cx = r2(X.scale(p.x));
      const cy = r2(Y.scale(p.y));
      body += `<circle class="dot ring" cx="${cx}" cy="${cy}" r="4" style="fill:${g.color}"/>`;
      hover.pts.push(cx, cy);
      hover.tips.push(p.tip);
    }
  }
  body += `<circle class="pt-focus" r="7" visibility="hidden"/>`;
  return { svg: `${svgOpen(size, spec.title, 'has-phover')}${body}</svg>`, hover };
}
