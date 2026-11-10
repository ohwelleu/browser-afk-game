import { reducedCss } from '../motion';

/**
 * Rainbow: a flowing gradient for S-tier things. One big radial gradient with
 * a rainbow of stops, drawn twice as large as the box, whose position drifts
 * around the box corners, so blobs of colour slowly flow across the surface.
 *
 * Not a theme colour: it is fixed in light and dark mode. The stops are the
 * same lightness, so no band is much darker or brighter than the others.
 *
 * Ways to use it (all pure CSS, one keyframes animation, no JS per frame, and
 * a still gradient when the Animations setting is Reduced, see `motion.ts`):
 * - `rainbow-frame`: a hollow animated border on a box. Put a child inside.
 *   Add `rainbow-glow` for a soft glow in the same colours.
 * - `rainbow-fill`: the gradient as the background (bars, chips).
 * - `rainbow`: the gradient inside the letters (text, damage numbers), with a
 *   dark outline so yellow stays readable on the light theme.
 * For JS-drawn pixels and canvas: `rainbowColor(t)` (smooth) and
 * `rainbowStep(t)` (whole stops that jump), both on the same stop list.
 */

/** Hues of the gradient stops, in order. 360 is red again, so the loop closes. */
export const RAINBOW_HUES = [0, 30, 45, 60, 70, 90, 120, 180, 200, 240, 270, 300, 360] as const;

/** Lightness of every stop, in percent (saturation is always 100 %). */
export const RAINBOW_LIGHTNESS = 75;

/** One full flow around the box, in milliseconds. */
export const RAINBOW_PERIOD_MS = 4000;

/** Frame thickness, in px. */
export const RAINBOW_BORDER_PX = 3;

/** CSS colour for one stop. */
export const rainbowHsl = (hue: number, lightness: number | string = RAINBOW_LIGHTNESS): string =>
  `hsl(${hue}, 100%, ${typeof lightness === 'number' ? `${lightness}%` : lightness})`;

/** All stops as CSS colours (hue 360 included, the same red as the first). */
export const RAINBOW_STOPS: readonly string[] = RAINBOW_HUES.map((h) => rainbowHsl(h));

/** The colours a cycle steps through: every stop once (the closing 360 would repeat red). */
const CYCLE_HUES = RAINBOW_HUES.slice(0, -1);

/** The CSS `radial-gradient(...)` over all stops. `lightness` can be a `var(...)`. */
export function rainbowGradient(lightness: number | string = RAINBOW_LIGHTNESS): string {
  return `radial-gradient(circle, ${RAINBOW_HUES.map((h) => rainbowHsl(h, lightness)).join(', ')})`;
}

/** Where `t` is in the cycle, `0 <= phase < 1`. Handles negative and non-finite input. */
export function rainbowPhase(t: number, periodMs: number = RAINBOW_PERIOD_MS): number {
  if (!Number.isFinite(t) || !Number.isFinite(periodMs) || periodMs <= 0) return 0;
  const p = (t / periodMs) % 1;
  return p < 0 ? p + 1 : p;
}

/** Smooth rainbow colour at time `t` ms: the hue slides from stop to stop and wraps. */
export function rainbowColor(
  t: number,
  periodMs: number = RAINBOW_PERIOD_MS,
  lightness: number = RAINBOW_LIGHTNESS,
): string {
  const n = CYCLE_HUES.length;
  const pos = rainbowPhase(t, periodMs) * n;
  const i = Math.min(Math.floor(pos), n - 1);
  const hue = RAINBOW_HUES[i] + (RAINBOW_HUES[i + 1] - RAINBOW_HUES[i]) * (pos - i);
  return rainbowHsl(Math.round(hue * 10) / 10, lightness);
}

/** Stepped rainbow colour at time `t` ms: one stop at a time, no blending. For pixel art. */
export function rainbowStep(
  t: number,
  periodMs: number = RAINBOW_PERIOD_MS,
  lightness: number = RAINBOW_LIGHTNESS,
): string {
  const n = CYCLE_HUES.length;
  const i = Math.min(Math.floor(rainbowPhase(t, periodMs) * n + 1e-9), n - 1);
  return rainbowHsl(CYCLE_HUES[i], lightness);
}

