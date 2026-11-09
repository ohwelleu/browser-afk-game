import { describe, expect, it } from 'vitest';
import { doneText, questText } from './quest';

describe('questText', () => {
  it('names the stage to clear before the crow unlocks', () => {
    expect(questText('unlock').text).toBe('Quest: clear stage 1.1 to unlock the crow');
  });

  it('points the two steps to Shop → Companions', () => {
    expect(questText('buy').text).toBe('Quest: buy the crow to start clicking');
    expect(questText('upgrade').text).toBe('Quest: upgrade the crow');
    expect(questText('buy').sub).toContain('Shop → Companions');
  });
});

describe('doneText', () => {
  it('confirms each finished step', () => {
    expect(doneText('buy', 'upgrade')).toMatch(/Crow bought/);
    expect(doneText('upgrade', null)).toMatch(/Quest complete/);
  });

  it('says nothing for other changes', () => {
    expect(doneText('unlock', 'buy')).toBeNull();
    expect(doneText(null, null)).toBeNull();
    expect(doneText('buy', 'buy')).toBeNull();
  });
});
