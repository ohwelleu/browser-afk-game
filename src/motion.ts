/**
 * The Animations setting: `on` (default) plays every animation, even when the
 * system asks for reduced motion; `reduced` keeps the rainbow, the item rain,
 * the sparkles and the pulses still. The game decides, not the OS media query:
 * the canvas code reads `reduced()`, the CSS reads `MOTION_REDUCED_CLASS` on the
 * game box. One per game instance (a page can hold several games).
 */

export const MOTION_SETTINGS = ['on', 'reduced'] as const;
export type MotionSetting = (typeof MOTION_SETTINGS)[number];
export const MOTION_DEFAULT: MotionSetting = 'on';

/** Class on the game box while animations are reduced. The CSS keys off this, not `prefers-reduced-motion`. */
export const MOTION_REDUCED_CLASS = 'motion-reduced';

export const isMotionSetting = (v: unknown): v is MotionSetting =>
  (MOTION_SETTINGS as readonly unknown[]).includes(v);

/** `.motion-reduced` in front of each selector: `reducedCss('.a, .b::before')` → `.motion-reduced .a, .motion-reduced .b::before`. */
export const reducedCss = (selectors: string): string =>
  selectors
    .split(',')
    .map((s) => `.${MOTION_REDUCED_CLASS} ${s.trim()}`)
    .join(', ');

export type Motion = {
  get(): MotionSetting;
  set(m: MotionSetting): void;
  /** True when animations should stand still. */
  reduced(): boolean;
};

/** Holds the setting and mirrors it as `MOTION_REDUCED_CLASS` on `box`. */
export function createMotion(box: Pick<HTMLElement, 'classList'>, initial: unknown): Motion {
  let current: MotionSetting = isMotionSetting(initial) ? initial : MOTION_DEFAULT;
  const sync = () => box.classList.toggle(MOTION_REDUCED_CLASS, current === 'reduced');
  sync();
  return {
    get: () => current,
    set(m) {
      current = m;
      sync();
    },
    reduced: () => current === 'reduced',
  };
}
