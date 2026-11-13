/**
 * Stacked area: layers share one x grid; each layer sits on the ones before
 * it, separated by a 2px surface gap. Crosshair hover lists every layer and
 * the total.
 */
import { fmtNum } from './format.ts';
import type { SeriesStyle } from './palette.ts';
import { downsample } from './scale.ts';
import {
  axisTitles,
  buildAxis,
  emptyChart,
  formatFor,
  r2,
  svgOpen,
  xAxis,
  yAxis,
  type AxisSpec,
  type ChartOut,
  type Margin,
  type Size,
} from './svg.ts';

export interface AreaLayer extends SeriesStyle {
  label: string;
  /** One value per x; NaN or negative counts as 0. */
  values: number[];
}

export interface StackedAreaSpec {
  title: string;
  size?: Size;
  x: AxisSpec;
  /** Linear, from zero. */
  y: AxisSpec;
  xs: number[];
  layers: AreaLayer[];
  emptyText?: string;
}

export function stackedArea(spec: StackedAreaSpec): ChartOut {
  const size = spec.size ?? { width: 720, height: 220 };
  const m: Margin = { top: 28, right: 16, bottom: 34, left: 52 };
  const keep = spec.xs
    .map((_, i) => i)
    .filter((i) => Number.isFinite(spec.xs[i]) && (spec.x.type !== 'log' || spec.xs[i] > 0));
  const idx = downsample(keep, 600);
  const xs = idx.map((i) => spec.xs[i]);
  const vals = spec.layers.map((l) => idx.map((i) => Math.max(0, l.values[i] || 0)));
  const totals = xs.map((_, j) => vals.reduce((sum, v) => sum + v[j], 0));

  const X = buildAxis(spec.x, xs, [m.left, size.width - m.right], 6);
  const Y = buildAxis(
    { ...spec.y, type: 'linear', zero: true },
    totals,
    [size.height - m.bottom, m.top],
    4,
  );
  let body = yAxis(Y.scale, Y.ticks, spec.y.kind, m, size);
  body += xAxis(X.scale, X.ticks, spec.x.kind, m, size);
  body += axisTitles(m, size, spec.x.label, spec.y.label);

  if (xs.length === 0 || spec.layers.length === 0 || totals.every((t) => t === 0)) {
    return emptyChart(spec.title, size, m, spec.emptyText);
  }

  const base = xs.map(() => 0);
  const px = xs.map((x) => r2(X.scale(x)));
  if (xs.length === 1) px.push(px[0] + 1);
  spec.layers.forEach((l, li) => {
    const lo = [...base];
    vals[li].forEach((v, j) => (base[j] += v));
    const hi = [...base];
    if (xs.length === 1) {
      lo.push(lo[0]);
      hi.push(hi[0]);
    }
    const top = hi.map((v, j) => `${j ? 'L' : 'M'}${px[j]} ${r2(Y.scale(v))}`).join('');
    const bottom = lo
      .map((v, j) => `L${px[j]} ${r2(Y.scale(v))}`)
      .reverse()
      .join('');
    body += `<path class="area" d="${top}${bottom}Z" style="fill:${l.color}"/>`;
    body += `<path class="area-gap" d="${top}"/>`;
  });

  const fmtX = formatFor(spec.x.kind);
  const fmtY = formatFor(spec.y.kind);
  const grid = downsample(
    xs.map((_, j) => j),
    400,
  );
  const hover = {
    xs: grid.map((j) => px[j]),
    labels: grid.map((j) => fmtX(xs[j])),
    top: m.top,
    bottom: size.height - m.bottom,
    rows: [
      ...spec.layers.map((l, li) => ({
        label: l.label,
        color: l.color,
        dash: '',
        values: grid.map((j) => fmtY(vals[li][j])),
      })),
      { label: 'Total', color: '', dash: '', values: grid.map((j) => fmtNum(totals[j])) },
    ],
  };
  body +=
    `<line class="xhair" x1="0" x2="0" y1="${m.top}" y2="${size.height - m.bottom}" visibility="hidden"/>` +
    `<rect class="hit" x="${m.left}" y="${m.top}" width="${size.width - m.left - m.right}" height="${size.height - m.top - m.bottom}"/>`;
  return { svg: `${svgOpen(size, spec.title, 'has-xhover')}${body}</svg>`, hover };
}
