/**
 * `report.html`: one self-contained page (no network, no fonts, no CDN) with
 * the simulator charts from the design doc §5.3, light and dark theme, a
 * filter row, hover tooltips and a table under every chart.
 *
 * Pure: `buildReport(input)` returns the HTML string, so Node (the CLI) and
 * the browser (the debug tab) can both use it.
 */
import { stackedArea } from './chart/area.ts';
import { dotRange, stackedBars } from './chart/bar.ts';
import {
  ascendSweepKey,
  band,
  durationOf,
  dropsPerBucket,
  hasWallTime,
  horizons,
  lastSample,
  numericSweepKeys,
  PURCHASE_GROUPS,
  purchaseGaps,
  purchaseGroup,
  SPEND_KINDS,
  SPEND_LABELS,
  spendPerMin,
  tierLabel,
  TIERS,
  timePerStage,
  timeToReach,
  wallOf,
  worldLevel,
  WORLDS,
  type Clock,
  type ReportInput,
  type ReportSample,
  type ReportVariant,
} from './chart/data.ts';
import {
  esc,
  fmtDuration,
  fmtDurationShort,
  fmtNum,
  fmtStage,
  parseDuration,
  STAGES_PER_WORLD,
} from './chart/format.ts';
import { heatmap } from './chart/heatmap.ts';
import { lineChart, type LineSeries } from './chart/line.ts';
import { PAGE_JS, pageCss } from './chart/page.ts';
import { categorical, sequential, sequentialSteps, type SeriesStyle } from './chart/palette.ts';
import { quantile, type ScaleType } from './chart/scale.ts';
import { scatter } from './chart/scatter.ts';
import {
  legendHtml,
  type ChartOut,
  type LegendItem,
  type PointHover,
  type XHover,
} from './chart/svg.ts';

type Filters = Record<string, string>;

/** Collects hover data while charts are rendered. */
class Ctx {
  hover: Record<string, XHover | PointHover> = {};
  private n = 0;
  readonly defaults: Filters;
  constructor(defaults: Filters) {
    this.defaults = defaults;
  }

  /** One plot, shown only when every filter in `f` matches the current choice. */
  plot(out: ChartOut, f: Filters = {}, extra = ''): string {
    let attrs = '';
    if (out.hover) {
      const id = `h${++this.n}`;
      this.hover[id] = out.hover;
      attrs += ` data-hover="${id}"`;
    }
    return `<div class="plot"${attrs}${this.filterAttrs(f)}>${extra}${out.svg}</div>`;
  }

  /** `data-f-*` attributes, `hidden` when not the default choice. */
  filterAttrs(f: Filters): string {
    const keys = Object.keys(f);
    if (keys.length === 0) return '';
    const hidden = keys.some((k) => this.defaults[k] !== f[k]);
    return (
      ` data-filtered` +
      keys.map((k) => ` data-f-${k}="${esc(f[k])}"`).join('') +
      (hidden ? ' hidden' : '')
    );
  }

  block(html: string, f: Filters): string {
    return `<div${this.filterAttrs(f)}>${html}</div>`;
  }
}

function table(head: string[], rows: (string | number)[][]): string {
  return (
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') +
    `</tbody></table>`
  );
}

const details = (inner: string, label = 'Table view') =>
  `<details><summary>${esc(label)}</summary>${inner}</details>`;

function card(id: string, title: string, sub: string, body: string): string {
  return `<section class="card" id="${id}"><h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p>${body}</section>`;
}

/**
 * Colour per variant. A single numeric sweep with ≤ 5 values uses the
 * sequential ramp in value order; everything else uses the categorical slots
 * in the order the variants are listed (colour follows the variant).
 */
export function variantStyles(input: ReportInput): SeriesStyle[] {
  const n = input.variants.length;
  const keys = Object.keys(input.scenario.sweep ?? {});
  const numeric = numericSweepKeys(input);
  if (keys.length === 1 && numeric.length === 1 && n >= 2 && n <= 5) {
    const k = numeric[0];
    const order = input.variants
      .map((v, i) => ({ i, val: v.params![k] as number }))
      .sort((a, b) => a.val - b.val);
    const steps = sequentialSteps(n);
    const out: SeriesStyle[] = new Array(n);
    order.forEach((o, rank) => (out[o.i] = sequential(steps[rank], rank)));
    return out;
  }
  return input.variants.map((_, i) => categorical(i));
}

