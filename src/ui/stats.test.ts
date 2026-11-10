import { describe, expect, it } from 'vitest';
import { ascend } from '../game/ascend';
import { ASCEND_COST, CRIT, HERO_MAX_HP } from '../game/balance';
import { newGear, type Item } from '../game/items';
import { createState, newProgress, type GameState, type Progress } from '../game/state';
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
      earring: item('earring', { crit: 0.02, itemFind: 0.1 }),
      belt: item('belt', { defence: 4, damage: 6 }),
    };
    const rows = characterStats(stateOf({ items })).find((x) => x.title === 'Accessories')!.rows;
    expect(rows).toEqual([
      { label: 'Damage', value: '+6' },
      { label: 'Defence', value: '+9' },
      { label: 'Item find', value: '+22%' },
      { label: 'Crit chance', value: '+5.5%' },
    ]);
  });

  it('says so when no accessory bonus applies', () => {
    const s = characterStats(stateOf());
    expect(value(s, 'Accessories', 'Bonuses')).toBe('None');
  });

  it('shows the best weapon owned (not the equipped one), kills and deaths', () => {
    const s = characterStats(
      stateOf({
        weaponLevels: [7, 3, 12, 0, 0],
        equipped: 1,
        kills: 1234,
        deaths: 5,
      }),
    );
    expect(value(s, 'Progress', 'Equipped weapon')).toBe('Wooden sword · Lv 3');
    expect(value(s, 'Progress', 'Best weapon')).toBe('Stone sword · Lv 12');
    expect(value(s, 'Progress', 'Kills')).toBe('1.2K');
    expect(value(s, 'Progress', 'Deaths')).toBe('5');
  });

  it('shows the ascends', () => {
    expect(value(characterStats(stateOf()), 'Progress', 'Ascends')).toBe('0');
    expect(value(characterStats(stateOf({ ascends: 3 })), 'Progress', 'Ascends')).toBe('3');
  });
});

describe('characterStats records (this run and best)', () => {
  const ring: Item = {
    id: 1,
    slot: 'ring',
    tier: 'A',
    world: 3,
    stage: 2,
    stats: { damage: 9, defence: 2, crit: 0.03 },
  };
  const old: Item = { ...ring, id: 2, slot: 'pendant', tier: 'SS', world: 5, stage: 6 };
  const row = (p: Partial<Progress>, label: string) =>
    value(characterStats(stateOf(p)), 'Records', label);

  it('starts with the same value for this run and best', () => {
    expect(row({}, 'Highest stage (this run)')).toBe('1.1');
    expect(row({}, 'Highest stage (best)')).toBe('1.1');
    expect(row({}, 'Best item (owned now)')).toBe('—');
    expect(row({}, 'Best item (best)')).toBe('—');
    expect(row({}, 'Damage per second (now)')).toBe('1');
    expect(row({}, 'Damage per second (best)')).toBe('1');
  });

  it('shows the highest stage of this run next to the best ever', () => {
    const p = { world: 2, stage: 2, best: 9, bestStage: 40 };
    expect(row(p, 'Highest stage (this run)')).toBe('2.3');
    expect(row(p, 'Highest stage (best)')).toBe('7.4');
  });

  it('never shows a best stage below this run', () => {
    expect(row({ best: 9, bestStage: 2 }, 'Highest stage (best)')).toBe('2.3');
  });

  it('shows the best item owned now and the best ever (which may be gone)', () => {
    const items = { ...newGear(1), ring };
    expect(row({ items, bestItem: old }, 'Best item (owned now)')).toBe('A ring · 3.2');
    expect(row({ items, bestItem: old }, 'Best item (best)')).toBe('S+ pendant · 5.6');
  });

  it('shows the DPS now (with the item speed) next to the best ever', () => {
    const weaponLevels = [10, 0, 0, 0, 0];
    expect(row({ weaponLevels, maxDps: 500 }, 'Damage per second (now)')).toBe('10');
    expect(row({ weaponLevels, maxDps: 500 }, 'Damage per second (best)')).toBe('500');
  });

  it('survives an ascend: this run restarts, the best stays', () => {
    const before = stateOf({
      world: 6,
      stage: 1,
      best: 31,
      weaponLevels: [50, 20, 0, 0, 0],
      equipped: 1,
      ascends: 0,
    });
    const after = ascend({ ...before, coins: ASCEND_COST });
    const s = characterStats(after);
    expect(value(s, 'Progress', 'Ascends')).toBe('1');
    expect(value(s, 'Records', 'Highest stage (this run)')).toBe('1.1');
    expect(value(s, 'Records', 'Highest stage (best)')).toBe('6.1');
    expect(value(s, 'Records', 'Damage per second (now)')).toBe('1'); // back to the stick
    expect(value(s, 'Records', 'Damage per second (best)')).toBe('120'); // wooden sword, level 20
  });
});

