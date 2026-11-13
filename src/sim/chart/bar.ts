/**
 * Column charts on a band axis: stacked columns (≤ 24px, 4px rounded top,
 * square at the baseline, 2px surface gap between segments) and dot + range
 * (median dot on a p10–p90 line). Each category is one hover/focus target.
 */
import { esc, fmtNum } from './format.ts';
import type { SeriesStyle } from './palette.ts';
import {
  axisTitles,
  buildAxis,
  emptyChart,
  FONT,
  formatFor,
  r2,
  svgOpen,
  tipAttr,
  yAxis,
  type AxisSpec,
  type ChartOut,
  type Margin,
  type Size,
} from './svg.ts';

const BAR_MAX = 24;
const GAP = 2;
const RADIUS = 4;

export interface BarLayer extends SeriesStyle {
  label: string;
  /** One value per category. */
  values: number[];
}

export interface StackedBarSpec {
  title: string;
  size?: Size;
  categories: string[];
  layers: BarLayer[];
  /** Linear from zero. */
  y: AxisSpec;
  xLabel?: string;
  /** Extra tooltip lines per category (after the values). */
  notes?: string[][];
  /** Which categories get an axis label (default: all that fit). */
  showLabel?: (i: number) => boolean;
  emptyText?: string;
}

/** Band layout: centre of each category and the column width. */
function band(n: number, m: Margin, size: Size) {
  const w = size.width - m.left - m.right;
  const slot = w / Math.max(1, n);
  const barW = Math.max(1, Math.min(BAR_MAX, slot * 0.7));
  return { slot, barW, cx: (i: number) => m.left + slot * (i + 0.5) };
}

/**
 * Category labels along the bottom. `show` picks which ones get a label
 * (default: all, thinned so they never overlap); a label longer than its slot
 * is cut with an ellipsis (the full name is in the tooltip and the table).
 */
function bandLabels(
  cats: string[],
  cx: (i: number) => number,
  slot: number,
  m: Margin,
  size: Size,
  show?: (i: number) => boolean,
) {
  const charW = FONT * 0.62;
  const longest = Math.max(1, ...cats.map((c) => c.length));
  const every = show ? 1 : slot >= 48 ? 1 : Math.max(1, Math.ceil((longest * charW + 8) / slot));
  const shown = (i: number) => (show ? show(i) : i % every === 0);
  const room = show ? Infinity : Math.max(3, Math.floor((slot * every - 6) / charW));
  const cut = (c: string) => (c.length > room ? `${c.slice(0, room - 1)}…` : c);
  const y = size.height - m.bottom;
  return (
    `<line class="axis" x1="${m.left}" x2="${size.width - m.right}" y1="${y}" y2="${y}"/>` +
    cats
      .map((c, i) =>
        shown(i)
          ? `<text class="tick" x="${r2(cx(i))}" y="${y + FONT + 6}" text-anchor="middle">${esc(cut(c))}</text>`
          : '',
      )
      .join('')
  );
}

/** Column with a rounded top and square base (y0 = baseline, y1 = top). */
function columnPath(x: number, w: number, y0: number, y1: number, round: boolean): string {
  const h = y0 - y1;
  const rr = round ? Math.min(RADIUS, h, w / 2) : 0;
  const l = r2(x - w / 2);
  const rt = r2(x + w / 2);
  if (rr <= 0) return `M${l} ${r2(y0)}V${r2(y1)}H${rt}V${r2(y0)}Z`;
  return (
    `M${l} ${r2(y0)}V${r2(y1 + rr)}Q${l} ${r2(y1)} ${r2(l + rr)} ${r2(y1)}` +
    `H${r2(rt - rr)}Q${rt} ${r2(y1)} ${rt} ${r2(y1 + rr)}V${r2(y0)}Z`
  );
}

