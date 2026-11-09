import { describe, expect, it } from 'vitest';
import { COMPANIONS } from './balance';
import { crowUpgraded, nextRun, questStep, type QuestRun, type QuestStep } from './quest';
import { buyCompanion, createState, newProgress, upgradeCompanion, type GameState } from './state';

const crow = COMPANIONS.crow;
const rich = (patch: Partial<GameState> = {}): GameState => ({
  ...createState({ ...newProgress(), best: crow.unlockLevel }),
  coins: 100_000,
  ...patch,
});

describe('questStep', () => {
  it('waits for the crow to unlock on a new game', () => {
    expect(questStep(createState())).toBe('unlock');
  });

  it('asks to buy the crow once it is in the shop', () => {
    expect(questStep(rich())).toBe('buy');
  });

  it('moves to the upgrade step after buying, and ends after one upgrade', () => {
    const bought = buyCompanion(rich());
    expect(bought.companion).not.toBeNull();
    expect(questStep(bought)).toBe('upgrade');
    expect(questStep(upgradeCompanion(bought, 'dmg'))).toBeNull();
    expect(questStep(upgradeCompanion(bought, 'auto'))).toBeNull();
  });

  it('counts speed upgrades too', () => {
    const c = { id: 'crow', dmgLevel: 1, autoUnlocked: true, speedLevel: 2 } as const;
    expect(crowUpgraded(c)).toBe(true);
    expect(crowUpgraded({ ...c, autoUnlocked: false, speedLevel: 1 })).toBe(false);
  });
});

describe('nextRun', () => {
  const steps: (QuestStep | null)[] = ['unlock', 'buy', 'upgrade', null];

  it('starts only when the first look is before the crow is bought', () => {
    expect(nextRun('unseen', 'unlock')).toBe('on');
    expect(nextRun('unseen', 'buy')).toBe('on');
    // An existing player: owns the crow already (upgraded or not).
    expect(nextRun('unseen', 'upgrade')).toBe('off');
    expect(nextRun('unseen', null)).toBe('off');
  });

  it('keeps going through the steps, then ends for good', () => {
    expect(nextRun('on', 'upgrade')).toBe('on');
    expect(nextRun('on', null)).toBe('off');
    for (const step of steps) expect(nextRun('off', step)).toBe('off');
  });

  it('never turns on from the off state', () => {
    let run: QuestRun = 'unseen';
    for (const step of ['upgrade', 'buy', 'unlock'] as const) run = nextRun(run, step);
    expect(run).toBe('off');
  });
});
