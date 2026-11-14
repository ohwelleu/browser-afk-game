/**
 * Passive skills picked after killing a boss (roguelike stage picks).
 * Pure, like the rest of `game/`: all randomness comes from a seeded `Rng`.
 *
 * - `PASSIVES` is the options table: one row = one new option.
 * - Every tier (C B A S S+, the item tiers) has a value per passive.
 * - `tierWeights(ascends)` is the drop chance of each tier; every ascend moves
 *   weight from C towards the better tiers.
 * - `passiveTotals` sums what the player owns. `game/state.ts` reads it in
 *   ONE place per stat (`heroDefence`, `critChance`, `heroSpeed`,
 *   `extraHitChance`, `clickBonus`), so the stats window, the sim and the
 *   fight agree.
 */
import { ITEM_TIERS, safeInt, type ItemTier } from './balance';
import { nextFloat, pickWeighted, type Rng } from './rng';

/** Passives use the item tiers: C < B < A < S < S+ (`SS` is the id of S+). */
export type PassiveTier = ItemTier;

/** What a passive adds to. A new row can feed an existing stat without new code. */
export type PassiveStat = 'speed' | 'crit' | 'defence' | 'click' | 'extra';

export type PassiveDef = {
  id: string;
  name: string;
  stat: PassiveStat;
  /** `percent`: values are fractions (0.01 = +1 %). `flat`: whole points. */
  unit: 'percent' | 'flat';
  /** Shown after the value: "+1% attack speed". */
  effect: string;
  /** Value of ONE level at each tier. */
  values: Record<PassiveTier, number>;
};

// ── Tuning ───────────────────────────────────────────────────────────────────

/** How many options a boss kill offers. */
export const PICK_OPTIONS = 2;

/** S+ is S × this, like item tiers. */
const S_PLUS_MULT = 2;

/** Value of a tier relative to C. */
export const PASSIVE_TIER_MULT: Record<PassiveTier, number> = {
  C: 1,
  B: 1.5,
  A: 2.5,
  S: 4,
  SS: 4 * S_PLUS_MULT,
};

/**
 * Picks come once per world (a boss kill), so every value is scaled up. One
 * knob per tier for tuning: the final value of a tier is
 * `base × PASSIVE_TIER_MULT × PICK_VALUE_SCALE`. S+ stays S × `S_PLUS_MULT`.
 * (Chosen so the values are round: A 1.6 gives 4 % speed, 2 % crit, 8 defence.)
 */
export const PICK_VALUE_SCALE: Record<PassiveTier, number> = {
  C: 2,
  B: 2,
  A: 1.6,
  S: 1.5,
  SS: 1.5,
};

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Per-tier values of a passive whose C value is `base` (rounded to 0.01 % / whole points). */
function byTier(base: number, flat = false): Record<PassiveTier, number> {
  const v = (t: PassiveTier) =>
    flat
      ? Math.max(1, safeInt(base * PASSIVE_TIER_MULT[t] * PICK_VALUE_SCALE[t]))
      : round4(base * PASSIVE_TIER_MULT[t] * PICK_VALUE_SCALE[t]);
  return { C: v('C'), B: v('B'), A: v('A'), S: v('S'), SS: v('SS') };
}

/** The options. Add a row to add an option (or give an existing `stat` a second source). */
export const PASSIVES: readonly PassiveDef[] = [
  {
    id: 'speed',
    name: 'Swift strikes',
    stat: 'speed',
    unit: 'percent',
    effect: 'attack speed',
    values: byTier(0.01),
  },
  {
    id: 'crit',
    name: 'Keen eye',
    stat: 'crit',
    unit: 'percent',
    effect: 'crit chance',
    values: byTier(0.005),
  },
  {
    id: 'defence',
    name: 'Thick skin',
    stat: 'defence',
    unit: 'flat',
    effect: 'defence',
    values: byTier(2, true),
  },
  {
    id: 'click',
    name: 'Heavy touch',
    stat: 'click',
    unit: 'percent',
    effect: 'of your hit added to crow click pecks',
    values: byTier(0.005),
  },
  {
    id: 'extra',
    name: 'Second strike',
    stat: 'extra',
    unit: 'percent',
    effect: 'chance to hit again',
    values: byTier(0.01),
  },
];

/**
 * Caps on the total of one stat from passives. Crit has none here: the total
 * crit chance (upgrade + items + passives) is capped by `CRIT.maxChance`.
 * Item speed has its own cap (`ITEMS.caps.speed`); this one stacks on top.
 */
export const PASSIVE_CAPS: Partial<Record<PassiveStat, number>> = { speed: 0.5, extra: 0.5 };

/** The extra strike of "Second strike" deals this share of a normal hit. */
export const EXTRA_HIT_MULT = 0.5;

/** Drop weight of each tier at 0 ascends (any scale; chances are weight ÷ sum). */
export const PICK_TIER_WEIGHTS: Record<PassiveTier, number> = { C: 60, B: 25, A: 10, S: 4, SS: 1 };

