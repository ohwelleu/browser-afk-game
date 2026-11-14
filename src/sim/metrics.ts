/**
 * Sampler and milestones. Reads the state and the events of each `update`
 * call; never changes the state.
 */
import { ITEM_TIERS, stageLevel } from '../game/balance';
import { TICK_RATE } from '../loop';
import {
  critChance,
  heroDamage,
  heroDefence,
  heroDps,
  heroMaxHp,
  type GameState,
} from '../game/state';
import type { Milestone, RunTotals, Sample, TierCounts } from './types';

/** A run never has more samples than this; the spacing grows to fit. */
export const MAX_SAMPLES = 1500;

const seconds = (ticks: number): number => ticks / TICK_RATE;

const noDrops = (): TierCounts => Object.fromEntries(ITEM_TIERS.map((t) => [t, 0])) as TierCounts;

export type Tracker = {
  earned: number;
  spent: number;
  autoSold: number;
  drops: TierCounts;
  /** Highest stage level recorded as a milestone (never goes down, even after an ascend). */
  top: number;
  samples: Sample[];
  milestones: Milestone[];
};

/** Starts tracking at `s` (tick 0): the starting stage is the first milestone. */
export function newTracker(s: GameState): Tracker {
  return {
    earned: 0,
    spent: 0,
    autoSold: 0,
    drops: noDrops(),
    top: s.best,
    samples: [],
    milestones: [{ level: s.best, tick: s.ticks, t: seconds(s.ticks) }],
  };
}

/** Reads one `update` call's events and records any new stage level reached. */
export function observe(tr: Tracker, s: GameState): void {
  for (const e of s.events) {
    if (e.type === 'coins') tr.earned += e.amount;
    else if (e.type === 'item') {
      tr.drops[e.item.tier]++;
      if (e.soldFor > 0) {
        tr.earned += e.soldFor;
        tr.autoSold++;
      }
    }
  }
  // `best` drops back on an ascend; milestones keep the first time each level was reached.
  for (let level = tr.top + 1; level <= s.best; level++) {
    tr.milestones.push({ level, tick: s.ticks, t: seconds(s.ticks) });
  }
  tr.top = Math.max(tr.top, s.best);
}

/** Adds a sample of `s` now. */
export function sample(tr: Tracker, s: GameState): void {
  const prev = tr.samples[tr.samples.length - 1];
  const dt = prev ? s.ticks - prev.tick : 0;
  tr.samples.push({
    tick: s.ticks,
    t: seconds(s.ticks),
    world: s.world,
    stage: s.stage,
    level: stageLevel(s.world, s.stage),
    best: s.best,
    autoAdvance: s.autoAdvance,
    coins: s.coins,
    earned: tr.earned,
    spent: tr.spent,
    incomePerMin: prev && dt > 0 ? ((tr.earned - prev.earned) * 60) / seconds(dt) : 0,
    kills: s.kills,
    deaths: s.deaths,
    ascends: s.ascends,
    heroHit: heroDamage(s),
    heroDps: heroDps(s),
    heroMaxHp: heroMaxHp(s),
    defence: heroDefence(s),
    crit: critChance(s),
    mobHp: s.duel.mob.maxHp,
    mobDamage: s.duel.mob.damage,
    drops: { ...tr.drops },
    bagSize: s.items.bag.length,
  });
}

export function totals(tr: Tracker, s: GameState): RunTotals {
  return {
    ticks: s.ticks,
    t: seconds(s.ticks),
    best: s.best,
    kills: s.kills,
    deaths: s.deaths,
    ascends: s.ascends,
    coins: s.coins,
    earned: tr.earned,
    spent: tr.spent,
    drops: { ...tr.drops },
    autoSold: tr.autoSold,
  };
}