/** Label world starts only, every k-th world, at most ~10 labels. */
function stageLabelShown(level: number, count: number): boolean {
  if (count <= 12) return true;
  const worlds = Math.ceil(count / STAGES_PER_WORLD);
  const k = [1, 2, 5, 10, 20, 50].find((x) => worlds / x <= 10) ?? 100;
  const w = Math.floor((level - 1) / STAGES_PER_WORLD);
  return (level - 1) % STAGES_PER_WORLD === 0 && w % k === 0;
}

const median = (xs: number[]) => quantile(xs, 0.5);
const finalOf = (v: ReportVariant, get: (s: ReportSample) => number | undefined) =>
  median(v.runs.map((r) => get(lastSample(r) ?? ({} as ReportSample)) ?? NaN));

/** Build the whole page. */
export function buildReport(input: ReportInput): string {
  const sc = input.scenario;
  const duration = durationOf(input);
  const variants = input.variants;
  const styles = variantStyles(input);
  const wall = hasWallTime(input);
  const clocks: Clock[] = wall ? ['play', 'wall'] : ['play'];
  const scales: ScaleType[] = ['log', 'linear'];
  const ctx = new Ctx({
    variant: variants[0]?.id ?? '',
    xscale: sc.report?.xAxis ?? 'log',
    clock: 'play',
    world: '2',
  });
  const timeLabel = (c: Clock) => (c === 'wall' ? 'wall time' : 'play time');
  const legendVariants: LegendItem[] = variants.map((v, i) => ({
    ...styles[i],
    label: v.label,
    mark: 'line',
  }));

  // ---- header -------------------------------------------------------------
  const runs = sc.runs ?? Math.max(0, ...variants.map((v) => v.runs.length));
  const metaBits = [
    sc.gameVersion ? `game v${sc.gameVersion}` : '',
    sc.seed !== undefined ? `seed ${sc.seed}` : '',
    `${runs} run${runs === 1 ? '' : 's'} per variant`,
    `${fmtDuration(duration)} of play`,
    `${variants.length} variant${variants.length === 1 ? '' : 's'}`,
  ].filter(Boolean);
  const tuningRows = Object.entries(sc.tuning ?? {}).map(([k, v]) => [k, JSON.stringify(v)]);
  const sweepRows = Object.entries(sc.sweep ?? {}).map(([k, v]) => [k, v.map(String).join(', ')]);
  const botRows = Object.entries(sc.bots ?? {}).map(([k, v]) => [
    k,
    Object.entries(v)
      .map(([a, b]) => `${a}: ${typeof b === 'object' ? JSON.stringify(b) : String(b)}`)
      .join(' · '),
  ]);
  const variantRows = variants.map((v) => [
    v.label,
    v.bot ?? '',
    Object.entries(v.params ?? {})
      .map(([k, x]) => `${k} = ${x}`)
      .join(', '),
    v.runs.length,
  ]);
  let header =
    `<h1>${esc(sc.name)}</h1><p class="meta">${esc(metaBits.join(' · '))}</p>` +
    details(
      table(['Variant', 'Bot', 'Settings', 'Runs'], variantRows) +
        (sweepRows.length ? table(['Sweep', 'Values'], sweepRows) : '') +
        (botRows.length ? table(['Bot', 'Policies'], botRows) : '') +
        (tuningRows.length ? table(['Tuning', 'Value'], tuningRows) : ''),
      'Scenario, bots and tuning',
    );

  // ---- filter row -----------------------------------------------------------
  const sel = (name: string, label: string, opts: [string, string][], value: string, id = '') =>
    `<label>${esc(label)}<select ${id ? `id="${id}"` : `data-filter="${name}"`}>` +
    opts
      .map(
        ([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`,
      )
      .join('') +
    `</select></label>`;
  const filters =
    `<div class="filters">` +
    (variants.length > 1
      ? sel(
          'variant',
          'Variant (KPIs, charts 3, 4, 5, 6, 8)',
          variants.map((v) => [v.id, v.label]),
          ctx.defaults.variant,
        )
      : '') +
    sel(
      'xscale',
      'Time axis',
      [
        ['log', 'Log'],
        ['linear', 'Linear'],
      ],
      ctx.defaults.xscale,
    ) +
    (wall
      ? sel(
          'clock',
          'Clock (charts 1, 5)',
          [
            ['play', 'Play time'],
            ['wall', 'Wall time'],
          ],
          'play',
        )
      : '') +
    sel(
      'world',
      'Target (chart 2)',
      WORLDS.map((w) => [String(w), `World ${w}`]),
      '2',
    ) +
    sel(
      'theme',
      'Theme',
      [
        ['auto', 'Auto'],
        ['light', 'Light'],
        ['dark', 'Dark'],
      ],
      'auto',
      'theme',
    ) +
    `</div>`;

  // ---- 10. KPI row ------------------------------------------------------------
  const targets = sc.report?.targets ?? [];
  const kpis = variants
    .map((v) => {
      const tiles = WORLDS.map((w) => {
        const r = timeToReach(v, worldLevel(w));
        const t = targets.find((x) => x.level === worldLevel(w));
        const target = t ? parseDuration(t.at) : NaN;
        const value = Number.isFinite(r.mid) ? fmtDuration(r.mid) : 'not reached';
        let status = '<span>no target set</span>';
        if (t) {
          const ok = Number.isFinite(r.mid) && r.mid <= target;
          status = ok
            ? `<span class="icon-good" aria-hidden="true">✓</span><span>within the ${esc(fmtDurationShort(target))} target</span>`
            : `<span class="icon-bad" aria-hidden="true">✕</span><span>slower than the ${esc(fmtDurationShort(target))} target</span>`;
        }
        const never = r.never
          ? `<div class="s">${r.never} of ${r.runs} runs never reached it</div>`
          : '';
        return (
          `<div class="tile"><div class="k">Time to World ${w} (median)</div>` +
          `<div class="v">${esc(value)}</div><div class="s">${status}</div>${never}</div>`
        );
      }).join('');
      return ctx.block(
        `<div class="kpis" aria-label="${esc(`Key numbers for ${v.label}`)}">${tiles}</div>`,
        { variant: v.id },
      );
    })
    .join('');

  // ---- 1. Progress ------------------------------------------------------------
  let c1 = legendHtml(legendVariants);
  for (const clock of clocks) {
    for (const xs of scales) {
      const series: LineSeries[] = variants.map((v, i) => {
        const b = band(v, (s) => s.best, clock);
        return {
          ...styles[i],
          label: v.label,
          step: true,
          points: b.map((p) => ({ x: p.x, y: p.mid })),
          band: b.map((p) => ({ x: p.x, lo: p.lo, hi: p.hi })),
        };
      });
      c1 += ctx.plot(
        lineChart({
          title: `Best stage over ${timeLabel(clock)}`,
          x: { type: xs, kind: 'time', label: timeLabel(clock) },
          y: { type: 'linear', kind: 'stage', label: 'Best stage (world.stage)' },
          series,
          endLabels: true,
        }),
        { xscale: xs, clock },
      );
    }
  }
  const hz = horizons(duration);
  c1 += details(
    table(
      ['Variant', ...hz.map((h) => `after ${fmtDuration(h)}`)],
      variants.map((v) => [
        v.label,
        ...hz.map((h) => {
          const b = band(v, (s) => s.best, 'play', [h]);
          return b.length
            ? `${fmtStage(b[0].mid)} (${fmtStage(b[0].lo)}–${fmtStage(b[0].hi)})`
            : '–';
        }),
      ]),
    ),
  );
  const s1 = card(
    'progress',
    '1. Progress',
    'Best stage reached over time. Line: median of the runs; band: p10–p90.',
    c1,
  );

  // ---- 2. Time to reach stage N ------------------------------------------
  const numeric = numericSweepKeys(input);
  const grid2 = numeric.length === 2 && Object.keys(sc.sweep ?? {}).length === 2;
  let c2 = '';
  for (const w of WORLDS) {
    const level = worldLevel(w);
    if (grid2) {
      const [kx, ky] = numeric;
      const xv = [...new Set(variants.map((v) => v.params![kx] as number))].sort((a, b) => a - b);
      const yv = [...new Set(variants.map((v) => v.params![ky] as number))].sort((a, b) => a - b);
      const cells = yv.map((y) =>
        xv.map((x) => {
          const v = variants.find((q) => q.params![kx] === x && q.params![ky] === y);
          return v ? timeToReach(v, level).mid : NaN;
        }),
      );
      c2 += ctx.plot(
        heatmap({
          title: `Median time to World ${w}`,
          xLabels: xv.map(fmtNum),
          yLabels: yv.map(fmtNum),
          cells: cells.map((r) => r.map((t) => (Number.isFinite(t) ? t : NaN))),
          format: fmtDurationShort,
          xTitle: kx,
          yTitle: ky,
          log: true,
          missingText: 'not reached',
        }),
        { world: String(w) },
      );
    } else {
      c2 += ctx.plot(
        dotRange({
          title: `Time to reach World ${w}`,
          items: variants.map((v, i) => {
            const r = timeToReach(v, level);
            return {
              ...styles[i],
              label: v.label,
              mid: r.mid,
              lo: r.lo,
              hi: r.hi,
              note: r.never ? `${r.never} of ${r.runs} runs never reached it` : undefined,
            };
          }),
          y: { type: 'log', kind: 'time', label: `Time to World ${w} (stage ${fmtStage(level)})` },
          hoverFormat: fmtDuration,
          missingText: 'not reached',
        }),
        { world: String(w) },
      );
    }
  }
  c2 += details(
    table(
      ['Variant', ...WORLDS.map((w) => `World ${w}: median (p10–p90)`)],
      variants.map((v) => [
        v.label,
        ...WORLDS.map((w) => {
          const r = timeToReach(v, worldLevel(w));
          const mid = Number.isFinite(r.mid) ? fmtDuration(r.mid) : 'not reached';
          const never = r.never ? `, ${r.never}/${r.runs} never` : '';
          return `${mid} (${fmtDuration(r.lo)}–${Number.isFinite(r.hi) ? fmtDuration(r.hi) : 'never'}${never})`;
        }),
      ]),
    ),
  );
  const s2 = card(
    'time-to-stage',
    '2. Time to reach a world',
    grid2
      ? 'Median time to reach the chosen world for each pair of swept settings (log steps). Pick the world in the filter row.'
      : 'Dot: median of the runs; line: p10–p90. Log scale. Pick the world in the filter row.',
    c2,
  );

  // ---- 3. Power vs wall ---------------------------------------------------
  let c3 = '';
  const ttLegend = legendHtml([
    { ...categorical(0), label: 'Time to kill a mob', mark: 'line' },
    { ...categorical(1), label: 'Time to die', mark: 'line' },
  ]);
  variants.forEach((v) => {
    for (const clock of ['play'] as Clock[]) {
      for (const xs of scales) {
        const line = (get: (s: ReportSample) => number | undefined, label: string, i: number) => {
          const b = band(v, get, clock);
          return { ...categorical(i), label, points: b.map((p) => ({ x: p.x, y: p.mid })) };
        };
        const x = { type: xs, kind: 'time' as const, label: timeLabel(clock) };
        const size = { width: 720, height: 170 };
        const f = { variant: v.id, xscale: xs };
        c3 += ctx.block(
          ctx.plot(
            lineChart({
              title: `Effective damage per second, ${v.label}`,
              size,
              x,
              y: { type: 'log', kind: 'number', label: 'Damage per second' },
              series: [line((s) => s.dpsEff, 'Damage per second', 0)],
            }),
          ) +
            ctx.plot(
              lineChart({
                title: `Mob HP, ${v.label}`,
                size,
                x,
                y: { type: 'log', kind: 'number', label: 'Mob HP at the current stage' },
                series: [line((s) => s.mobHp, 'Mob HP', 0)],
              }),
            ) +
            ttLegend +
            ctx.plot(
              lineChart({
                title: `Time to kill and time to die, ${v.label}`,
                size: { width: 720, height: 200 },
                x,
                y: { type: 'log', kind: 'time', label: 'Seconds' },
                series: [
                  line((s) => s.ttk, 'Time to kill', 0),
                  line((s) => s.ttd, 'Time to die', 1),
                ],
                hoverFormat: fmtDuration,
              }),
            ),
          f,
        );
      }
    }
  });
  c3 += details(
    table(
      ['Variant', 'Horizon', 'DPS', 'Mob HP', 'Time to kill', 'Time to die'],
      variants.flatMap((v) =>
        hz.map((h) => {
          const at = (get: (s: ReportSample) => number | undefined) =>
            band(v, get, 'play', [h])[0]?.mid ?? NaN;
          return [
            v.label,
            fmtDuration(h),
            fmtNum(at((s) => s.dpsEff)),
            fmtNum(at((s) => s.mobHp)),
            fmtDuration(at((s) => s.ttk)),
            fmtDuration(at((s) => s.ttd)),
          ];
        }),
      ),
    ),
  );
  const s3 = card(
    'power',
    '3. Power vs wall',
    'Hero damage against mob HP, then time to kill against time to die (medians, log scales). Where time to kill rises above time to die, the hero hits a wall.',
    c3,
  );

  // ---- 4. Income vs spend -------------------------------------------------
  let c4 = '';
  const ieLegend = legendHtml([
    { ...categorical(0), label: 'Income per minute', mark: 'line' },
    { ...categorical(1), label: 'Spend per minute', mark: 'line' },
  ]);
  const spendStyles = SPEND_KINDS.map((_, i) => categorical(i + 2));
  const spendLegend = legendHtml(
    SPEND_KINDS.map((k, i) => ({ ...spendStyles[i], label: SPEND_LABELS[k], mark: 'rect' })),
  );
  variants.forEach((v) => {
    for (const clock of ['play'] as Clock[]) {
      for (const xs of scales) {
        const income = band(v, (s) => s.incomePerMin, clock);
        const spend = spendPerMin(v, clock);
        const x = { type: xs, kind: 'time' as const, label: timeLabel(clock) };
        const cum = SPEND_KINDS.map((k) => band(v, (s) => s.spent?.[k] ?? 0, clock));
        const gridX = cum[0].map((p) => p.x);
        c4 += ctx.block(
          ieLegend +
            ctx.plot(
              lineChart({
                title: `Coins per minute, ${v.label}`,
                x,
                y: { type: 'log', kind: 'number', label: 'Coins per minute' },
                series: [
                  {
                    ...categorical(0),
                    label: 'Income',
                    points: income.map((p) => ({ x: p.x, y: p.mid })),
                  },
                  {
                    ...categorical(1),
                    label: 'Spend',
                    points: spend.map((p) => ({ x: p.x, y: p.mid })),
                  },
                ],
              }),
            ) +
            `<h3>Coins spent so far, by category</h3>` +
            spendLegend +
            ctx.plot(
              stackedArea({
                title: `Cumulative spend by category, ${v.label}`,
                x,
                y: { type: 'linear', kind: 'number', label: 'Coins' },
                xs: gridX,
                layers: SPEND_KINDS.map((k, i) => ({
                  ...spendStyles[i],
                  label: SPEND_LABELS[k],
                  values: cum[i].map((p) => p.mid),
                })),
                emptyText: 'Nothing bought',
              }),
            ),
          { variant: v.id, xscale: xs },
        );
      }
    }
  });
  c4 += details(
    table(
      ['Variant', ...SPEND_KINDS.map((k) => SPEND_LABELS[k]), 'Total spent', 'Coins left'],
      variants.map((v) => [
        v.label,
        ...SPEND_KINDS.map((k) => fmtNum(finalOf(v, (s) => s.spent?.[k] ?? 0))),
        fmtNum(finalOf(v, (s) => s.spentTotal)),
        fmtNum(finalOf(v, (s) => s.coins)),
      ]),
    ),
    'Table view (median at the end of the run)',
  );
  const s4 = card(
    'economy',
    '4. Income vs spend',
    'Coins earned and spent per minute (median, log scale), and below it what the coins went into.',
    c4,
  );

  // ---- 5. Ascends -----------------------------------------------------------
  const anyAscend = variants.some((v) =>
    v.runs.some((r) => (r.ascends?.length ?? 0) > 0 || (lastSample(r)?.ascends ?? 0) > 0),
  );
  let c5 = '';
  if (!anyAscend) {
    c5 = `<p class="sub">No run ascended in this scenario.</p>`;
  } else {
    c5 += legendHtml(legendVariants);
    for (const clock of clocks) {
      for (const xs of scales) {
        c5 += ctx.plot(
          lineChart({
            title: 'Ascends over time',
            x: { type: xs, kind: 'time', label: timeLabel(clock) },
            y: { type: 'linear', kind: 'number', label: 'Ascends so far (median)', zero: true },
            series: variants.map((v, i) => ({
              ...styles[i],
              label: v.label,
              step: true,
              points: band(v, (s) => s.ascends ?? 0, clock).map((p) => ({ x: p.x, y: p.mid })),
            })),
            endLabels: true,
          }),
          { xscale: xs, clock },
        );
        for (const [i, v] of variants.entries()) {
          c5 += ctx.plot(
            scatter({
              title: `Stage at each ascend, ${v.label}`,
              x: { type: xs, kind: 'time', label: timeLabel(clock) },
              y: { type: 'linear', kind: 'stage', label: `Stage at each ascend, ${v.label}` },
              groups: [
                {
                  ...styles[i],
                  label: v.label,
                  points: v.runs.flatMap((r) =>
                    (r.ascends ?? []).map((a) => {
                      const t = clock === 'wall' ? wallOf(r, a.t) : a.t;
                      return {
                        x: t,
                        y: a.level,
                        tip: [
                          `${fmtDuration(t)} · seed ${r.seed}`,
                          `${fmtStage(a.level)}  stage at ascend`,
                        ],
                      };
                    }),
                  ),
                },
              ],
              emptyText: 'No ascends for this variant',
            }),
            { xscale: xs, clock, variant: v.id },
          );
        }
      }
    }
  }
  c5 += details(
    table(
      ['Variant', 'Ascends (median)', 'First ascend (median)', 'Median stage at ascend'],
      variants.map((v) => {
        const firsts = v.runs.map((r) => r.ascends?.[0]?.t ?? NaN).filter(Number.isFinite);
        const levels = v.runs.flatMap((r) => (r.ascends ?? []).map((a) => a.level));
        return [
          v.label,
          fmtNum(finalOf(v, (s) => s.ascends ?? 0)),
          firsts.length ? fmtDuration(median(firsts)) : 'never',
          levels.length ? fmtStage(median(levels)) : '–',
        ];
      }),
    ),
  );
  const s5 = card(
    'ascends',
    '5. Ascends over time',
    'How often each variant ascends (median, step line), and the stage each run had reached when it ascended.',
    c5,
  );

  // ---- 6. Item drops by tier -------------------------------------------------
  const tierStyles = TIERS.map((_, i) => sequential(i));
  const tierLegendBars = legendHtml(
    TIERS.map((t, i) => ({ ...tierStyles[i], label: tierLabel(t), mark: 'rect' })),
  );
  let c6 = '';
  variants.forEach((v) => {
    const d = dropsPerBucket(v, duration);
    const n = d.perTier.C.length;
    const cats = Array.from({ length: n }, (_, b) => fmtDurationShort(b * d.size));
    const cum = TIERS.map((t) => band(v, (s) => s.drops?.[t] ?? 0, 'play'));
    c6 += ctx.block(
      tierLegendBars +
        ctx.plot(
          stackedBars({
            title: `Drops per ${fmtDurationShort(d.size)}, ${v.label}`,
            categories: cats,
            layers: TIERS.map((t, i) => ({
              ...tierStyles[i],
              label: tierLabel(t),
              values: d.perTier[t],
            })),
            y: {
              type: 'linear',
              kind: 'number',
              label: `Drops per ${fmtDurationShort(d.size)} (mean per run)`,
            },
            xLabel: 'play time',
            notes: cats.map((_, b) => [
              `${fmtDuration(b * d.size)} – ${fmtDuration((b + 1) * d.size)}`,
            ]),
            emptyText: 'No drops',
          }),
        ) +
        `<h3>Drops so far</h3>` +
        ctx.plot(
          stackedArea({
            title: `Cumulative drops by tier, ${v.label}`,
            x: { type: 'linear', kind: 'time', label: 'play time' },
            y: { type: 'linear', kind: 'number', label: 'Drops (median per run)' },
            xs: cum[0].map((p) => p.x),
            layers: TIERS.map((t, i) => ({
              ...tierStyles[i],
              label: tierLabel(t),
              values: cum[i].map((p) => p.mid),
            })),
            emptyText: 'No drops',
          }),
        ),
      { variant: v.id },
    );
  });
  c6 += details(
    table(
      ['Variant', ...TIERS.map(tierLabel), 'All'],
      variants.map((v) => {
        const per = TIERS.map((t) => finalOf(v, (s) => s.drops?.[t] ?? 0));
        return [v.label, ...per.map(fmtNum), fmtNum(per.reduce((a, b) => a + b, 0))];
      }),
    ),
    'Table view (median drops per run, whole run)',
  );
  const s6 = card(
    'drops',
    '6. Item drops by tier',
    'Drops in each slice of play time (mean per run), C → S+ from light to dark, and the running total.',
    c6,
  );

  // ---- 7. Where time goes -------------------------------------------------------
  let c7 = '';
  const perStage = variants.map(timePerStage);
  variants.forEach((v, i) => {
    const rows = perStage[i];
    c7 +=
      `<h3>${esc(v.label)}</h3>` +
      ctx.plot(
        stackedBars({
          title: `Seconds spent per stage, ${v.label}`,
          size: { width: 720, height: 170 },
          categories: rows.map((r) => fmtStage(r.level)),
          showLabel: (j) => stageLabelShown(rows[j].level, rows.length),
          layers: [{ ...styles[i], label: 'time on stage', values: rows.map((r) => r.seconds) }],
          y: {
            type: 'linear',
            kind: 'time',
            label: 'Time from first reaching a stage to the next',
          },
          xLabel: 'stage',
          notes: rows.map((r) => [
            `${fmtDuration(r.seconds)}  on stage`,
            `${fmtNum(r.deaths)}  deaths (median)`,
          ]),
          emptyText: 'Never got past the first stage',
        }),
      );
  });
  const maxStage = Math.max(0, ...perStage.flatMap((rows) => rows.map((r) => r.level)));
  const stageRows: (string | number)[][] = [];
  for (let l = 1; l <= maxStage; l++) {
    stageRows.push([
      fmtStage(l),
      ...perStage.map((rows) => {
        const r = rows.find((x) => x.level === l);
        return r ? `${fmtDuration(r.seconds)} · ${fmtNum(r.deaths)} deaths` : '–';
      }),
    ]);
  }
  c7 += details(table(['Stage', ...variants.map((v) => v.label)], stageRows));
  const s7 = card(
    'time-per-stage',
    '7. Where time goes',
    'Median time between first reaching a stage and first reaching the next one. Tall bars are walls. Deaths per stage are in the tooltip and the table.',
    c7,
  );

  // ---- 8. Time between purchases ----------------------------------------------
  let c8 = legendHtml(
    PURCHASE_GROUPS.map((g, i) => ({ ...categorical(i), label: g, mark: 'dot' })),
  );
  const gapsByVariant = variants.map(purchaseGaps);
  variants.forEach((v, vi) => {
    for (const clock of ['play'] as Clock[]) {
      for (const xs of scales) {
        const runBySeed = new Map(v.runs.map((r) => [r.seed, r]));
        c8 += ctx.plot(
          scatter({
            title: `Time to the next purchase, ${v.label}`,
            x: { type: xs, kind: 'time', label: timeLabel(clock) },
            y: { type: 'log', kind: 'time', label: 'Wait until the next purchase' },
            groups: PURCHASE_GROUPS.map((g, gi) => ({
              ...categorical(gi),
              label: g,
              points: gapsByVariant[vi]
                .filter((p) => purchaseGroup(p.kind) === g)
                .map((p) => {
                  const run = runBySeed.get(p.seed);
                  const t = clock === 'wall' && run ? wallOf(run, p.t) : p.t;
                  const what = [p.kind, p.target].filter(Boolean).join(' ');
                  const lv = p.levelTo !== undefined ? ` ${p.levelFrom ?? '?'}→${p.levelTo}` : '';
                  return {
                    x: t,
                    y: p.gap,
                    tip: [
                      `${fmtDuration(t)} · seed ${p.seed}`,
                      `${fmtDuration(p.gap)}  until the next purchase`,
                      `${what}${lv}`,
                      ...(p.cost !== undefined ? [`${fmtNum(p.cost)}  coins`] : []),
                    ],
                  };
                }),
            })),
            emptyText: 'No purchases',
          }),
          { variant: v.id, xscale: xs },
        );
      }
    }
  });
  c8 += details(
    table(
      ['Variant', 'Group', 'Purchases', 'Median wait', 'p90 wait', 'Longest wait'],
      variants.flatMap((v, vi) =>
        PURCHASE_GROUPS.map((g) => {
          const gs = gapsByVariant[vi].filter((p) => purchaseGroup(p.kind) === g).map((p) => p.gap);
          return [
            v.label,
            g,
            gs.length,
            gs.length ? fmtDuration(quantile(gs, 0.5)) : '–',
            gs.length ? fmtDuration(quantile(gs, 0.9)) : '–',
            gs.length ? fmtDuration(Math.max(...gs)) : '–',
          ];
        }),
      ),
    ),
  );
  const s8 = card(
    'purchases',
    '8. Time between purchases',
    'One dot per purchase: how long until the next one (log scale). Long waits are where pacing stalls. Weapon = buys and upgrades; Other = companions, ascend and the rest.',
    c8,
  );

  // ---- 9. Best ascend moment ---------------------------------------------------
  const ak = ascendSweepKey(input);
  let c9: string;
  if (!ak) {
    c9 = `<p class="sub">This scenario does not sweep the ascend threshold. Run a scenario with a <code>bot.ascend.atLevel</code> sweep to see this chart.</p>`;
  } else {
    const pts = variants
      .filter((v) => typeof v.params?.[ak] === 'number')
      .map((v) => {
        const ends = v.runs.map((r) => lastSample(r)?.best ?? NaN);
        return {
          x: v.params![ak] as number,
          lo: quantile(ends, 0.1),
          mid: quantile(ends, 0.5),
          hi: quantile(ends, 0.9),
        };
      })
      .filter((p) => Number.isFinite(p.mid))
      .sort((a, b) => a.x - b.x);
    const peak = pts.reduce<(typeof pts)[number] | undefined>(
      (best, p) => (!best || p.mid > best.mid ? p : best),
      undefined,
    );
    c9 =
      ctx.plot(
        lineChart({
          title: 'Best stage at the end against the ascend threshold',
          x: { type: 'linear', kind: 'stage', label: 'Ascend at stage' },
          y: { type: 'linear', kind: 'stage', label: `Best stage after ${fmtDuration(duration)}` },
          series: [
            {
              ...categorical(0),
              label: 'Best stage (median)',
              points: pts.map((p) => ({ x: p.x, y: p.mid })),
              band: pts.map((p) => ({ x: p.x, lo: p.lo, hi: p.hi })),
            },
          ],
          markers: peak
            ? [{ x: peak.x, y: peak.mid, label: `peak: ascend at ${fmtStage(peak.x)}` }]
            : [],
          hoverFormat: fmtStage,
        }),
      ) +
      details(
        table(
          ['Ascend at', 'Best stage (median)', 'p10', 'p90'],
          pts.map((p) => [fmtStage(p.x), fmtStage(p.mid), fmtStage(p.lo), fmtStage(p.hi)]),
        ),
      );
  }
  const s9 = card(
    'ascend-moment',
    '9. Best ascend moment',
    `Where to ascend: the best stage after ${fmtDuration(duration)} for each ascend threshold (median, p10–p90). The peak is the best moment.`,
    c9,
  );

  header += filters;
  const body = [
    `<section aria-label="Key numbers">${kpis}</section>`,
    `<div style="height:16px"></div>`,
    s1,
    s2,
    s3,
    s4,
    s5,
    s6,
    s7,
    s8,
    s9,
  ].join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(`Sim report: ${sc.name}`)}</title>
<style>${pageCss()}</style>
</head>
<body>
<div class="viz-root"><div class="wrap">
${header}
${body}
</div></div>
<div id="tip" role="tooltip" hidden></div>
<template id="key-tpl"><svg viewBox="0 0 16 8" aria-hidden="true"><line x1="1" x2="15" y1="4" y2="4" style="stroke-width:2"/></svg></template>
<script type="application/json" id="hover-data">${jsonForScript(ctx.hover)}</script>
<script type="application/json" id="sim-data">${jsonForScript(slimInput(input))}</script>
<script>${PAGE_JS}</script>
</body>
</html>
`;
}

/** JSON safe inside a `<script>` element (no `</script>`, no `<!--`). */
export function jsonForScript(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * The embedded copy of the input: every run cut to ≤ 150 samples and ≤ 500
 * purchases, so a big sweep doesn't make a huge page. The full data stays in
 * the results JSON next to the report.
 */
function slimInput(input: ReportInput): ReportInput {
  const thin = <T>(xs: T[], max: number) => {
    const k = Math.ceil(xs.length / max);
    return k <= 1 ? xs : xs.filter((_, i) => i % k === 0 || i === xs.length - 1);
  };
  return {
    scenario: input.scenario,
    variants: input.variants.map((v) => ({
      ...v,
      runs: v.runs.map((r) => ({
        ...r,
        samples: thin(r.samples, 150),
        ...(r.purchases ? { purchases: thin(r.purchases, 500) } : {}),
      })),
    })),
  };
}