describe('statsHtml', () => {
  it('renders each section as a heading and a label/value list, escaped', () => {
    const out = statsHtml([{ title: 'A & B', rows: [{ label: '<x>', value: '1' }] }]);
    expect(out).toBe('<h3>A &#38; B</h3><dl><dt>&#60;x&#62;</dt><dd>1</dd></dl>');
  });
});

describe('passive skills in the stats', () => {
  const rows = (s: StatSection[], title: string) => s.find((x) => x.title === title)?.rows ?? [];

  it('lists the drop chance of every tier at 0 ascends', () => {
    expect(rows(characterStats(stateOf()), 'Passive skill chances')).toEqual([
      { label: 'Tier C', value: '60%' },
      { label: 'Tier B', value: '25%' },
      { label: 'Tier A', value: '10%' },
      { label: 'Tier S', value: '4%' },
      { label: 'Tier S+', value: '1%' },
    ]);
  });

  it('follows the ascends: with 3 ascends B is more likely and C less', () => {
    const state = { ...stateOf(), ascends: 3 } as GameState;
    const chance = (tier: string) =>
      parseFloat(value(characterStats(state), 'Passive skill chances', `Tier ${tier}`)!);
    expect(chance('B')).toBeGreaterThan(25);
    expect(chance('C')).toBeLessThan(60);
    expect(chance('B') + chance('C') + chance('A') + chance('S') + chance('S+')).toBeCloseTo(
      100,
      0,
    );
  });

  it('keeps the ascend rows next to the passive chances', () => {
    const s = characterStats({ ...stateOf(), ascends: 3 } as GameState);
    expect(value(s, 'Progress', 'Ascends')).toBe('3');
    expect(s.map((x) => x.title)).toEqual(
      expect.arrayContaining(['Records', 'Passive skills', 'Passive skill chances']),
    );
  });

  it('shows the owned passives and the count', () => {
    const s = characterStats(
      stateOf({
        passives: [
          { id: 'speed', tier: 'C', level: 3 },
          { id: 'crit', tier: 'SS', level: 1 },
        ],
      }),
    );
    expect(value(s, 'Passive skills', 'Picks')).toBe('4');
    expect(value(s, 'Passive skills', 'Swift strikes · C')).toBe('Lv 3 · +3%');
    expect(value(s, 'Passive skills', 'Keen eye · S+')).toBe('Lv 1 · +4%');
    expect(value(s, 'Hero', 'Crit chance')).toBe(`4% (×${CRIT.damageMult} damage)`);
  });

  it('has an empty list for a new game and uses attack speed in the DPS', () => {
    expect(rows(characterStats(stateOf()), 'Passive skills')).toEqual([
      { label: 'Picks', value: '0' },
    ]);
    const s = characterStats(stateOf({ passives: [{ id: 'speed', tier: 'S', level: 25 }] }));
    // 25 × 4 % = 100 % → capped at 50 %: DPS 1 × 1.5
    expect(value(s, 'Hero', 'DPS')).toBe('1.5');
  });
});
