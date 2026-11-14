/**
 * Simulator types (docs/design/simulator.md). Pure data: everything here is
 * plain JSON, so a run result can be written to a file and read back as is.
 */
import type { ItemTier } from '../game/balance';
import type { Rng } from '../game/rng';
import type { GameState, Progress } from '../game/state';

/** What a bot sees besides the state: the clock, its own RNG and where to log purchases. */
export type BotCtx = {
  /** `state.ticks` when the bot is called. */
  tick: number;
  /** The bot's own seeded RNG (separate from the game's drop, crit and pick streams). */
  rng: Rng;
  /** Bots that buy something push it here; the runner copies it into the result. */
  purchases: Purchase[];
};

/** One small decision: calls pure game actions only, never edits state fields itself. */
export type Policy = (s: GameState, ctx: BotCtx) => GameState;

export type Bot = {
  id: string;
  /** How often the runner calls `act`, in ticks. The runner never runs more ticks in one go. */
  stepTicks: number;
  act: Policy;
};

/** A purchase made by a bot (the idle bot makes none). */
export type Purchase = {
  tick: number;
  kind: string;
  target: string;
  levelFrom: number;
  levelTo: number;
  cost: number;
};

/** Everything one run needs, with all defaults already filled in. */
export type ResolvedRun = {
  bot: Bot;
  /** Seeds the game (drops, crits, picks) and the bot's RNG. */
  seed: number;
  /** Simulated play time, in ticks (60 per second). */
  durationTicks: number;
  /** Ticks between samples. Raised if needed so a run has at most `MAX_SAMPLES` samples. */
  sampleTicks: number;
  /** Starting point; left out = a new game from `seed`. */
  start?: Progress;
  /** Game version, copied into the result (the sim can't read package.json). */
  version?: string;
};

/** Item drops so far, per tier. */
export type TierCounts = Record<ItemTier, number>;

/** A snapshot of the run, every `sampleTicks`. */
export type Sample = {
  /** Play time in ticks and in seconds. */
  tick: number;
  t: number;
  world: number;
  stage: number;
  /** Current stage as a level (1.1 → 1). */
  level: number;
  /** Highest stage level reached this run. */
  best: number;
  autoAdvance: boolean;
  coins: number;
  /** Coins from kills and auto-sold drops since the start. */
  earned: number;
  /** Coins spent by the bot since the start. */
  spent: number;
  /** Coins earned per minute since the previous sample. */
  incomePerMin: number;
  kills: number;
  deaths: number;
  ascends: number;
  /** Hero hit, DPS (no crits or companions), max HP, defence and crit chance right now. */
  heroHit: number;
  heroDps: number;
  heroMaxHp: number;
  defence: number;
  crit: number;
  /** Max HP and damage of the mob in the current duel. */
  mobHp: number;
  mobDamage: number;
  drops: TierCounts;
  bagSize: number;
};

/** First time `best` reached a stage level. Exact to the batch the bot ran. */
export type Milestone = { level: number; tick: number; t: number };

export type RunTotals = {
  ticks: number;
  t: number;
  best: number;
  kills: number;
  deaths: number;
  ascends: number;
  coins: number;
  earned: number;
  spent: number;
  drops: TierCounts;
  /** Drops that went straight to coins because the bag was full. */
  autoSold: number;
};

export type RunResult = {
  meta: {
    bot: string;
    seed: number;
    durationTicks: number;
    sampleTicks: number;
    stepTicks: number;
    start: 'new' | 'progress';
    version: string;
  };
  samples: Sample[];
  milestones: Milestone[];
  purchases: Purchase[];
  totals: RunTotals;
};
