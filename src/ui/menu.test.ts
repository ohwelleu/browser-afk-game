import { describe, expect, it } from 'vitest';
import { COMPANIONS } from '../game/balance';
import { companionUnlockText, stageName } from './menu';

describe('stageName', () => {
  it('turns a stage level into world.stage', () => {
    expect(stageName(1)).toBe('1.1');
    expect(stageName(6)).toBe('1.6');
    expect(stageName(7)).toBe('2.1');
    expect(stageName(13)).toBe('3.1');
  });
});

describe('companionUnlockText', () => {
  it('names the stage to clear (unlockLevel is the level after it)', () => {
    expect(companionUnlockText({ unlockLevel: 2 })).toBe('Unlocks after clearing 1.1');
    expect(companionUnlockText({ unlockLevel: 8 })).toBe('Unlocks after clearing 2.1');
  });

  it('uses the crow balance value', () => {
    expect(companionUnlockText(COMPANIONS.crow)).toMatch(/^Unlocks after clearing \d+\.\d+$/);
  });
});
