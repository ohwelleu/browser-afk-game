import { describe, expect, it } from 'vitest';
import { TICK } from '../loop';
import {
  CHARACTER,
  characterCost,
  COMPANIONS,
  HERO_MAX_MANA,
  MANA_PER_CLICK,
  manaFromLevel,
} from './balance';
import {
  buyUpgrades,
  companionClick,
  companionCooldown,
  createState,
  heroMaxMana,
  newProgress,
  secToTicks,
  update,
  upgradeQuote,
  type GameState,
  type Progress,
} from './state';

const fighting = (p: Partial<Progress> = {}): GameState => {
  let s = createState({ ...newProgress(), world: 3, best: 13, ...p });
  for (let i = 0; i < 2000 && s.duel.phase !== 'fighting'; i++) s = update(s, TICK);
  return s;
};
const withCrow = (p: Partial<Progress> = {}) =>
  fighting({ companions: { crow: 1, wolf: 0 }, mana: 10, ...p });

describe('max mana balance', () => {
  it('cost is base × growth^(level − 1) for the level bought', () => {
    const { base, growth } = CHARACTER.mana;
    expect(characterCost('mana', 0)).toBe(base);
    expect(characterCost('mana', 1)).toBe(Math.ceil(base * growth));
    expect(characterCost('mana', 9)).toBe(Math.ceil(base * growth ** 9));
    expect(characterCost('mana', -1)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('each level adds perLevel max mana on top of the base 100', () => {
    expect(HERO_MAX_MANA).toBe(100);
    expect(manaFromLevel(0)).toBe(0);
    expect(manaFromLevel(3)).toBe(3 * CHARACTER.mana.perLevel);
    expect(manaFromLevel(-4)).toBe(0);
    expect(heroMaxMana({})).toBe(HERO_MAX_MANA);
    const character = { defenceLevel: 0, critLevel: 0, hpLevel: 0, manaLevel: 5 };
    expect(heroMaxMana({ character })).toBe(HERO_MAX_MANA + manaFromLevel(5));
  });
});

describe('mana state', () => {
  it('a new game starts with full mana', () => {
    expect(createState().mana).toBe(HERO_MAX_MANA);
  });

  it('a loaded mana above the max is cut to the max', () => {
    expect(createState({ ...newProgress(), mana: 9999 }).mana).toBe(HERO_MAX_MANA);
  });

  it('mana is not reset by a new duel and does not regenerate by itself', () => {
    let s = fighting({ mana: 40 });
    for (let i = 0; i < secToTicks(60); i++) s = update(s, TICK);
    expect(s.mana).toBe(40);
  });
});

describe('mana from clicks', () => {
  it('a click that makes the crow peck gives MANA_PER_CLICK mana', () => {
    const s = withCrow();
    const t = companionClick(s);
    expect(t.mana).toBe(10 + MANA_PER_CLICK);
    expect(s.mana).toBe(10);
  });

  it('stops at the max', () => {
    const t = companionClick(withCrow({ mana: HERO_MAX_MANA }));
    expect(t.mana).toBe(HERO_MAX_MANA);
  });

  it('a click on cooldown gives nothing (autoclickers do no more than a peck)', () => {
    const t = companionClick(withCrow());
    expect(companionCooldown(t)).toBeGreaterThan(0);
    expect(companionClick(t)).toBe(t);
    let u = t;
    for (let i = 0; i < 20; i++) u = companionClick(u);
    expect(u.mana).toBe(t.mana);
    // Once the cooldown is over, the next click gives mana again.
    const cooldown = COMPANIONS.crow.clickCooldown ?? 0;
    for (let i = 0; i < secToTicks(cooldown) + 1; i++) u = update(u, TICK);
    expect(companionClick(u).mana).toBe(t.mana + MANA_PER_CLICK);
  });

  it('without the crow, clicking gives no mana', () => {
    const s = fighting({ mana: 10 });
    expect(companionClick(s)).toBe(s);
    const wolfOnly = fighting({ mana: 10, companions: { crow: 0, wolf: 1 } });
    expect(companionClick(wolfOnly)).toBe(wolfOnly);
  });

  it('outside a fight (no peck), clicking gives no mana', () => {
    const intro = createState({
      ...newProgress(),
      companions: { crow: 1, wolf: 0 },
      mana: 10,
    });
    expect(intro.duel.phase).toBe('intro');
    expect(companionClick(intro)).toBe(intro);
  });
});

describe('buying max mana', () => {
  const rich = (p: Partial<Progress> = {}) => createState({ ...newProgress(), coins: 1e6, ...p });

  it('pays the cost, raises the level and adds the extra mana in', () => {
    const s = rich({ mana: 40 });
    const t = buyUpgrades(s, { type: 'mana' }, 1);
    expect(t.coins).toBe(1e6 - characterCost('mana', 0));
    expect(t.character.manaLevel).toBe(1);
    expect(heroMaxMana(t)).toBe(HERO_MAX_MANA + CHARACTER.mana.perLevel);
    expect(t.mana).toBe(40 + CHARACTER.mana.perLevel);
    expect(s.character.manaLevel).toBe(0);
    expect(t.events).toEqual([{ type: 'sfx', name: 'purchase' }, { type: 'save' }]);
  });

  it('needs the coins, else returns the same state', () => {
    const s = rich({ coins: CHARACTER.mana.base - 1 });
    expect(buyUpgrades(s, { type: 'mana' }, 1)).toBe(s);
  });

  it('bulk buys quote and buy several levels', () => {
    const s = rich();
    const q = upgradeQuote(s, { type: 'mana' }, 10);
    expect(q.levels).toBe(10);
    const t = buyUpgrades(s, { type: 'mana' }, 10);
    expect(t.character.manaLevel).toBe(10);
    expect(t.coins).toBe(1e6 - q.cost);
  });
});
