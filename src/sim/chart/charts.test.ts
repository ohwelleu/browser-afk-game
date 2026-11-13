/**
 * SVG snapshots for every chart on tiny hand-made data, plus the edge cases
 * (empty, single point). The snapshots are real `.svg` files in
 * `__snapshots__/` (with an xmlns added so they open on their own; colours
 * come from the report's CSS, so standalone they show shapes only).
 */
import { describe, expect, it } from 'vitest';
import { stackedArea } from './area';
import { dotRange, stackedBars } from './bar';
import { fmtDurationShort } from './format';
import { heatmap } from './heatmap';
import { lineChart } from './line';
import { categorical, sequential } from './palette';
import { scatter } from './scatter';
import { legendHtml, type ChartOut } from './svg';

const file = (svg: string) =>
  `${svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')}\n`;

function check(out: ChartOut) {
  expect(out.svg).not.toMatch(/NaN|Infinity|undefined/);
  expect(out.svg.startsWith('<svg ')).toBe(true);
  expect(out.svg.endsWith('</svg>')).toBe(true);
  return out;
}

const progress = [
  {
    ...categorical(0),
    label: 'idle',
    step: true,
    points: [
      { x: 10, y: 1 },
      { x: 60, y: 2 },
      { x: 600, y: 4 },
      { x: 3600, y: 5 },
    ],
    band: [
      { x: 10, lo: 1, hi: 1 },
      { x: 60, lo: 1, hi: 3 },
      { x: 600, lo: 3, hi: 5 },
      { x: 3600, lo: 4, hi: 6 },
    ],
  },
  {
    ...categorical(1),
    label: 'greedy',
    step: true,
    points: [
      { x: 10, y: 1 },
      { x: 60, y: 3 },
      { x: 600, y: 8 },
      { x: 3600, y: 14 },
    ],
  },
];