/** Gold flow (S tier): palette orange and yellow, alternating, so the bands flow like the rainbow's. */
export const GOLD_STOP_VARS = ['--_orange', '--_yellow'] as const;
/** Bands in the gold gradient (more bands = more visible flow on small boxes). */
const GOLD_BANDS = 7;

/** The CSS gold `radial-gradient(...)`: orange, yellow, orange, … from the palette variables. */
export function goldGradient(): string {
  const stops = Array.from({ length: GOLD_BANDS }, (_, i) => `var(${GOLD_STOP_VARS[i % 2]})`);
  return `radial-gradient(circle, ${stops.join(', ')})`;
}

/**
 * The flowing gradient as CSS. Add it to a stylesheet. Settings (inherited, so
 * set them on the box or a parent): `--afk-rainbow-period` (default 4s) and
 * `--afk-rainbow-l` (stop lightness, default 75%), `--afk-rainbow-ink` (outline
 * colour of `rainbow` text, default `#1f1f1f`). `rainbow-outline` gives the same
 * outline to other rainbow-coloured text, such as JS-drawn `rainbowColor(t)`.
 * Add `gold` next to any of the classes (`rainbow-frame gold`, `rainbow gold`)
 * for the S-tier gold flow: same animation and period, only the colours change.
 */
export const RAINBOW_STYLES = `
@keyframes afk-rainbow-flow {
  0% { background-position: 0% 0%; }
  25% { background-position: 100% 0%; }
  50% { background-position: 100% 100%; }
  75% { background-position: 0% 100%; }
  100% { background-position: 0% 0%; }
}
.rainbow, .rainbow-fill, .rainbow-frame::before, .rainbow-glow::after {
  --afk-rainbow-gradient: ${rainbowGradient('var(--afk-rainbow-l, ' + RAINBOW_LIGHTNESS + '%)')};
  background-image: var(--afk-rainbow-gradient);
  background-size: 200% 200%;
  animation: afk-rainbow-flow var(--afk-rainbow-period, ${RAINBOW_PERIOD_MS / 1000}s) ease-in-out infinite;
}
/* Gold: same flow, palette orange ↔ yellow. Only the gradient changes. */
.gold.rainbow, .gold.rainbow-fill, .gold.rainbow-frame::before {
  --afk-rainbow-gradient: ${goldGradient()};
}
/* Thin dark outline so pale stops (yellow) stay readable on the light theme. Fixed, like the rainbow. */
.rainbow, .rainbow-outline {
  filter: drop-shadow(1px 0 0 var(--afk-rainbow-ink, #1f1f1f)) drop-shadow(-1px 0 0 var(--afk-rainbow-ink, #1f1f1f)) drop-shadow(0 1px 0 var(--afk-rainbow-ink, #1f1f1f)) drop-shadow(0 -1px 0 var(--afk-rainbow-ink, #1f1f1f));
}
.rainbow {
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
}
.rainbow-frame {
  position: relative;
  border: ${RAINBOW_BORDER_PX}px solid transparent;
  box-shadow: 0 0 0 1px var(--_fg, #000);
}
.rainbow-frame::before, .rainbow-glow::after {
  content: '';
  position: absolute;
  inset: -${RAINBOW_BORDER_PX}px;
  pointer-events: none;
}
/* Hollow: the gradient shows only in the padding ring (content box cut out). */
.rainbow-frame::before, .rainbow-glow::after {
  padding: ${RAINBOW_BORDER_PX}px;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
}
.rainbow-glow { isolation: isolate; }
.rainbow-glow::after {
  inset: -${RAINBOW_BORDER_PX * 2}px;
  padding: ${RAINBOW_BORDER_PX * 2}px;
  z-index: -1;
  filter: blur(4px);
}
/* Animations setting = Reduced (class on the game box, see motion.ts). */
${reducedCss('.rainbow, .rainbow-fill, .rainbow-frame::before, .rainbow-glow::after')} {
  animation: none;
  background-position: 50% 50%;
}
`;
