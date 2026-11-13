/**
 * Tuning overrides for simulator runs (docs/design/simulator.md → 2.3, 4).
 * The numbers themselves live in `src/game/balance.ts` (`TUNING`); this file
 * only lists, reads and applies them by key.
 *
 * Overrides change module state, so a run applies them before it starts and
 * calls `resetTuning()` after (or runs in its own worker).
 */
import { applyTuning, resetTuning, tuningLeaves } from '../game/balance';

export { applyTuning, resetTuning };

/** A path as a key: array indices in brackets (`weapons[1].price`). */
const keyOf = (path: string[]): string =>
  path.reduce((key, k) => (/^\d+$/.test(k) ? `${key}[${k}]` : key ? `${key}.${k}` : k), '');

/** Every tuning key with its current value, in `TUNING` order. */
export function tuningValues(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [path, value] of tuningLeaves()) out[keyOf(path)] = value;
  return out;
}

/** Every tuning key, e.g. for `npm run sim -- --list`. */
export const tuningKeys = (): string[] => Object.keys(tuningValues());

/** Current value of one key. Throws on an unknown key. */
export function getTuning(key: string): number {
  const values = tuningValues();
  const norm = key.replace(/\.(\d+)(?=\.|$)/g, '[$1]');
  if (!Object.prototype.hasOwnProperty.call(values, norm)) {
    throw new Error(`Unknown tuning key "${key}"`);
  }
  return values[norm];
}

/**
 * Applies a scenario's `tuning` block. Every key and value is checked first,
 * so a typo applies nothing.
 */
export function applyTunings(overrides: Record<string, number>): void {
  const entries = Object.entries(overrides);
  for (const [key, value] of entries) {
    getTuning(key);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`Tuning "${key}" must be a finite number, got ${String(value)}`);
    }
  }
  for (const [key, value] of entries) applyTuning(key, value);
}
