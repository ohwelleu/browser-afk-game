/**
 * Item rain: the background effect for equipped S and S+ items. Pure: this only
 * counts how many lines of each colour the scene shows (render/rain.ts moves
 * and draws them). Every item gives `RAIN_LINES_PER_ITEM` lines.
 */
import { ITEM_SLOTS } from './balance';
import type { GameState } from './state';

/** Falling lines per equipped S or S+ item. */
export const RAIN_LINES_PER_ITEM = 5;

/** Most lines on screen at once, all colours together: every slot S or S+. */
export const RAIN_MAX_LINES = RAIN_LINES_PER_ITEM * ITEM_SLOTS.length;

/** How many falling lines of each colour. */
export type RainCounts = {
  /** `RAIN_LINES_PER_ITEM` per equipped S+ item (tier `SS`): rainbow coloured. */
  rainbow: number;
  /** `RAIN_LINES_PER_ITEM` per equipped S item: gold (palette orange ↔ yellow). */
  yellow: number;
};

const whole = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);

/** Clamps line counts to whole numbers and to `RAIN_MAX_LINES` in total; rainbow lines win the room. */
export function capRain(rainbow: number, yellow: number): RainCounts {
  const r = Math.min(whole(rainbow), RAIN_MAX_LINES);
  return { rainbow: r, yellow: Math.min(whole(yellow), RAIN_MAX_LINES - r) };
}

/** Lines for a number of S+ and S items: `RAIN_LINES_PER_ITEM` each, capped. */
export function rainForItems(sPlusItems: number, sItems: number): RainCounts {
  return capRain(whole(sPlusItems) * RAIN_LINES_PER_ITEM, whole(sItems) * RAIN_LINES_PER_ITEM);
}

/** Lines for the items the hero wears: 5 rainbow per equipped S+ item, 5 gold per S item. */
export function rainLines(s: Pick<GameState, 'items'>): RainCounts {
  let sPlus = 0;
  let s1 = 0;
  for (const slot of ITEM_SLOTS) {
    const tier = s.items[slot]?.tier;
    if (tier === 'SS') sPlus++;
    else if (tier === 'S') s1++;
  }
  return rainForItems(sPlus, s1);
}
