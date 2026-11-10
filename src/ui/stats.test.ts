import { describe, expect, it } from 'vitest';
import { CRIT, HERO_MAX_HP } from '../game/balance';
import { newGear, type Item } from '../game/items';
import { createState, newProgress, type Progress } from '../game/state';
import { characterStats, statsHtml, type StatSection } from './stats';

const stateOf = (p: Partial<Progress> = {}) => createState({ ...newProgress(), ...p });

const item = (slot: Item['slot'], stats: Item['stats']): Item => ({
  id: 1,
  slot,
  tier: 'B',
  world: 1,
  stage: 1,
  stats,
});

const value = (sections: StatSection[], title: string, label: string) =>
  sections.find((s) => s.title === title)?.rows.find((r) => r.label === label)?.value;

describe('characterStats', () => {
  it('starts with a fresh hero: full HP, no defence, stick damage', () => {
    const s = characterStats(stateOf());
    expect(value(s, 'Hero', 'HP')).toBe(`${HERO_MAX_HP} / ${HERO_MAX_HP}`);
    expect(value(s, 'Hero', 'Defence')).toBe('0 (−0% damage taken)');
    expect(value(s, 'Hero', 'Damage per hit')).toBe('1');
    expect(value(s, 'Hero', 'DPS')).toBe('1');
    expect(value(s, 'Hero', 'Crit chance')).toBe(`0% (×${CRIT.damageMult} damage)`);
    expect(value(s, 'Hero', 'DPS with crits (avg)')).toBe('1');
  });

  it('follows the live HP', () => {
    const state = stateOf();
    state.duel.heroHp = 37;
    expect(value(characterStats(state), 'Hero', 'HP')).toBe(`37 / ${HERO_MAX_HP}`);
  });

  it('adds the defence upgrade and shows the damage reduction', () => {
    const s = characterStats(
      stateOf({ character: { defenceLevel: 20, critLevel: 0, hpLevel: 0 } }),
    );
    // 20 levels × 5 = 100 defence → half of each hit.
    expect(value(s, 'Hero', 'Defence')).toBe('100 (−50% damage taken)');
  });

  it('uses the equipped weapon, upgrades and item damage for the hit and the DPS', () => {
    const items = { ...newGear(1), ring: item('ring', { damage: 4 }) };
    const s = characterStats(stateOf({ weaponLevels: [1, 10, 0, 0, 0], equipped: 1, items }));
    // Wooden sword: 6 base × level 10 + 4 from the ring.
    expect(value(s, 'Hero', 'Damage per hit')).toBe('64');
    expect(value(s, 'Hero', 'DPS')).toBe('64');
  });

  it('counts item attack speed in the DPS', () => {
    const items = { ...newGear(1), pendant: item('pendant', { speed: 0.25 }) };
    const s = characterStats(stateOf({ weaponLevels: [100, 0, 0, 0, 0], items }));
    expect(value(s, 'Hero', 'Damage per hit')).toBe('100');
    expect(value(s, 'Hero', 'DPS')).toBe('125');
  });

  it('adds the crit chance (upgrade and items) and the crit-adjusted DPS', () => {
    const items = { ...newGear(1), ring: item('ring', { crit: 0.1 }) };
    const s = characterStats(
      stateOf({
        weaponLevels: [100, 0, 0, 0, 0],
        items,
        character: { defenceLevel: 0, critLevel: 10, hpLevel: 0 },
      }),
    );
    // 10 levels × 1 % + 10 % ring = 20 % at ×2: DPS 100 → 120.
    expect(value(s, 'Hero', 'Crit chance')).toBe(`20% (×${CRIT.damageMult} damage)`);
    expect(value(s, 'Hero', 'DPS with crits (avg)')).toBe('120');
  });

  it('caps the crit chance like the game does', () => {
    const s = characterStats(
      stateOf({
        items: { ...newGear(1), ring: item('ring', { crit: 0.9 }) },
        character: { defenceLevel: 0, critLevel: 500, hpLevel: 0 },
      }),
    );
    expect(value(s, 'Hero', 'Crit chance')).toContain(`${CRIT.maxChance * 100}%`);
  });

  it('has no companion section until a companion is owned', () => {
    const titles = characterStats(stateOf()).map((x) => x.title);
    expect(titles).not.toContain('Crow');
    expect(titles).not.toContain('Wolf');
  });

  it('shows each owned companion: share of the hero hit, damage per hit and DPS', () => {
    // The stick at level 1000 hits for 1000.
    const base = { weaponLevels: [1000, 0, 0, 0, 0] };
    const s = characterStats(stateOf({ ...base, companions: { crow: 10, wolf: 0 } }));
    expect(value(s, 'Crow', 'Level')).toBe('10');
    expect(value(s, 'Crow', 'Hero damage dealt')).toBe('6.5%');
    expect(value(s, 'Crow', 'Damage per hit')).toBe('65');
    expect(value(s, 'Crow', 'DPS')).toBe('65');
    expect(s.map((x) => x.title)).not.toContain('Wolf');

    const both = characterStats(stateOf({ ...base, companions: { crow: 1, wolf: 50 } }));
    expect(both.map((x) => x.title).slice(0, 3)).toEqual(['Hero', 'Crow', 'Wolf']);
    expect(value(both, 'Crow', 'Damage per hit')).toBe('20');
    expect(value(both, 'Wolf', 'Hero damage dealt')).toBe('66.25%');
    expect(value(both, 'Wolf', 'Damage per hit')).toBe('662');
    expect(value(both, 'Wolf', 'DPS')).toBe('662');
  });

  it('lists only the item totals that are not zero', () => {
    const items = {
      ...newGear(1),
      ring: item('ring', { defence: 3, itemFind: 0.12 }),
      pendant: item('pendant', { defence: 2, crit: 0.035 }),
    };
    const rows = characterStats(stateOf({ items })).find((x) => x.title === 'Ring & pendant')!.rows;
    expect(rows).toEqual([
      { label: 'Defence', value: '+5' },
      { label: 'Item find', value: '+12%' },
      { label: 'Crit chance', value: '+3.5%' },
    ]);
  });

  it('says so when no ring or pendant bonus applies', () => {
    const s = characterStats(stateOf());
    expect(value(s, 'Ring & pendant', 'Bonuses')).toBe('None');
  });

  it('shows the best weapon owned (not the equipped one) and the highest stage reached', () => {
    const s = characterStats(
      stateOf({
        weaponLevels: [7, 3, 12, 0, 0],
        equipped: 1,
        world: 2,
        stage: 2,
        best: 9,
        kills: 1234,
        deaths: 5,
      }),
    );
    expect(value(s, 'Progress', 'Equipped weapon')).toBe('Wooden sword · Lv 3');
    expect(value(s, 'Progress', 'Best weapon')).toBe('Stone sword · Lv 12');
    expect(value(s, 'Progress', 'Highest stage')).toBe('2.3');
    expect(value(s, 'Progress', 'Kills')).toBe('1.2K');
    expect(value(s, 'Progress', 'Deaths')).toBe('5');
  });
});

describe('statsHtml', () => {
  it('renders each section as a heading and a label/value list, escaped', () => {
    const out = statsHtml([{ title: 'A & B', rows: [{ label: '<x>', value: '1' }] }]);
    expect(out).toBe('<h3>A &#38; B</h3><dl><dt>&#60;x&#62;</dt><dd>1</dd></dl>');
  });
});
