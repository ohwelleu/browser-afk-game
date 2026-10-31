import { describe, expect, it } from 'vitest';
import { SfxMixer } from './sfx-mixer';

describe('SfxMixer', () => {
  it('plays high priority first and dedupes', () => {
    const m = new SfxMixer();
    expect(m.mix(['coin', 'hit', 'hit', 'mobDeath'], 0)).toEqual(['mobDeath', 'hit', 'coin']);
  });

  it('applies a per-sound cooldown', () => {
    const m = new SfxMixer(0.05);
    expect(m.mix(['hit'], 0)).toEqual(['hit']);
    expect(m.mix(['hit'], 0.03)).toEqual([]);
    expect(m.mix(['hit'], 0.06)).toEqual(['hit']);
  });

  it('caps voices and drops low priority first', () => {
    const m = new SfxMixer(0.05, 2, 0.3);
    expect(m.mix(['coin', 'swing', 'heroDeath'], 0)).toEqual(['heroDeath', 'swing']);
    expect(m.mix(['coin'], 0.1)).toEqual([]);
    expect(m.mix(['coin'], 0.4)).toEqual(['coin']);
  });
});
