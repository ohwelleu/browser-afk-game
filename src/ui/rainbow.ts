/**
 * Rainbow: an animated special colour for S-tier things. It cycles through
 * the accent hues (red, orange, yellow, green, blue, purple, pink) and wraps
 * back to red.
 *
 * Not a theme colour: the stops are fixed in light and dark mode. They are
 * the accent hues, nudged so every stop keeps at least 3:1 contrast on both
 * backgrounds (`#ece9e2` and `#1f1f1f`); the plain palette yellow, for one,
 * is too pale on the light background. `rainbow.test.ts` checks this.
 *
 * Three ways to use it:
 * - `RAINBOW_STYLES` + the `rainbow` / `rainbow-frame` classes: smooth, pure
 *   CSS, no JS per frame, and still under `prefers-reduced-motion`.
 * - `rainbowColor(t)`: smooth colour for JS-drawn text.
 * - `rainbowStep(t)`: whole palette colours that jump from one to the next,
 *   for pixel art and canvas.
 */

/** Red, orange, yellow, green, blue, purple, pink: one hue per accent, in order. */
export const RAINBOW_STOPS = [
  '#e11d1d',
  '#d95a00',
  '#a67c00',
  '#1a8f45',
  '#2f6fe0',
  '#8b4ff0',
  '#d6307f',
] as const;

/** One full cycle, in milliseconds. */
export const RAINBOW_PERIOD_MS = 6000;

/** Where `t` is in the cycle, `0 <= phase < 1`. Handles negative and non-finite input. */
export function rainbowPhase(t: number, periodMs: number = RAINBOW_PERIOD_MS): number {
  if (!Number.isFinite(t) || !Number.isFinite(periodMs) || periodMs <= 0) return 0;
  const p = (t / periodMs) % 1;
  return p < 0 ? p + 1 : p;
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
const channels = (color: string): [number, number, number] => {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Smooth rainbow colour (`#rrggbb`) at time `t` ms: blends between neighbouring stops. */
export function rainbowColor(t: number, periodMs: number = RAINBOW_PERIOD_MS): string {
  const n = RAINBOW_STOPS.length;
  const pos = rainbowPhase(t, periodMs) * n;
  const i = Math.min(Math.floor(pos), n - 1);
  const k = pos - i;
  const a = channels(RAINBOW_STOPS[i]);
  const b = channels(RAINBOW_STOPS[(i + 1) % n]);
  return `#${a.map((v, c) => hex(v + (b[c] - v) * k)).join('')}`;
}

/** Stepped rainbow colour at time `t` ms: one stop at a time, no blending. */
export function rainbowStep(t: number, periodMs: number = RAINBOW_PERIOD_MS): string {
  const n = RAINBOW_STOPS.length;
  return RAINBOW_STOPS[Math.min(Math.floor(rainbowPhase(t, periodMs) * n + 1e-9), n - 1)];
}

/**
 * Smooth CSS rainbow. Add it to a stylesheet, then put `rainbow` on text, or
 * `rainbow-frame` on a box for a border and glow in the same colour. The cycle
 * length is `--afk-rainbow-period` (default 6s). With `prefers-reduced-motion`
 * it stops on the first stop.
 */
export const RAINBOW_STYLES = `
@keyframes afk-rainbow {
${[...RAINBOW_STOPS, RAINBOW_STOPS[0]]
  .map((c, i) => `  ${Math.round((i / RAINBOW_STOPS.length) * 10000) / 100}% { color: ${c}; }`)
  .join('\n')}
}
.rainbow, .rainbow-frame {
  color: ${RAINBOW_STOPS[0]};
  animation: afk-rainbow var(--afk-rainbow-period, ${RAINBOW_PERIOD_MS / 1000}s) linear infinite;
}
.rainbow-frame { border: 3px solid currentColor; box-shadow: 0 0 6px 1px currentColor; }
@media (prefers-reduced-motion: reduce) {
  .rainbow, .rainbow-frame { animation: none; }
}
`;
