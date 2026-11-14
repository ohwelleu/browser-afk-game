/**
 * Headless runner: the game's own `update()` in a loop, with a bot instead of
 * a player. Pure TypeScript (no fs, process or DOM), so Node and the browser
 * can both import it.
 */
import { TICK_RATE } from '../loop';
import { createState, newProgress, update, type GameState } from '../game/state';
import { MAX_SAMPLES, newTracker, observe, sample, totals } from './metrics';
import type { BotCtx, ResolvedRun, RunResult } from './types';

/** The bot's RNG seed: the run seed, scrambled so it never matches a game stream. */
const botSeed = (seed: number): number => (seed ^ 0x27d4eb2f) >>> 0;

/** Sample spacing actually used: the requested one, widened to stay within `MAX_SAMPLES`. */
export const sampleSpacing = (run: Pick<ResolvedRun, 'durationTicks' | 'sampleTicks'>): number =>
  Math.max(1, Math.round(run.sampleTicks), Math.ceil(run.durationTicks / MAX_SAMPLES));

/** Runs `run` and returns the result together with the final state (tests compare states). */
export function runWithState(run: ResolvedRun): { state: GameState; result: RunResult } {
  const { bot } = run;
  const end = Math.max(0, Math.round(run.durationTicks));
  const every = sampleSpacing(run);
  const step = Math.max(1, Math.round(bot.stepTicks));

  let state = createState(run.start ?? newProgress(run.seed));
  const tr = newTracker(state);
  const ctx: BotCtx = { tick: 0, rng: { state: botSeed(run.seed) }, purchases: [] };
  sample(tr, state);

  let nextAct = 0;
  let nextSample = every;
  while (state.ticks < end) {
    if (state.ticks >= nextAct) {
      ctx.tick = state.ticks;
      const before = ctx.purchases.length;
      state = bot.act(state, ctx);
      for (const p of ctx.purchases.slice(before)) tr.spent += p.cost;
      nextAct = state.ticks + step;
    }
    // Never past the bot's next look, the next sample or the end: batching changes no outcome.
    const n = Math.min(nextAct, nextSample, end) - state.ticks;
    state = update(state, n / TICK_RATE);
    observe(tr, state);
    if (state.ticks >= nextSample) {
      sample(tr, state);
      nextSample += every;
    }
  }
  // The last sample is always the end state.
  if (tr.samples[tr.samples.length - 1].tick !== state.ticks) sample(tr, state);

  return {
    state,
    result: {
      meta: {
        bot: bot.id,
        seed: run.seed,
        durationTicks: end,
        sampleTicks: every,
        stepTicks: step,
        start: run.start ? 'progress' : 'new',
        version: run.version ?? 'dev',
      },
      samples: tr.samples,
      milestones: tr.milestones,
      purchases: ctx.purchases,
      totals: totals(tr, state),
    },
  };
}

/** Runs one scenario run: same input (seed included), same result, byte for byte. */
export const runScenario = (run: ResolvedRun): RunResult => runWithState(run).result;

/**
 * Play time to ticks: `90` or `90s`, `10m`, `8h`, `1d`, or a sum like `1h30m`.
 * Throws on anything else, so a typo never runs a default.
 */
export function parseDuration(text: string): number {
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };
  const src = text.trim();
  if (/^\d+(\.\d+)?$/.test(src)) return Math.round(Number(src) * TICK_RATE);
  const parts = [...src.matchAll(/(\d+(?:\.\d+)?)([smhd])/g)];
  if (!parts.length || parts.map((p) => p[0]).join('') !== src) {
    throw new Error(`Bad duration "${text}": use e.g. 90s, 10m, 8h, 1d or 1h30m`);
  }
  return Math.round(parts.reduce((sum, p) => sum + Number(p[1]) * units[p[2]], 0) * TICK_RATE);
}
