import { describe, expect, it } from 'vitest';
import { ASCEND_COST, ASCEND_GATE_LEVEL } from '../game/balance';
import {
  ASCEND_KEEPS,
  ASCEND_PANEL,
  ASCEND_RESETS,
  ascendBlockedReason,
  ascendGateText,
} from './ascend';

describe('ascendGateText', () => {
  it('says locked, with the gate and where you are', () => {
    const t = ascendGateText({ best: 9 }, '2.3');
    expect(t).toContain('Locked');
    expect(t).toContain('6.1');
    expect(t).toContain('2.3');
  });

  it('says unlocked from the gate on', () => {
    expect(ascendGateText({ best: ASCEND_GATE_LEVEL }, '6.1')).toContain('Unlocked');
  });
});

describe('ascendBlockedReason', () => {
  it('names what is missing, gate first', () => {
    expect(ascendBlockedReason({ best: 1, coins: ASCEND_COST * 2 })).toMatch(/gate/i);
    expect(ascendBlockedReason({ best: ASCEND_GATE_LEVEL, coins: ASCEND_COST - 1 })).toMatch(
      /coins/i,
    );
    expect(ascendBlockedReason({ best: ASCEND_GATE_LEVEL, coins: ASCEND_COST })).toBe('');
  });
});

describe('ascend texts', () => {
  it('list what resets and what stays in the panel', () => {
    expect(ASCEND_RESETS.join(' ')).toMatch(/coins/);
    expect(ASCEND_KEEPS.join(' ')).toMatch(/Items/);
    expect(ASCEND_PANEL).toContain('data-act="ascend"');
  });
});