/**
 * Each ascend moves this share of the C weight that is left to the better
 * tiers (`share` 0.15: C × 0.85 per ascend). `split` is how that moved weight
 * is divided between B, A, S and S+. C never reaches 0, and more ascends are
 * always better.
 */
export const ASCEND_SHIFT = {
  share: 0.15,
  split: { B: 50, A: 30, S: 15, SS: 5 } as Record<Exclude<PassiveTier, 'C'>, number>,
};

// ── Ascends ──────────────────────────────────────────────────────────────────

/**
 * The number of ascends of a run (`state.ascends`, set by game/ascend.ts).
 * This is the ONE place picks read it; a bad value counts as 0.
 */
export function ascendsOf(s: { ascends: number }): number {
  const n = s.ascends;
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

// ── Tier chances ─────────────────────────────────────────────────────────────

/** Drop weight of each tier after `ascends` ascends. */
export function tierWeights(ascends: number): Record<PassiveTier, number> {
  const n = Number.isFinite(ascends) ? Math.max(0, Math.floor(ascends)) : 0;
  const base = PICK_TIER_WEIGHTS;
  const moved = base.C * (1 - (1 - ASCEND_SHIFT.share) ** n);
  const { split } = ASCEND_SHIFT;
  const splitTotal = split.B + split.A + split.S + split.SS;
  const part = (t: keyof typeof split) => (moved * split[t]) / splitTotal;
  return {
    C: base.C - moved,
    B: base.B + part('B'),
    A: base.A + part('A'),
    S: base.S + part('S'),
    SS: base.SS + part('SS'),
  };
}

/** Chance (0–1, sums to 1) that a rolled option has each tier. */
export function tierChances(ascends: number): Record<PassiveTier, number> {
  const w = tierWeights(ascends);
  const total = ITEM_TIERS.reduce((sum, t) => sum + w[t], 0);
  return { C: w.C / total, B: w.B / total, A: w.A / total, S: w.S / total, SS: w.SS / total };
}

// ── Rolling an offer ─────────────────────────────────────────────────────────

/** One option of an offer. */
export type PickOption = { id: string; tier: PassiveTier };

/**
 * `count` options, each with its own tier roll, never the same passive twice.
 * Advances `rng`. Fewer options come back only if the table has fewer rows.
 */
export function rollPickOptions(rng: Rng, ascends: number, count = PICK_OPTIONS): PickOption[] {
  const weights = tierWeights(ascends);
  const pool = PASSIVES.map((p) => p.id);
  const options: PickOption[] = [];
  while (options.length < count && pool.length) {
    const tier = pickWeighted(rng, weights);
    const id = pool.splice(Math.floor(nextFloat(rng) * pool.length), 1)[0];
    options.push({ id, tier });
  }
  return options;
}

// ── Owned passives ───────────────────────────────────────────────────────────

/**
 * An owned passive. The same passive at the same tier stacks as +1 level; a
 * different tier is a separate entry. Nothing is replaced or lost, and the
 * total is simply `Σ level × value(tier)`.
 */
export type Passive = { id: string; tier: PassiveTier; level: number };

export const passiveDef = (id: string): PassiveDef | undefined => PASSIVES.find((p) => p.id === id);

/** Display order: table order, then C → S+. */
const order = (p: Pick<Passive, 'id' | 'tier'>) =>
  PASSIVES.findIndex((d) => d.id === p.id) * ITEM_TIERS.length + ITEM_TIERS.indexOf(p.tier);

/** The owned list after picking `option` (a new list; the input is untouched). */
export function addPassive(owned: readonly Passive[], option: PickOption): Passive[] {
  const next = owned.map((p) => ({ ...p }));
  const same = next.find((p) => p.id === option.id && p.tier === option.tier);
  if (same) same.level++;
  else next.push({ id: option.id, tier: option.tier, level: 1 });
  return next.sort((a, b) => order(a) - order(b));
}

/** What the owned passives add to each stat, caps applied. Unknown ids count for nothing. */
export function passiveTotals(owned: readonly Passive[] | undefined): Record<PassiveStat, number> {
  const t: Record<PassiveStat, number> = { speed: 0, crit: 0, defence: 0, click: 0, extra: 0 };
  for (const p of owned ?? []) {
    const def = passiveDef(p.id);
    if (def) t[def.stat] += def.values[p.tier] * p.level;
  }
  for (const stat of Object.keys(t) as PassiveStat[]) {
    const cap = PASSIVE_CAPS[stat];
    t[stat] = round4(cap === undefined ? t[stat] : Math.min(cap, t[stat]));
  }
  t.defence = safeInt(t.defence);
  return t;
}

/** Number of picks made (sum of levels). */
export const pickCount = (owned: readonly Passive[]): number =>
  owned.reduce((n, p) => n + p.level, 0);

// ── Debugger hook ────────────────────────────────────────────────────────────

let picksOn = true;

/** Debugger hook: turns the boss-kill pick off (and on again). On by default. */
export function setPicksEnabled(on: boolean): void {
  picksOn = on;
}

export const picksEnabled = (): boolean => picksOn;
