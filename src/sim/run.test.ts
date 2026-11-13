import { afterEach, describe, expect, it } from 'vitest';
import { mobCoins, mobHp } from '../game/balance';
import { setPicksEnabled } from '../game/passives';
import type { GameState } from '../game/state';
import {
  idleBot,
  MAX_SAMPLES,
  parseDuration,
  runScenario,
  runWithState,
  sampleSpacing,
  simulate,
  stageName,
  summaryText,
  type Bot,
  type ResolvedRun,
} from './index';

const idle = (over: Partial<ResolvedRun> = {}): ResolvedRun => ({
  bot: idleBot(),
  seed: 1,
  durationTicks: parseDuration('10m'),
  sampleTicks: parseDuration('60s'),
  ...over,
});

/** Does nothing at all, looking every `stepTicks`. */
const noop = (stepTicks: number): Bot => ({ id: 'noop', stepTicks, act: (s) => s });

/** The state without this call's events (they only hold the last batch). */
const settled = ({ events: _, ...rest }: GameState) => rest;

afterEach(() => setPicksEnabled(true));

describe('runScenario', () => {
  it('gives byte-identical JSON for the same seed', () => {
    const run = idle({ durationTicks: parseDuration('1h') });
    expect(JSON.stringify(runScenario(run))).toBe(JSON.stringify(runScenario(run)));
  });

  it('a different seed rolls different drops', () => {
    const a = runScenario(idle({ seed: 1, durationTicks: parseDuration('1h') }));
    const b = runScenario(idle({ seed: 2, durationTicks: parseDuration('1h') }));
    expect(JSON.stringify(a.totals.drops)).not.toBe(JSON.stringify(b.totals.drops));
  });

  it('ends in the same state with batches of 1 and 60 ticks (do-nothing bot)', () => {
    // A pending pick would wait for the bot's next look, so batch size would matter: picks off.
    setPicksEnabled(false);
    const one = runWithState(idle({ bot: noop(1) }));
    const sixty = runWithState(idle({ bot: noop(60) }));
    expect(one.state.ticks).toBe(parseDuration('10m'));
    expect(one.state.kills).toBeGreaterThan(50);
    expect(one.state.deaths).toBeGreaterThan(0);
    expect(settled(sixty.state)).toEqual(settled(one.state));
    expect(sixty.result.samples).toEqual(one.result.samples);
    expect(sixty.result.totals).toEqual(one.result.totals);
  });

  it('matches a hand-checked idle run: the stick kills 1.1 at tick 180, coins add up', () => {
    // Stick: 1 damage, one hit a second. Mob 1.1: 2 HP. Full intro 2 s (120 ticks), so the
    // hits land at ticks 120 and 180.
    expect(mobHp(1, 1)).toBe(2);
    const at = (ticks: number) => runWithState(idle({ bot: idleBot(1), durationTicks: ticks }));
    expect(at(179).state.kills).toBe(0);
    const kill = at(180);
    expect(kill.state.kills).toBe(1);
    expect(kill.state.coins).toBe(mobCoins(1, 1));
    expect(kill.result.totals.earned).toBe(mobCoins(1, 1));
    // Mob death 0.9 s (54) → pick, taken at once → gap 0.3 s (18) → duel at 1.2 starts.
    const two = at(300).result.milestones.find((m) => m.level === 2);
    expect(two?.tick).toBe(180 + 54 + 18);

    const { state, result } = runWithState(idle());
    expect(result.purchases).toEqual([]);
    expect(result.totals.spent).toBe(0);
    expect(state.coins).toBe(result.totals.earned);
    for (const s of result.samples) expect(s.coins).toBe(s.earned - s.spent);
  });

  it('idle dies once, turns auto-advance off and farms the stage below for good', () => {
    const r = runScenario(idle({ durationTicks: parseDuration('1h') }));
    const last = r.samples[r.samples.length - 1];
    expect(r.totals.deaths).toBe(1);
    expect(last.autoAdvance).toBe(false);
    expect(last.level).toBe(r.totals.best - 1);
  });

  it('best only grows, milestones go up one level at a time', () => {
    const r = runScenario(idle({ durationTicks: parseDuration('1h') }));
    for (let i = 1; i < r.samples.length; i++) {
      expect(r.samples[i].best).toBeGreaterThanOrEqual(r.samples[i - 1].best);
      expect(r.samples[i].tick).toBeGreaterThan(r.samples[i - 1].tick);
    }
    expect(r.milestones.map((m) => m.level)).toEqual(r.milestones.map((_, i) => i + 1));
    for (let i = 1; i < r.milestones.length; i++) {
      expect(r.milestones[i].tick).toBeGreaterThan(r.milestones[i - 1].tick);
    }
    expect(r.totals.best).toBe(r.milestones[r.milestones.length - 1].level);
  });

  it('survives a JSON round trip unchanged', () => {
    const r = runScenario(idle());
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });

  it('samples at the spacing asked, ends on the last tick, and caps the count', () => {
    const r = runScenario(idle());
    expect(r.samples.map((s) => s.tick)).toEqual(
      Array.from({ length: 11 }, (_, i) => i * parseDuration('60s')),
    );
    const long = runScenario(idle({ durationTicks: parseDuration('2h'), sampleTicks: 1 }));
    expect(long.meta.sampleTicks).toBe(sampleSpacing(long.meta));
    expect(long.meta.sampleTicks).toBe(parseDuration('2h') / MAX_SAMPLES);
    expect(long.samples.length).toBe(MAX_SAMPLES + 1);
    expect(long.samples[long.samples.length - 1].tick).toBe(parseDuration('2h'));
  });
});

describe('simulate', () => {
  it('fills in defaults and rejects unknown bots and bad seeds', () => {
    const r = simulate({ duration: '30s', version: '9.9.9' });
    expect(r.meta).toMatchObject({ bot: 'idle', seed: 1, version: '9.9.9', start: 'new' });
    expect(() => simulate({ bot: 'toString' })).toThrow(/Unknown bot/);
    expect(() => simulate({ seed: -1 })).toThrow(/Bad seed/);
    expect(() => simulate({ seed: 1.5 })).toThrow(/Bad seed/);
  });

  it('prints a short summary', () => {
    const text = summaryText(simulate({ duration: '1m' }));
    expect(text).toContain('bot idle · seed 1 · 1m 00s of play');
    expect(text).toContain('reached 1.2 ');
  });
});

describe('parseDuration and stageName', () => {
  it('reads seconds, units and sums; throws on typos', () => {
    expect(parseDuration('90')).toBe(5400);
    expect(parseDuration('90s')).toBe(5400);
    expect(parseDuration('10m')).toBe(36_000);
    expect(parseDuration('1h30m')).toBe(324_000);
    expect(parseDuration('1d')).toBe(5_184_000);
    for (const bad of ['', '5x', '1h 30m', 'h', '-1h']) {
      expect(() => parseDuration(bad)).toThrow(/Bad duration/);
    }
  });

  it('names stage levels like the game', () => {
    expect([1, 6, 7, 55].map(stageName)).toEqual(['1.1', '1.6', '2.1', '10.1']);
  });
});
