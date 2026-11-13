import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATEGORICAL_DARK,
  CATEGORICAL_LIGHT,
  SEQUENTIAL_DARK,
  SEQUENTIAL_LIGHT,
} from './chart/palette';
import type { ReportInput } from './chart/data';
import { buildReport, jsonForScript, variantStyles } from './report-html';

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`./chart/fixtures/${name}.json`, import.meta.url), 'utf8'),
  ) as ReportInput;

const small = fixture('small');
/** The page without its script and style (the page script says `undefined` on purpose). */
const markup = (page: string) =>
  page.replace(/<script>[\s\S]*?<\/script>|<style>[\s\S]*?<\/style>/g, '');
const html = buildReport(small);

describe('report.html', () => {
  it('is self-contained: no network resource of any kind', () => {
    for (const name of ['small', 'bots', 'ascend-sweep', 'grid-sweep']) {
      const page = name === 'small' ? html : buildReport(fixture(name));
      expect(page).not.toMatch(/https?:\/\//);
      expect(page).not.toMatch(/\s(src|href)\s*=/i);
      expect(page).not.toMatch(/<link\b|@import|url\(/i);
      expect(page).not.toMatch(/\bfetch\(|XMLHttpRequest|import\(/);
    }
  });

  it('has every chart from the design (1–10)', () => {
    for (const id of [
      'progress',
      'time-to-stage',
      'power',
      'economy',
      'ascends',
      'drops',
      'time-per-stage',
      'purchases',
      'ascend-moment',
    ]) {
      expect(html).toContain(`<section class="card" id="${id}">`);
    }
    expect(html).toContain('class="kpis"');
    expect(html).toContain('Time to World 10 (median)');
  });

  it('carries both themes as CSS custom properties', () => {
    expect(html).toContain('.viz-root {');
    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain(':root[data-theme="dark"] .viz-root');
    for (const hex of [
      ...CATEGORICAL_LIGHT,
      ...CATEGORICAL_DARK,
      ...SEQUENTIAL_LIGHT,
      ...SEQUENTIAL_DARK,
    ]) {
      expect(html).toContain(hex);
    }
    // Marks use the tokens, never raw palette hex.
    const svgs = html.match(/<svg class="viz-svg[\s\S]*?<\/svg>/g)!.join('');
    for (const hex of CATEGORICAL_LIGHT) expect(svgs).not.toContain(hex);
    expect(svgs).toContain('var(--s1)');
  });

  it('escapes labels from the data', () => {
    expect(html).not.toContain('<b>buyer</b>');
    expect(html).toContain('greedy &lt;b&gt;buyer&lt;/b&gt;');
    expect(html).toContain('<h1>small &lt;hand-made&gt; &amp; tiny</h1>');
    const nasty = structuredClone(small);
    nasty.scenario.name = '</script><script>alert(1)</script>';
    nasty.variants[0].label = '<img onerror=alert(1)>';
    const page = buildReport(nasty);
    expect(page).not.toContain('<img onerror');
    expect(page).not.toContain('<script>alert(1)');
    // Exactly the three script elements the page ships with.
    expect(page.match(/<script\b/g)).toHaveLength(3);
  });

  it('embeds data as JSON that cannot close its script element', () => {
    expect(jsonForScript({ a: '</script>' })).toBe('{"a":"\\u003c/script\\u003e"}');
    const data = html.match(
      /<script type="application\/json" id="sim-data">([\s\S]*?)<\/script>/,
    )![1];
    expect(JSON.parse(data).scenario.name).toBe(small.scenario.name);
    const hover = html.match(
      /<script type="application\/json" id="hover-data">([\s\S]*?)<\/script>/,
    )![1];
    expect(Object.keys(JSON.parse(hover)).length).toBeGreaterThan(0);
  });

  it('never prints NaN or undefined', () => {
    for (const name of ['small', 'bots', 'ascend-sweep', 'grid-sweep']) {
      const page = name === 'small' ? html : buildReport(fixture(name));
      expect(markup(page)).not.toMatch(/NaN|undefined/);
    }
  });

  it('is deterministic', () => {
    expect(buildReport(small)).toBe(html);
  });

  it('works with no variants and with runs that have no samples', () => {
    const empty = buildReport({ scenario: { name: 'empty', duration: '10m' }, variants: [] });
    expect(empty).toContain('<h1>empty</h1>');
    expect(markup(empty)).not.toMatch(/NaN|undefined/);
    const hollow = buildReport({
      scenario: { name: 'hollow', duration: 60 },
      variants: [{ id: 'a', label: 'a', runs: [{ seed: 1, samples: [], milestones: [] }] }],
    });
    expect(markup(hollow)).not.toMatch(/NaN|undefined/);
    expect(hollow).toContain('No data');
  });

  it('shows only the default filter choice; the rest is hidden', () => {
    expect(html).toMatch(/data-f-xscale="log"[^>]*data-f-clock="play"(?! hidden)/);
    expect(html).toMatch(/data-f-xscale="linear"[^>]*hidden/);
    expect(html).toMatch(/data-f-variant="greedy"[^>]*hidden/);
  });
});

describe('variant colours', () => {
  it('categorical in listed order', () => {
    expect(variantStyles(small).map((s) => s.color)).toEqual(['var(--s1)', 'var(--s2)']);
  });

  it('sequential, in value order, for one numeric sweep of up to 5 values', () => {
    const sweep = fixture('ascend-sweep');
    expect(variantStyles(sweep).map((s) => s.color)).toEqual([
      'var(--q1)',
      'var(--q2)',
      'var(--q3)',
      'var(--q4)',
      'var(--q5)',
    ]);
    const reversed = { ...sweep, variants: [...sweep.variants].reverse() };
    expect(variantStyles(reversed)[0].color).toBe('var(--q5)');
  });

  it('past 8 series: grey, never a generated hue', () => {
    const grid = fixture('grid-sweep');
    expect(variantStyles(grid)[8].color).toBe('var(--other)');
  });
});

describe('bundle isolation', () => {
  it('nothing outside src/sim imports the simulator', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (path !== join('src', 'sim')) walk(path);
        } else if (
          /\.ts$/.test(name) &&
          /from ['"][^'"]*\/sim\//.test(readFileSync(path, 'utf8'))
        ) {
          offenders.push(path);
        }
      }
    };
    walk('src');
    expect(offenders).toEqual([]);
  });
});
