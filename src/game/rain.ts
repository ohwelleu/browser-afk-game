/**
 * Item rain: the background effect for equipped S and S+ items. Pure: this only
 * counts how many lines of each colour the scene shows (render/rain.ts moves
 * and draws them).
 */
import { ITEM_SLOTS } from './balance';
import type { GameState } from './state';

/** Most lines on screen at once, all colours together. */
export const RAIN_MAX_LINES = 12;

/** How many falling lines of each colour. */
export type RainCounts = {
  /** One per equipped S+ item (tier `SS`): rainbow coloured. */
  rainbow: number;
  /** One per equipped S item: yellow. */
  yellow: number;
};

const whole = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** Clamps counts to whole numbers and to `RAIN_MAX_LINES` in total; rainbow lines win the room. */
export function capRain(rainbow: number, yellow: number): RainCounts {
  const r = Math.min(whole(rainbow), RAIN_MAX_LINES);
  return { rainbow: r, yellow: Math.min(whole(yellow), RAIN_MAX_LINES - r) };
}

/** Lines for the items the hero wears: one per equipped S+ item (rainbow) and S item (yellow). */
export function rainLines(s: Pick<GameState, 'items'>): RainCounts {
  let rainbow = 0;
  let yellow = 0;
  for (const slot of ITEM_SLOTS) {
    const tier = s.items[slot]?.tier;
    if (tier === 'SS') rainbow++;
    else if (tier === 'S') yellow++;
  }
  return capRain(rainbow, yellow);
}
