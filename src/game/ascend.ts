/**
 * Ascend (prestige), first version: start over, keep the items. The gate and
 * the price are in `balance.ts` (`ASCEND_GATE`, `ASCEND_COST`). Each ascend
 * gives `ASCEND_SPEED_PER` attack speed (`heroSpeed` in `state.ts`); the
 * `ascends` count is also there for later features (roguelike picks). Pure, like the rest of `game/`: same state object back when not
 * allowed.
 */
import { ASCEND_COST, ASCEND_GATE_LEVEL } from './balance';
import { bestOwnedItem, betterItem } from './items';
import { createState, newProgress, type GameState, type Progress } from './state';

/** True once the highest stage reached in this run is the gate stage (6.1) or higher. */
export const ascendUnlocked = (s: Pick<GameState, 'best'>): boolean => s.best >= ASCEND_GATE_LEVEL;

/** True when the gate is reached and the coins cover the price. */
export const canAscend = (s: Pick<GameState, 'best' | 'coins'>): boolean =>
  ascendUnlocked(s) && s.coins >= ASCEND_COST;

/**
 * The progress after an ascend: a new game, except
 * - items (ring, pendant, bag, drop RNG) stay,
 * - the records stay (best DPS, best stage, best item),
 * - kills and deaths stay (lifetime counters, not progress),
 * - `ascends` goes up by one.
 * Audio settings and the save slot are not part of `Progress`.
 */
export function ascendProgress(p: Progress): Progress {
  return {
    ...newProgress(),
    items: p.items,
    kills: p.kills,
    deaths: p.deaths,
    maxDps: p.maxDps,
    ascends: p.ascends + 1,
    bestStage: Math.max(p.bestStage, p.best),
    bestItem: betterItem(p.bestItem, bestOwnedItem(p.items)),
  };
}

/**
 * Pays the price and starts over (the coins reset with everything else, so
 * the price is only a check). Same state back when the gate or the price isn't met.
 */
export function ascend(s: GameState): GameState {
  return canAscend(s) ? ascendFree(s) : s;
}

/** Ascends without checking the gate or taking coins (debugger). */
export function ascendFree(s: GameState): GameState {
  const next = createState(ascendProgress(s));
  next.events = [{ type: 'sfx', name: 'stageClear' }, { type: 'save' }];
  return next;
}
