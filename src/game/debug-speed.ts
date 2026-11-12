/**
 * Debug-only speed knobs (the debugger's "Speed" section). Nothing here is
 * saved and nothing reads it unless the debug panel set it, so with the
 * defaults (×1) the game's numbers are exactly the ones in `balance.ts`.
 */

/** Game clock multipliers offered by the debugger. */
export const GAME_SPEEDS: readonly number[] = [0.5, 1, 2, 5, 10, 20];

/** Mob appear multipliers offered by the debugger; `Infinity` = instant. */
export const MOB_APPEAR_SPEEDS: readonly number[] = [0.25, 0.5, 1, 2, 4, 10, Infinity];

/** `×2`, `×0.25`, `instant`. */
export const speedLabel = (m: number): string => (m === Infinity ? 'instant' : `×${m}`);

/** A usable multiplier: a positive number or `Infinity`; anything else is ×1. */
export const validSpeed = (m: number): number => (m > 0 ? m : 1);

/**
 * Seconds a mob takes to appear at `speed`× (the intro and gap timings):
 * ×2 halves them, ×0.5 doubles them, instant is 0.
 */
export function scaleAppear(seconds: number, speed: number): number {
  const m = validSpeed(speed);
  return m === Infinity ? 0 : seconds / m;
}

let mobAppear = 1;

/** Current mob appear multiplier (×1 unless the debugger changed it). */
export const mobAppearSpeed = (): number => mobAppear;

/** Set by the debugger; `1` restores the real timings. */
export function setMobAppearSpeed(m: number): void {
  mobAppear = validSpeed(m);
}
