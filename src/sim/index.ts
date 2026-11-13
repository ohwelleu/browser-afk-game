/**
 * Simulator entry (docs/design/simulator.md). The CLI bundles this file for
 * Node; the game bundle never imports it.
 */
import { ITEM_TIERS, STAGES_PER_WORLD } from '../game/balance';
import { formatNumber } from '../game/format';
import { choosePick } from '../game/state';
import { TICK_RATE } from '../loop';
import { parseDuration, runScenario } from './run';
import type { Bot, Policy, RunResult } from './types';

export { MAX_SAMPLES } from './metrics';
export { parseDuration, runScenario, runWithState, sampleSpacing } from './run';
export type * from './types';

/**
 * A stage-clear pick freezes the fight until the player chooses, so even a
 * player who walks away has to click one. The idle bot takes the first option.
 */
const firstPick: Policy = (s) => (s.pick ? choosePick(s, 0) : s);

/**
 * `idle`: opens the page and walks away. Buys nothing, equips nothing, never
 * clicks, never turns auto-advance back on after a death (the lower bound).
 * It only clicks through the stage-clear pick, once a second.
 */
export const idleBot = (stepTicks = TICK_RATE): Bot => ({ id: 'idle', stepTicks, act: firstPick });

/** Named bots. More arrive with the bot policies (design §3). */
export const BOTS: Record<string, () => Bot> = {
  idle: () => idleBot(),
};

export type SimOptions = {
  bot?: string;
  seed?: number;
  /** Play time, e.g. `10m`, `8h`. */
  duration?: string;
  /** Sample spacing, e.g. `60s`. */
  sample?: string;
  version?: string;
};

export const DEFAULTS = { bot: 'idle', seed: 1, duration: '1h', sample: '60s' } as const;

/** One run from plain options (the CLI's flags). Unknown bots and bad durations throw. */
export function simulate(opts: SimOptions = {}): RunResult {
  const name = opts.bot ?? DEFAULTS.bot;
  const make = Object.prototype.hasOwnProperty.call(BOTS, name) ? BOTS[name] : undefined;
  if (!make) throw new Error(`Unknown bot "${name}". Bots: ${Object.keys(BOTS).join(', ')}`);
  const seed = opts.seed ?? DEFAULTS.seed;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error(`Bad seed ${seed}: use a whole number from 0 to 4294967295`);
  }
  return runScenario({
    bot: make(),
    seed,
    durationTicks: parseDuration(opts.duration ?? DEFAULTS.duration),
    sampleTicks: parseDuration(opts.sample ?? DEFAULTS.sample),
    version: opts.version,
  });
}

/** Stage level as the game shows it: 1 → `1.1`, 7 → `2.1`. */
export const stageName = (level: number): string =>
  `${Math.floor((level - 1) / STAGES_PER_WORLD) + 1}.${((level - 1) % STAGES_PER_WORLD) + 1}`;

/** Play time, short: `45s`, `12m 30s`, `8h 05m`. */
export function formatTime(seconds: number): string {
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

/** A few lines for the terminal: where the run got to and when. */
export function summaryText(r: RunResult): string {
  const t = r.totals;
  const drops = ITEM_TIERS.map((tier) => `${tier === 'SS' ? 'S+' : tier} ${t.drops[tier]}`);
  const reached = r.milestones
    .filter((m) => m.tick > 0)
    .map((m) => `${stageName(m.level)} ${formatTime(m.t)}`);
  return [
    `bot ${r.meta.bot} · seed ${r.meta.seed} · ${formatTime(t.t)} of play · game v${r.meta.version}`,
    `best ${stageName(t.best)} · kills ${t.kills} · deaths ${t.deaths} · ascends ${t.ascends}`,
    `coins ${formatNumber(t.coins)} (earned ${formatNumber(t.earned)}, spent ${formatNumber(t.spent)})`,
    `drops ${drops.join(', ')} (${t.autoSold} sold, bag full)`,
    `reached ${reached.join(' · ') || 'nothing new'}`,
  ].join('\n');
}
