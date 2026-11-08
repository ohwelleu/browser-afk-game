import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import {
  CHARACTER,
  characterCost,
  defenceFromLevel,
  defenceReduction,
  defendedDamage,
  mobDamage,
} from './balance';
import { newGear } from './items';
import { buyDefence, createState, heroDefence, newProgress, update, type GameState } from './state';

describe('defence upgrade balance', () => {
  it('cost is base × growth^(level − 1) for the level bought', () => {
    const { base, growth } = CHARACTER.defence;
    expect(characterCost('defence', 0)).toBe(base);
    expect(characterCost('defence', 1)).toBe(Math.ceil(base * growth));
    expect(characterCost('defence', 9)).toBe(Math.ceil(base * growth ** 9));
    expect(Number.isSafeInteger(characterCost('defence', 500))).toBe(true);
    expect(characterCost('defence', -1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('each level adds perLevel defence', () => {
    expect(defenceFromLevel(0)).toBe(0);
    expect(defenceFromLevel(3)).toBe(3 * CHARACTER.defence.perLevel);
  });

  it('taken = dmg × 100 / (100 + defence), rounded down, never below 1', () => {
    expect(defendedDamage(20, 0)).toBe(20);
    expect(defendedDamage(20, 25)).toBe(16);
    expect(defendedDamage(100, 100)).toBe(50);
    expect(defendedDamage(2, 1_000_000)).toBe(1);
    expect(defendedDamage(1, 0)).toBe(1);
    expect(defendedDamage(10, -50)).toBe(10);
    expect(defenceReduction(25)).toBeCloseTo(0.2);
  });
});

describe('buyDefence', () => {
  const withCoins = (coins: number) => createState({ ...newProgress(), coins });

  it('needs enough coins, else returns the same state', () => {
    const s = withCoins(CHARACTER.defence.base - 1);
    expect(buyDefence(s)).toBe(s);
  });

  it('pays the cost, raises the level, plays purchase and saves', () => {
    const s = withCoins(1000);
    const t = buyDefence(s);
    expect(t.coins).toBe(1000 - characterCost('defence', 0));
    expect(t.character.defenceLevel).toBe(1);
    expect(s.character.defenceLevel).toBe(0);
    expect(t.events).toEqual([{ type: 'sfx', name: 'purchase' }, { type: 'save' }]);
    const u = buyDefence(t);
    expect(u.coins).toBe(t.coins - characterCost('defence', 1));
    expect(u.character.defenceLevel).toBe(2);
  });

  it('item and upgrade defence add up', () => {
    const items = {
      ...newGear(0),
      ring: {
        id: 1,
        slot: 'ring' as const,
        tier: 'C' as const,
        world: 1,
        stage: 1,
        stats: { defence: 3 },
      },
    };
    const s = createState({
      ...newProgress(),
      items,
      character: { defenceLevel: 2, critLevel: 0 },
    });
    expect(heroDefence(s)).toBe(3 + defenceFromLevel(2));
  });

  it('mob hits drop by the formula in combat', () => {
    const firstHit = (s: GameState) => {
      for (let i = 0; i < 10_000; i++) {
        s = update(s, TICK);
        const hit = s.events.find((e) => e.type === 'damage' && e.target === 'hero');
        if (hit && hit.type === 'damage') return hit.amount;
      }
      throw new Error('no hit');
    };
    const at = { ...newProgress(), world: 5, stage: 1, best: 25 };
    const raw = mobDamage(5, 1);
    expect(firstHit(createState(at))).toBe(raw);
    const s = createState({ ...at, character: { defenceLevel: 4, critLevel: 0 } });
    expect(firstHit(s)).toBe(defendedDamage(raw, defenceFromLevel(4)));
    expect(firstHit(s)).toBeLessThan(raw);
  });
});
