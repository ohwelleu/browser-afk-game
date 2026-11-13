/**
 * Colour tokens for the sim charts: the validated dataviz reference palette,
 * light and dark, as CSS custom properties on `.viz-root`. SVG marks only ever
 * say `var(--s1)`, so one stylesheet switches both themes.
 *
 * Validated with the dataviz skill's `validate_palette.js` (results in the PR
 * that added this file):
 * - categorical, 8 slots, adjacent pairs: pass in light and dark;
 * - categorical, first 3 slots, all pairs (scatter): pass in both modes;
 * - sequential ordinal ramp, 5 steps: pass in both modes. More than 5 steps
 *   fail the adjacent-lightness check, so a numeric sweep with more than 5
 *   values uses the categorical slots instead.
 */

export const CATEGORICAL_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];
export const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
];
/** Ordinal blue ramp, low → high value (light: light → dark; dark: dark → light). */
export const SEQUENTIAL_LIGHT = ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#0d366b'];
export const SEQUENTIAL_DARK = ['#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6'];

/** Max series with their own colour; the rest are drawn grey as "other". */
export const MAX_SERIES = CATEGORICAL_LIGHT.length;
/** Max points for a scatter with colour per group (all-pairs validated). */
export const MAX_SCATTER_GROUPS = 3;

/** Dash per categorical slot, so identity never rests on colour alone. */
export const DASHES = ['', '6 3', '2 3', '8 3 2 3', '12 4', '4 2 1 2', '1 2', '10 2 2 2 2 2'];

export interface SeriesStyle {
  /** CSS colour expression, e.g. `var(--s1)`. */
  color: string;
  /** SVG `stroke-dasharray`, '' for solid. */
  dash: string;
}

/** Categorical slot i (0-based), fixed order. Past slot 8: grey, solid. */
export function categorical(i: number): SeriesStyle {
  if (i >= MAX_SERIES) return { color: 'var(--other)', dash: '' };
  return { color: `var(--s${i + 1})`, dash: DASHES[i] };
}

/** `n` evenly spread steps of the 5-step ramp (n ≤ 5), low → high. */
export function sequentialSteps(n: number): number[] {
  const len = SEQUENTIAL_LIGHT.length;
  if (n <= 1) return [Math.floor(len / 2)];
  return Array.from({ length: Math.min(n, len) }, (_, i) =>
    Math.round((i * (len - 1)) / (Math.min(n, len) - 1)),
  );
}

export function sequential(step: number, dashIndex = 0): SeriesStyle {
  return { color: `var(--q${step + 1})`, dash: DASHES[dashIndex] ?? '' };
}

const LIGHT_TOKENS: Record<string, string> = {
  surface: '#fcfcfb',
  page: '#f9f9f7',
  'ink-1': '#0b0b0b',
  'ink-2': '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  border: 'rgba(11,11,11,0.10)',
  other: '#c3c2b7',
  good: '#006300',
  critical: '#d03b3b',
};
const DARK_TOKENS: Record<string, string> = {
  surface: '#1a1a19',
  page: '#0d0d0d',
  'ink-1': '#f0efec',
  'ink-2': '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  border: 'rgba(255,255,255,0.10)',
  other: '#52514e',
  good: '#0ca30c',
  critical: '#e66767',
};

function tokenBlock(tokens: Record<string, string>, cat: string[], seq: string[]): string {
  const lines = Object.entries(tokens).map(([k, v]) => `--${k}: ${v};`);
  cat.forEach((c, i) => lines.push(`--s${i + 1}: ${c};`));
  seq.forEach((c, i) => lines.push(`--q${i + 1}: ${c};`));
  return lines.map((l) => `  ${l}`).join('\n');
}

/**
 * Theme CSS. Light by default; dark from the OS setting unless the page says
 * `data-theme="light"`, and always dark with `data-theme="dark"`.
 */
export function themeCss(): string {
  const light = tokenBlock(LIGHT_TOKENS, CATEGORICAL_LIGHT, SEQUENTIAL_LIGHT);
  const dark = tokenBlock(DARK_TOKENS, CATEGORICAL_DARK, SEQUENTIAL_DARK);
  return [
    `.viz-root {\n  color-scheme: light;\n${light}\n}`,
    `@media (prefers-color-scheme: dark) {\n:root:where(:not([data-theme="light"])) .viz-root {\n  color-scheme: dark;\n${dark}\n}\n}`,
    `:root[data-theme="dark"] .viz-root {\n  color-scheme: dark;\n${dark}\n}`,
  ].join('\n');
}