export function stackedBars(spec: StackedBarSpec): ChartOut {
  const size = spec.size ?? { width: 720, height: 240 };
  const m: Margin = { top: 28, right: 16, bottom: 34, left: 52 };
  const n = spec.categories.length;
  const totals = spec.categories.map((_, i) =>
    spec.layers.reduce((s, l) => s + Math.max(0, l.values[i] || 0), 0),
  );
  const Y = buildAxis(
    { ...spec.y, type: 'linear', zero: true },
    totals,
    [size.height - m.bottom, m.top],
    4,
  );
  const { slot, barW, cx } = band(n, m, size);
  let body = yAxis(Y.scale, Y.ticks, spec.y.kind, m, size);
  body += bandLabels(spec.categories, cx, slot, m, size, spec.showLabel);
  body += axisTitles(m, size, spec.xLabel, spec.y.label);
  if (n === 0 || totals.every((t) => t === 0)) {
    return emptyChart(spec.title, size, m, spec.emptyText);
  }
  const fmt = formatFor(spec.y.kind);
  const y0 = Y.scale(0);
  spec.categories.forEach((cat, i) => {
    let acc = 0;
    const segs = spec.layers
      .map((l) => ({ l, v: Math.max(0, l.values[i] || 0) }))
      .filter((s) => s.v > 0);
    segs.forEach((s, k) => {
      const lo = Y.scale(acc);
      acc += s.v;
      // The gap comes off the top of every segment but the last.
      const hi = Y.scale(acc) + (k < segs.length - 1 ? GAP : 0);
      if (lo - hi < 0.5) return;
      body += `<path class="bar" d="${columnPath(cx(i), barW, lo, hi, k === segs.length - 1)}" style="fill:${s.l.color}"/>`;
    });
    const lines = [
      cat,
      ...spec.layers.map((l) => `${fmt(Math.max(0, l.values[i] || 0))}  ${l.label}`),
      ...(spec.layers.length > 1 ? [`${fmtNum(totals[i])}  Total`] : []),
      ...(spec.notes?.[i] ?? []),
    ];
    body += `<rect class="mark-hit" x="${r2(cx(i) - slot / 2)}" y="${m.top}" width="${r2(slot)}" height="${r2(y0 - m.top)}"${tipAttr(lines)}/>`;
  });
  return { svg: `${svgOpen(size, spec.title)}${body}</svg>` };
}

export interface RangeItem extends SeriesStyle {
  label: string;
  mid: number;
  lo: number;
  hi: number;
  /** Extra tooltip line, e.g. "not reached in 2 of 20 runs". */
  note?: string;
}

export interface DotRangeSpec {
  title: string;
  size?: Size;
  items: RangeItem[];
  y: AxisSpec;
  xLabel?: string;
  /** Format for the tooltip values. */
  hoverFormat?: (v: number) => string;
  /** Text drawn for an item with no median (e.g. "not reached"). */
  missingText?: string;
  emptyText?: string;
}

export function dotRange(spec: DotRangeSpec): ChartOut {
  const size = spec.size ?? { width: 720, height: 260 };
  const m: Margin = { top: 28, right: 16, bottom: 34, left: 52 };
  const ok = (v: number) => Number.isFinite(v) && (spec.y.type !== 'log' || v > 0);
  const values = spec.items.flatMap((it) => [it.mid, it.lo, it.hi]).filter(ok);
  const Y = buildAxis(spec.y, values, [size.height - m.bottom, m.top], 4);
  const { slot, cx } = band(spec.items.length, m, size);
  let body = yAxis(Y.scale, Y.ticks, spec.y.kind, m, size);
  body += bandLabels(
    spec.items.map((it) => it.label),
    cx,
    slot,
    m,
    size,
  );
  body += axisTitles(m, size, spec.xLabel, spec.y.label);
  if (spec.items.length === 0) {
    return emptyChart(spec.title, size, m, spec.emptyText);
  }
  const fmt = spec.hoverFormat ?? formatFor(spec.y.kind);
  spec.items.forEach((it, i) => {
    const x = r2(cx(i));
    if (ok(it.lo) && ok(it.hi)) {
      body += `<line class="range" x1="${x}" x2="${x}" y1="${r2(Y.scale(it.lo))}" y2="${r2(Y.scale(it.hi))}" style="stroke:${it.color}"/>`;
    }
    if (ok(it.mid)) {
      body += `<circle class="dot ring" cx="${x}" cy="${r2(Y.scale(it.mid))}" r="5" style="fill:${it.color}"/>`;
    } else {
      body += `<text class="missing" x="${x}" y="${m.top + 16}" text-anchor="middle">${esc(spec.missingText ?? '–')}</text>`;
    }
    const lines = [
      it.label,
      `${ok(it.mid) ? fmt(it.mid) : (spec.missingText ?? '–')}  median`,
      ...(ok(it.lo) && ok(it.hi) ? [`${fmt(it.lo)} – ${fmt(it.hi)}  p10–p90`] : []),
      ...(it.note ? [it.note] : []),
    ];
    body += `<rect class="mark-hit" x="${r2(cx(i) - slot / 2)}" y="${m.top}" width="${r2(slot)}" height="${size.height - m.top - m.bottom}"${tipAttr(lines)}/>`;
  });
  return { svg: `${svgOpen(size, spec.title)}${body}</svg>` };
}
