import { describe, expect, it } from 'vitest';
import { GEAR_STYLES } from './gear';

describe('GEAR_STYLES', () => {
  it('has no glow on S or S+ frames', () => {
    expect(GEAR_STYLES).not.toMatch(/box-shadow: 0 0 \d+px/);
    expect(GEAR_STYLES).toContain(
      '.tier.tc-S, .tier.tc-SS { border-color: transparent; box-shadow: none; }',
    );
  });

  it('keeps the sparkles, still on Reduced', () => {
    expect(GEAR_STYLES).toContain(".tier.tc-S::after { content: '✦'");
    expect(GEAR_STYLES).toMatch(/\.motion-reduced \.tier\.tc-S::after[^{]*\{ animation: none; \}/);
  });
});
