/**
 * Shared SVG pieces: axis set-up, gridlines, tick labels, legend, empty state.
 * Every chart is a string, so the same code runs in Node and the browser.
 */
import { esc, fmtDurationShort, fmtNum, fmtStage } from './format.ts';
import type { SeriesStyle } from './palette.ts';
import {
  linearTicks,
  logTicks,
  makeScale,
  safeDomain,
  stageTicks,
  timeTicks,
  type Scale,
  type ScaleType,
} from './scale.ts';

/** What the numbers on an axis mean; picks the ticks and the label format. */
export type AxisKind = 'number' | 'time' | 'stage';

export interface AxisSpec {
  type: ScaleType;
  kind: AxisKind;
  /** Axis title (short, sentence case). */
  label?: string;
  /** Include zero in a linear domain (bars, counts). */
  zero?: boolean;
  /** Fixed domain; otherwise computed from the data. */
  domain?: [number, number];
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Hover data for the report's tiny script; plain JSON. */
export interface XHover {
  /** Crosshair positions in viewBox units, ascending. */
  xs: number[];
  /** Formatted x value per position. */
  labels: string[];
  top: number;
  bottom: number;
  rows: { label: string; color: string; dash: string; values: string[] }[];
}

/** Nearest-point hover for dot charts: positions (viewBox) and tooltip lines per dot. */
export interface PointHover {
  /** Flat [x0, y0, x1, y1, …] in viewBox units. */
  pts: number[];
  tips: string[][];
}

export interface ChartOut {
  svg: string;
  hover?: XHover | PointHover;
}

export const FONT = 11;

export function formatFor(kind: AxisKind): (v: number) => string {
  return kind === 'time' ? fmtDurationShort : kind === 'stage' ? fmtStage : fmtNum;
}

/** Domain + ticks + scale for one axis. */
export function buildAxis(
  spec: AxisSpec,
  values: number[],
  range: [number, number],
  tickCount = 5,
): { scale: Scale; ticks: number[] } {
  const raw = spec.domain ?? safeDomain(values, spec.type, spec.zero);
  let t: { ticks: number[]; domain: [number, number] };
  if (spec.kind === 'time') t = timeTicks(raw, spec.type, tickCount + 1);
  else if (spec.kind === 'stage' && spec.type === 'linear') t = stageTicks(raw, tickCount + 1);
  else if (spec.type === 'log') t = logTicks(raw, tickCount + 2);
  else t = linearTicks(raw, tickCount);
  const domain = spec.domain ?? t.domain;
  const ticks = t.ticks.filter((v) => v >= domain[0] - 1e-9 && v <= domain[1] + 1e-9);
  return { scale: makeScale(spec.type, domain, range), ticks };
}

/** 2 decimals is plenty in a viewBox and keeps snapshots short. */
export const r2 = (v: number) => Math.round(v * 100) / 100;

export function svgOpen(size: Size, title: string, extraClass = ''): string {
  return (
    `<svg class="viz-svg${extraClass ? ` ${extraClass}` : ''}" viewBox="0 0 ${size.width} ${size.height}" ` +
    `role="img" aria-label="${esc(title)}">`
  );
}

/** Drop ticks whose label would repeat the previous one (very narrow domains). */
function distinctLabels(ticks: number[], fmt: (v: number) => string): number[] {
  return ticks.filter((t, i) => i === 0 || fmt(t) !== fmt(ticks[i - 1]));
}

/** Horizontal gridlines + y tick labels. */
export function yAxis(scale: Scale, ticks: number[], kind: AxisKind, m: Margin, size: Size) {
  const fmt = formatFor(kind);
  const x0 = m.left;
  const x1 = size.width - m.right;
  return distinctLabels(ticks, fmt)
    .map((t) => {
      const y = r2(scale(t));
      return (
        `<line class="grid" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/>` +
        `<text class="tick" x="${x0 - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${esc(fmt(t))}</text>`
      );
    })
    .join('');
}

/** Baseline + x tick labels. */
export function xAxis(scale: Scale, ticks: number[], kind: AxisKind, m: Margin, size: Size) {
  const fmt = formatFor(kind);
  const y = size.height - m.bottom;
  const base = `<line class="axis" x1="${m.left}" x2="${size.width - m.right}" y1="${y}" y2="${y}"/>`;
  return (
    base +
    distinctLabels(ticks, fmt)
      .map((t) => {
        const x = r2(scale(t));
        return `<text class="tick" x="${x}" y="${y + FONT + 6}" text-anchor="middle">${esc(fmt(t))}</text>`;
      })
      .join('')
  );
}

export function axisTitles(m: Margin, size: Size, x?: string, y?: string): string {
  let out = '';
  if (y) out += `<text class="axis-title" x="${m.left}" y="${m.top - 10}">${esc(y)}</text>`;
  if (x)
    out += `<text class="axis-title" x="${size.width - m.right}" y="${size.height - 4}" text-anchor="end">${esc(x)}</text>`;
  return out;
}

/** A chart with nothing to draw: the frame's baseline and a short message, no ticks. */
export function emptyChart(title: string, full: Size, m: Margin, text = 'No data'): ChartOut {
  // Short: an empty panel shouldn't take a full chart's height.
  const size = { width: full.width, height: Math.min(full.height, m.top + m.bottom + 40) };
  const cx = r2((m.left + size.width - m.right) / 2);
  const cy = r2((m.top + size.height - m.bottom) / 2);
  const y = size.height - m.bottom;
  return {
    svg:
      `${svgOpen(size, `${title}: ${text}`)}` +
      `<line class="axis" x1="${m.left}" x2="${size.width - m.right}" y1="${y}" y2="${y}"/>` +
      `<text class="empty" x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle">${esc(text)}</text></svg>`,
  };
}

export interface LegendItem extends SeriesStyle {
  label: string;
  /** 'line' for lines, 'rect' for bars/areas, 'dot' for dots. */
  mark: 'line' | 'rect' | 'dot';
}

/**
 * HTML legend (sits above the plot, wraps on narrow screens). Only for two or
 * more items: a single series is named by the chart title.
 */
export function legendHtml(items: LegendItem[]): string {
  if (items.length < 2) return '';
  const key = (it: LegendItem) => {
    const style = `stroke:${it.color};fill:${it.color}`;
    if (it.mark === 'rect')
      return `<svg class="key" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" style="${style};stroke:none"/></svg>`;
    if (it.mark === 'dot')
      return `<svg class="key" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4" style="${style};stroke:none"/></svg>`;
    return `<svg class="key key-line" viewBox="0 0 24 12" aria-hidden="true"><line x1="1" x2="23" y1="6" y2="6" style="stroke:${it.color}"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''}/></svg>`;
  };
  return `<ul class="legend">${items.map((it) => `<li>${key(it)}<span>${esc(it.label)}</span></li>`).join('')}</ul>`;
}

/** Nearest index in an ascending list. */
export function nearestIndex(xs: number[], x: number): number {
  let lo = 0;
  let hi = xs.length - 1;
  if (hi < 0) return -1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  return Math.abs(xs[hi] - x) < Math.abs(xs[lo] - x) ? hi : lo;
}

/** Tooltip text for per-mark hover: header line, then value lines. */
export function tipAttr(lines: string[]): string {
  return ` tabindex="0" data-tip="${esc(lines.join('\n')).replace(/\n/g, '&#10;')}"`;
}
