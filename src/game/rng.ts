/**
 * Seedable RNG (mulberry32). The whole state is one uint32, so it lives in the
 * game state and the save: drops are reproducible in tests and reloading
 * doesn't re-roll them.
 */
export type Rng = { state: number };

/** Next float in [0, 1); advances `rng.state`. */
export function nextFloat(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
}

/** Fresh random seed for a new game or a migrated save. */
export const randomSeed = (): number => (Math.random() * 4_294_967_296) >>> 0;

/** Picks a key by weight. Weights don't need to sum to 1. */
export function pickWeighted<K extends string>(rng: Rng, weights: Record<K, number>): K {
  const keys = Object.keys(weights) as K[];
  const total = keys.reduce((sum, k) => sum + weights[k], 0);
  let r = nextFloat(rng) * total;
  for (const k of keys) {
    r -= weights[k];
    if (r < 0) return k;
  }
  return keys[keys.length - 1];
}
