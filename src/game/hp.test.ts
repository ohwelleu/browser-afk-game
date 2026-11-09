import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import { CHARACTER, characterCost, HERO_MAX_HP, hpFromLevel, mobDamage, mobHp } from './balance';
import { buyHp, createState, heroMaxHp, newProgress, update, type GameState } from './state';

describe('max HP upgrade balance', () => {
  it('cost is base × growth^(level − 1) for the level bought', () => {
    const { base, growth } = CHARACTER.hp;
    expect(characterCost('hp', 0)).toBe(base);
    expect(characterCost('hp', 1)).toBe(Math.ceil(base * growth));
    expect(characterCost('hp', 9)).toBe(Math.ceil(base * growth ** 9));
    expect(Number.isSafeInteger(characterCost('hp', 500))).toBe(true);
    expect(characterCost('hp', -1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('each level adds perLevel max HP on top of the base', () => {
    expect(hpFromLevel(0)).toBe(0);
    expect(hpFromLevel(3)).toBe(3 * CHARACTER.hp.perLevel);
    expect(hpFromLevel(-4)).toBe(0);
    expect(heroMaxHp({ character: { defenceLevel: 0, critLevel: 0, hpLevel: 5 } })).toBe(
      HERO_MAX_HP + hpFromLevel(5),
    );
    expect(heroMaxHp({})).toBe(HERO_MAX_HP);
  });
});

describe('mob damage curve', () => {
  it('grows steeper than the old 1.05 per stage', () => {
    expect(mobDamage(3, 1)).toBeGreaterThan(Math.ceil(4 * 1.05 ** 12));
    expect(mobDamage(10, 1)).toBeGreaterThan(Math.ceil(4 * 1.05 ** 54));
    expect(mobDamage(5, 1)).toBeGreaterThan(mobDamage(4, 1));
    expect(mobHp(1, 1)).toBe(2); // mob HP is untouched
  });
});

describe('buyHp', () => {
  const withCoins = (coins: number) => createState({ ...newProgress(), coins });

  it('needs enough coins, else returns the same state', () => {
    const s = withCoins(CHARACTER.hp.base - 1);
    expect(buyHp(s)).toBe(s);
  });

  it('pays the cost, raises the level, plays purchase and saves', () => {
    const s = withCoins(1000);
    const t = buyHp(s);
    expect(t.coins).toBe(1000 - characterCost('hp', 0));
    expect(t.character.hpLevel).toBe(1);
    expect(s.character.hpLevel).toBe(0);
    expect(t.events).toEqual([{ type: 'sfx', name: 'purchase' }, { type: 'save' }]);
    expect(buyHp(t).character.hpLevel).toBe(2);
  });

  it('heals the extra HP in, so the bar keeps its fill', () => {
    const s = withCoins(1000);
    const hurt: GameState = { ...s, duel: { ...s.duel, heroHp: 40 } };
    const t = buyHp(hurt);
    expect(t.duel.heroHp).toBe(40 + CHARACTER.hp.perLevel);
    expect(heroMaxHp(t)).toBe(HERO_MAX_HP + CHARACTER.hp.perLevel);
    // A dead hero is not revived by a purchase.
    const dead: GameState = { ...s, duel: { ...s.duel, heroHp: 0 } };
    expect(buyHp(dead).duel.heroHp).toBe(0);
  });

  it('a new duel starts at the full max HP, also on a loaded game', () => {
    const s = createState({
      ...newProgress(),
      character: { defenceLevel: 0, critLevel: 0, hpLevel: 7 },
    });
    expect(s.duel.heroHp).toBe(HERO_MAX_HP + hpFromLevel(7));
  });

  it('more max HP lets the hero survive more mob hits in combat', () => {
    const hitsToDie = (hpLevel: number) => {
      let s = createState({
        ...newProgress(),
        world: 5,
        stage: 1,
        best: 25,
        character: { defenceLevel: 0, critLevel: 0, hpLevel },
      });
      let hits = 0;
      for (let i = 0; i < 100_000 && s.duel.phase !== 'heroDying'; i++) {
        s = update(s, TICK);
        hits += s.events.filter((e) => e.type === 'damage' && e.target === 'hero').length;
      }
      return hits;
    };
    expect(hitsToDie(0)).toBe(Math.ceil(HERO_MAX_HP / mobDamage(5, 1)));
    expect(hitsToDie(10)).toBeGreaterThan(hitsToDie(0));
  });
});
