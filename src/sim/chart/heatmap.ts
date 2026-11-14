/**
 * Heatmap for two swept settings: one cell per (x, y) value pair, coloured by
 * the 5-step sequential ramp (low → high), value printed inside, with a step
 * legend. Missing cells stay empty and say so in the tooltip.
 */
import { esc } from './format.ts';
import { SEQUENTIAL_LIGHT } from './palette.ts';
import { quantile } from './scale.ts';
import { FONT, r2, svgOpen, tipAttr, type ChartOut, type Margin, type Size } from './svg.ts';

export interface HeatmapSpec {
  title: string;
  size?: Size;
  xLabels: string[];
  yLabels: string[];
  /** cells[yi][xi]; NaN = no value. */
  cells: number[][];
  format: (v: number) => string;
  xTitle?: string;
  yTitle?: string;
  /** Use log steps (times, coins). */
  log?: boolean;
  /** Text for a missing cell. */
  missingText?: string;
}

const STEPS = SEQUENTIAL_LIGHT.length;

/** Step (0–4) per value: equal-width bins in (log) value between min and max. */
export function binValues(
  values: number[],
  log: boolean,
): { step: (v: number) => number; edges: number[] } {
  const t = (v: number) => (log ? Math.log10(v) : v);
  const vs = values.filter((v) => Number.isFinite(v) && (!log || v > 0)).map(t);
  const lo = vs.length ? quantile(vs, 0) : 0;
  const hi = vs.length ? quantile(vs, 1) : 1;
  const span = hi - lo || 1;
  const step = (v: number) =>
    Math.max(0, Math.min(STEPS - 1, Math.floor(((t(v) - lo) / span) * STEPS)));
  const edges = Array.from({ length: STEPS + 1 }, (_, i) => lo + (span * i) / STEPS).map((e) =>
    log ? 10 ** e : e,
  );
  return { step, edges };
}

export function heatmap(spec: HeatmapSpec): ChartOut {
  const nx = spec.xLabels.length;
  const ny = spec.yLabels.length;
  // Always 720 wide (like every chart, so text keeps its size); cells are
  // capped at 120 × 40 and the grid sits on the left.
  const width = spec.size?.width ?? 720;
  const m: Margin = { top: 28, right: 16, bottom: 74, left: 84 };
  const cw = Math.min(120, (width - m.left - m.right) / Math.max(1, nx));
  const ch = 40;
  const size = spec.size ?? { width, height: m.top + m.bottom + ch * Math.max(1, ny) };
  const { step, edges } = binValues(spec.cells.flat(), !!spec.log);
  let body = '';
  spec.yLabels.forEach((yl, yi) => {
    // First y value at the bottom, like a normal axis.
    const y = size.height - m.bottom - (yi + 1) * ch;
    body += `<text class="tick" x="${m.left - 6}" y="${r2(y + ch / 2)}" text-anchor="end" dominant-baseline="middle">${esc(yl)}</text>`;
    spec.xLabels.forEach((xl, xi) => {
      const x = m.left + xi * cw;
      const v = spec.cells[yi]?.[xi] ?? NaN;
      const has = Number.isFinite(v) && (!spec.log || v > 0);
      const tip = [
        `${spec.xTitle ?? 'x'} ${xl} · ${spec.yTitle ?? 'y'} ${yl}`,
        has ? spec.format(v) : (spec.missingText ?? 'no value'),
      ];
      if (has) {
        const s = step(v);
        body += `<rect class="cell" x="${r2(x + 1)}" y="${r2(y + 1)}" width="${r2(cw - 2)}" height="${r2(ch - 2)}" rx="2" style="fill:var(--q${s + 1})"/>`;
        if (cw >= 36) {
          body += `<text class="cell-v v${s + 1}" x="${r2(x + cw / 2)}" y="${r2(y + ch / 2)}" text-anchor="middle" dominant-baseline="middle">${esc(spec.format(v))}</text>`;
        }
      } else {
        body += `<rect class="cell cell-empty" x="${r2(x + 1)}" y="${r2(y + 1)}" width="${r2(cw - 2)}" height="${r2(ch - 2)}" rx="2"/>`;
      }
      body += `<rect class="mark-hit" x="${r2(x)}" y="${r2(y)}" width="${r2(cw)}" height="${r2(ch)}"${tipAttr(tip)}/>`;
    });
  });
  const by = size.height - m.bottom;
  spec.xLabels.forEach((xl, xi) => {
    body += `<text class="tick" x="${r2(m.left + (xi + 0.5) * cw)}" y="${by + FONT + 6}" text-anchor="middle">${esc(xl)}</text>`;
  });
  if (spec.xTitle)
    body += `<text class="axis-title" x="${r2(m.left + nx * cw)}" y="${by + 2 * FONT + 12}" text-anchor="end">${esc(spec.xTitle)}</text>`;
  if (spec.yTitle)
    body += `<text class="axis-title" x="${m.left}" y="${m.top - 10}">${esc(spec.yTitle)}</text>`;
  // Step legend: five swatches, low → high, with the lower edge of each bin.
  const lw = 40;
  const lx = m.left;
  const ly = size.height - 20;
  edges.slice(0, STEPS).forEach((e, i) => {
    body += `<rect x="${lx + i * lw}" y="${ly - 8}" width="${lw - 2}" height="8" rx="2" style="fill:var(--q${i + 1})"/>`;
    body += `<text class="tick" x="${lx + i * lw}" y="${ly + FONT}" >${esc(spec.format(e))}</text>`;
  });
  return { svg: `${svgOpen(size, spec.title)}${body}</svg>` };
}
