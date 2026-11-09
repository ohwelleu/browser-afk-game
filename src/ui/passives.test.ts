import { describe, expect, it } from 'vitest';
import { PASSIVES } from '../game/passives';
import { optionLine, passiveLine, tierBadge, totalsText, valueText } from './passives';

const def = (id: string) => PASSIVES.find((p) => p.id === id)!;

describe('passive texts', () => {
  it('formats percent and flat values', () => {
    expect(valueText(def('speed'), 0.015)).toBe('+1.5% attack speed');
    expect(valueText(def('crit'), 0.0075)).toBe('+0.75% crit chance');
    expect(valueText(def('defence'), 16)).toBe('+16 defence');
  });

  it('describes an owned entry with its levels summed', () => {
    expect(passiveLine({ id: 'speed', tier: 'B', level: 4 })).toEqual({
      name: 'Swift strikes',
      tier: 'B',
      total: '+6% attack speed',
      short: '+6%',
    });
    expect(passiveLine({ id: 'ghost', tier: 'C', level: 1 })).toBeNull();
    expect(passiveLine({ id: 'speed', tier: 'SS', level: 1 })?.tier).toBe('S+');
  });

  it('shows the total before → after and how a pick stacks', () => {
    const owned = [{ id: 'speed', tier: 'C' as const, level: 2 }];
    expect(optionLine({ id: 'speed', tier: 'C' }, owned)).toMatchObject({
      value: '+1% attack speed',
      total: 'Total 2% → 3%',
      owned: 'You have Lv 2 at this tier: it becomes Lv 3.',
    });
    expect(optionLine({ id: 'speed', tier: 'S' }, owned)?.owned).toMatch(/separate entry/);
    expect(optionLine({ id: 'crit', tier: 'A' }, owned)?.owned).toBe('New passive.');
    expect(optionLine({ id: 'ghost', tier: 'A' }, owned)).toBeNull();
  });

  it('lists the totals, empty when nothing is owned', () => {
    expect(totalsText([])).toBe('');
    expect(
      totalsText([
        { id: 'speed', tier: 'C', level: 3 },
        { id: 'defence', tier: 'C', level: 2 },
      ]),
    ).toBe('Attack speed +3%, Defence +4');
  });

  it('S+ badges get the rainbow frame, others a plain tier frame', () => {
    expect(tierBadge('SS')).toContain('rainbow-frame');
    expect(tierBadge('SS')).toContain('S+');
    expect(tierBadge('A')).toBe('<span class="tier tc-A"><b>A</b></span>');
  });
});
