import { describe, expect, it } from 'vitest';
import { newGear, type Item } from '../game/items';
import { createState, heroDamage, newProgress, type Progress } from '../game/state';
import { createShow } from './dom';
import {
  compareText,
  formatDiff,
  showWeaponCompare,
  WEAPON_COMPARE_HTML,
  weaponCompare,
} from './weapon-compare';

const stateOf = (p: Partial<Progress> = {}) => createState({ ...newProgress(), ...p });

const ring = (damage: number): Item => ({
  id: 1,
  slot: 'ring',
  tier: 'B',
  world: 1,
  stage: 1,
  stats: { damage },
});

describe('weaponCompare', () => {
  it('shows a higher weapon at level 1: stick 1 → wooden sword 6', () => {
    const c = weaponCompare(stateOf(), 1);
    expect(c).toEqual({ current: 1, next: 6, diff: 5 });
    expect(compareText(c)).toBe('1 → 6 (+5)');
  });

  it('shows no change for the equipped weapon', () => {
    const c = weaponCompare(stateOf({ weaponLevels: [1, 1, 0, 0, 0], equipped: 1 }), 1);
    expect(c.diff).toBe(0);
    expect(compareText(c)).toBe('6 → 6 (0)');
  });

  it('shows a loss with a minus sign and no plus when the equipped weapon is stronger', () => {
    const c = weaponCompare(stateOf({ weaponLevels: [50, 0, 0, 0, 0] }), 1);
    expect(c).toEqual({ current: 50, next: 6, diff: -44 });
    expect(compareText(c)).toBe('50 → 6 (−44)');
  });

  it('uses the equipped weapon at its upgraded level', () => {
    const c = weaponCompare(stateOf({ weaponLevels: [1, 10, 0, 0, 0], equipped: 1 }), 2);
    // Wooden sword Lv 10 = 60 now; Stone sword Lv 1 = 36.
    expect(c).toEqual({ current: 60, next: 36, diff: -24 });
  });

  it('adds item damage to both sides', () => {
    const items = { ...newGear(1), ring: ring(4) };
    const c = weaponCompare(stateOf({ items }), 1);
    expect(c).toEqual({ current: 5, next: 10, diff: 5 });
  });

  it('matches heroDamage after the weapon is bought and equipped', () => {
    const s = stateOf({ weaponLevels: [3, 0, 0, 0, 0] });
    const c = weaponCompare(s, 1);
    expect(c.next).toBe(heroDamage({ ...s, equipped: 1, weaponLevels: [3, 1, 0, 0, 0] }));
  });

  it('does not change the state', () => {
    const s = stateOf();
    weaponCompare(s, 2);
    expect(s.weaponLevels).toEqual([1, 0, 0, 0, 0]);
    expect(s.equipped).toBe(0);
  });
});

describe('formatDiff', () => {
  it('uses + for gains, a real minus for losses, and plain 0', () => {
    expect(formatDiff(18)).toBe('+18');
    expect(formatDiff(-4)).toBe('−4');
    expect(formatDiff(0)).toBe('0');
    expect(formatDiff(12_345)).toBe('+12.3K');
    expect(formatDiff(-12_345)).toBe('−12.3K');
  });
});

describe('showWeaponCompare', () => {
  // The test environment has no DOM: a tiny stand-in for the three spans.
  const fake = () => {
    const el = () => {
      const classes = new Set<string>();
      return {
        textContent: '',
        classList: {
          contains: (n: string) => classes.has(n),
          toggle: (n: string, on: boolean) => void (on ? classes.add(n) : classes.delete(n)),
        },
      };
    };
    const parts = { '.cmp-cur': el(), '.cmp-new': el(), '.cmp-diff': el() };
    const li = { querySelector: (q: keyof typeof parts) => parts[q] };
    return { li: li as unknown as Element, parts };
  };

  it('fills the row and colours the new value only for a gain', () => {
    const { li, parts } = fake();
    const show = createShow();
    showWeaponCompare(li, stateOf(), 1, show);
    expect(parts['.cmp-cur'].textContent).toBe('1');
    expect(parts['.cmp-new'].textContent).toBe('6');
    expect(parts['.cmp-diff'].textContent).toBe('(+5)');
    expect(parts['.cmp-new'].classList.contains('dmg-next')).toBe(true);

    showWeaponCompare(li, stateOf({ weaponLevels: [50, 0, 0, 0, 0] }), 1, show);
    expect(parts['.cmp-diff'].textContent).toBe('(−44)');
    expect(parts['.cmp-new'].classList.contains('dmg-next')).toBe(false);
  });

  it('has the three spans in its markup', () => {
    for (const cls of ['cmp-cur', 'cmp-new', 'cmp-diff'])
      expect(WEAPON_COMPARE_HTML).toContain(cls);
  });
});
