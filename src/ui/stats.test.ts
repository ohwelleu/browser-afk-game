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
      stateOf({ character: { defenceLevel: 0, critLevel: 500, hpLevel: 0 } }),
    );
    expect(value(s, 'Hero', 'Crit chance')).toContain(`${CRIT.maxChance * 100}%`);
  });

  it('has no crow section until the crow is owned', () => {
    expect(characterStats(stateOf()).map((x) => x.title)).not.toContain('Crow');
  });

  it('shows the crow damage (with the hero share) and DPS once auto attack is unlocked', () => {
    const companion = { id: 'crow' as const, dmgLevel: 1, autoUnlocked: false, speedLevel: 1 };
    const base = { weaponLevels: [100, 0, 0, 0, 0] };
    const locked = characterStats(stateOf({ ...base, companion }));
    // 1 flat + 10 % of the 100 hit.
    expect(value(locked, 'Crow', 'Damage per peck')).toBe('11');
    expect(value(locked, 'Crow', 'DPS (auto attack)')).toBe('Auto locked');

    const auto = characterStats(
      stateOf({ ...base, companion: { ...companion, autoUnlocked: true } }),
    );
    // 11 damage every 3 s.
    expect(value(auto, 'Crow', 'DPS (auto attack)')).toBe('3.7');
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