describe('line chart', () => {
  it('two step series with a band and end labels', async () => {
    const out = check(
      lineChart({
        title: 'Progress',
        x: { type: 'log', kind: 'time', label: 'play time' },
        y: { type: 'linear', kind: 'stage', label: 'Best stage' },
        series: progress,
        endLabels: true,
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/line-progress.svg');
    expect(out.svg).toContain('class="band"');
    expect(out.svg).toContain('stroke-dasharray="6 3"');
    expect(out.svg).toContain('>greedy</text>');
    expect(out.hover).toMatchObject({ labels: ['10s', '1m', '10m', '1h'] });
  });

  it('a log y axis with a marked peak, and a linear x axis', async () => {
    const out = check(
      lineChart({
        title: 'Peak',
        x: { type: 'linear', kind: 'number', label: 'x' },
        y: { type: 'log', kind: 'number', label: 'y' },
        series: [
          {
            ...categorical(0),
            label: 'one',
            points: [1, 2, 3, 4, 5].map((x) => ({ x, y: 10 ** (3 - Math.abs(3 - x)) })),
          },
        ],
        markers: [{ x: 3, y: 1000, label: 'peak' }],
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/line-peak.svg');
  });

  it('drops end labels when they would collide', () => {
    const out = lineChart({
      title: 't',
      x: { type: 'linear', kind: 'number' },
      y: { type: 'linear', kind: 'number' },
      series: [
        {
          ...categorical(0),
          label: 'a',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 50 },
          ],
        },
        {
          ...categorical(1),
          label: 'b',
          points: [
            { x: 0, y: 0 },
            { x: 1, y: 50.5 },
          ],
        },
      ],
      endLabels: true,
    });
    expect(out.svg).not.toContain('>a</text>');
    expect(out.svg).not.toContain('>b</text>');
  });

  it('never repeats a tick label on a very narrow axis', () => {
    const out = lineChart({
      title: 't',
      x: { type: 'linear', kind: 'number' },
      y: { type: 'linear', kind: 'number' },
      series: [
        {
          ...categorical(0),
          label: 'a',
          points: [
            { x: 0, y: 10 },
            { x: 1, y: 10.01 },
          ],
        },
      ],
    });
    const labels = [
      ...out.svg.matchAll(/text-anchor="end" dominant-baseline="middle">([^<]*)</g),
    ].map((m) => m[1]);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('empty: no ticks, a message, no hover', async () => {
    const out = check(
      lineChart({
        title: 'Nothing',
        x: { type: 'log', kind: 'time' },
        y: { type: 'log', kind: 'number' },
        series: [{ ...categorical(0), label: 'a', points: [{ x: 0, y: 0 }] }],
        emptyText: 'No data yet',
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/line-empty.svg');
    expect(out.svg).toContain('No data yet');
    expect(out.svg).not.toContain('class="tick"');
    expect(out.hover).toBeUndefined();
  });

  it('a single point draws a dot on a widened axis', async () => {
    const out = check(
      lineChart({
        title: 'One point',
        x: { type: 'log', kind: 'time' },
        y: { type: 'linear', kind: 'stage' },
        series: [{ ...categorical(0), label: 'a', points: [{ x: 60, y: 7 }] }],
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/line-single.svg');
    expect(out.svg).toContain('<circle class="dot"');
    expect(out.svg.match(/class="tick"/g)!.length).toBeGreaterThanOrEqual(4);
  });
});

describe('stacked area', () => {
  it('stacks layers with a surface gap and hover totals', async () => {
    const out = check(
      stackedArea({
        title: 'Spend',
        x: { type: 'linear', kind: 'time', label: 'play time' },
        y: { type: 'linear', kind: 'number', label: 'Coins' },
        xs: [0, 600, 1200, 1800],
        layers: [
          { ...categorical(2), label: 'Upgrades', values: [0, 100, 400, 900] },
          { ...categorical(3), label: 'Weapons', values: [0, 0, 1200, 1200] },
        ],
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/area-spend.svg');
    expect(out.svg.match(/class="area"/g)).toHaveLength(2);
    const hover = out.hover as { rows: { label: string; values: string[] }[] };
    expect(hover.rows.map((r) => r.label)).toEqual(['Upgrades', 'Weapons', 'Total']);
    expect(hover.rows[2].values).toEqual(['0', '100', '1,600', '2,100']);
  });

  it('empty and single-x inputs', () => {
    const empty = check(
      stackedArea({
        title: 'e',
        x: { type: 'linear', kind: 'time' },
        y: { type: 'linear', kind: 'number' },
        xs: [],
        layers: [],
      }),
    );
    expect(empty.svg).toContain('No data');
    check(
      stackedArea({
        title: 'one',
        x: { type: 'linear', kind: 'time' },
        y: { type: 'linear', kind: 'number' },
        xs: [60],
        layers: [{ ...categorical(0), label: 'a', values: [5] }],
      }),
    );
  });
});

describe('bars', () => {
  it('stacked columns: rounded top segment, tooltips per column', async () => {
    const out = check(
      stackedBars({
        title: 'Drops',
        categories: ['0s', '30m', '1h'],
        layers: [
          { ...sequential(0), label: 'C', values: [3, 5, 2] },
          { ...sequential(2), label: 'A', values: [1, 0, 2] },
          { ...sequential(4), label: 'S+', values: [0, 0, 1] },
        ],
        y: { type: 'linear', kind: 'number', label: 'Drops' },
        xLabel: 'play time',
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/bars-drops.svg');
    expect(out.svg).toContain('data-tip="1h&#10;2  C&#10;2  A&#10;1  S+&#10;5  Total"');
    expect(out.svg.match(/class="mark-hit"/g)).toHaveLength(3);
  });

  it('cuts long category labels instead of hiding them', () => {
    const out = stackedBars({
      title: 't',
      categories: Array.from(
        { length: 4 },
        (_, i) => `a very, very, very long category label ${i}`,
      ),
      layers: [{ ...categorical(0), label: 'x', values: Array(4).fill(1) }],
      y: { type: 'linear', kind: 'number' },
    });
    expect(out.svg).toContain('…</text>');
  });

  it('dot + range with a missing median', async () => {
    const out = check(
      dotRange({
        title: 'Time to World 2',
        items: [
          {
            ...categorical(0),
            label: 'idle',
            mid: NaN,
            lo: 900,
            hi: Infinity,
            note: '1 of 2 never',
          },
          { ...categorical(1), label: 'greedy <b>', mid: 290, lo: 200, hi: 400 },
        ],
        y: { type: 'log', kind: 'time', label: 'Time' },
        hoverFormat: fmtDurationShort,
        missingText: 'not reached',
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/dot-range.svg');
    expect(out.svg).toContain('not reached');
    expect(out.svg).toContain('greedy &lt;b&gt;');
    expect(out.svg).not.toContain('<b>');
  });

  it('empty bars and dots', () => {
    expect(
      check(
        stackedBars({
          title: 'e',
          categories: [],
          layers: [],
          y: { type: 'linear', kind: 'number' },
        }),
      ).svg,
    ).toContain('No data');
    expect(
      check(dotRange({ title: 'e', items: [], y: { type: 'log', kind: 'time' } })).svg,
    ).toContain('No data');
  });
});

describe('scatter', () => {
  it('dots with a nearest-point hover layer', async () => {
    const out = check(
      scatter({
        title: 'Gaps',
        x: { type: 'log', kind: 'time', label: 'play time' },
        y: { type: 'log', kind: 'time', label: 'wait' },
        groups: [
          {
            ...categorical(0),
            label: 'Weapon',
            points: [
              { x: 30, y: 270, tip: ['30s', '4.5m  wait'] },
              { x: 900, y: 1100, tip: ['15m', '18m  wait'] },
            ],
          },
          {
            ...categorical(1),
            label: 'Character',
            points: [{ x: 300, y: 600, tip: ['5m', '10m  wait'] }],
          },
        ],
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/scatter-gaps.svg');
    const hover = out.hover as { pts: number[]; tips: string[][] };
    expect(hover.pts).toHaveLength(6);
    expect(hover.tips[2]).toEqual(['5m', '10m  wait']);
  });

  it('refuses more than three colour groups', () => {
    const g = { ...categorical(0), label: 'g', points: [] };
    expect(() =>
      scatter({
        title: 't',
        x: { type: 'linear', kind: 'number' },
        y: { type: 'linear', kind: 'number' },
        groups: [g, g, g, g],
      }),
    ).toThrow(/at most 3/);
  });
});

describe('heatmap', () => {
  it('cells on the sequential ramp, missing cells empty', async () => {
    const out = check(
      heatmap({
        title: 'Time to World 2',
        xLabels: ['0.005', '0.01'],
        yLabels: ['1.24', '1.28'],
        cells: [
          [600, 900],
          [1800, NaN],
        ],
        format: fmtDurationShort,
        xTitle: 'drop chance',
        yTitle: 'mob HP growth',
        log: true,
        missingText: 'not reached',
      }),
    );
    await expect(file(out.svg)).toMatchFileSnapshot('__snapshots__/heatmap.svg');
    expect(out.svg).toContain('var(--q1)');
    expect(out.svg).toContain('var(--q5)');
    expect(out.svg).toContain('cell-empty');
    expect(out.svg).toContain('not reached');
  });
});

describe('legend', () => {
  it('is absent for one series and lists two or more', () => {
    const a = { ...categorical(1), label: 'a', mark: 'line' as const };
    expect(legendHtml([a])).toBe('');
    const html = legendHtml([a, { ...categorical(1), label: '<b>', mark: 'rect' }]);
    expect(html).toContain('<ul class="legend">');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('stroke-dasharray');
  });
});
