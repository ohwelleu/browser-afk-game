/**
 * Golden table: every balance function for stage levels 1–60, and every
 * exported balance number, compared with `fixtures/balance-golden.txt`.
 *
 * The file was generated from the code BEFORE the `TUNING` refactor
 * (docs/design/simulator.md → 2.3), so it proves that refactor changed no
 * number. A PR that changes balance on purpose regenerates it and the diff
 * shows exactly which numbers moved:
 *
 *   npx vitest run src/game/balance-golden.test.ts -u
 *
 * Only names that existed before the refactor are used here.
 */
import { describe, expect, it } from 'vitest';
import {
  ASCEND_COST,
  ASCEND_COST_KILLS,
  ASCEND_GATE,
  ASCEND_GATE_LEVEL,
  ASCEND_SPEED_PER,
  CHARACTER,
  COMPANION_IDS,
  COMPANIONS,
  CRIT,
  CRIT_BUY_MAX_PERCENT,
  CRIT_MAX_LEVEL,
  CROW_BASE_PERCENT,
  CROW_PERCENT_PER_LEVEL,
  CROW_PRICE,
  CROW_UPGRADE,
  DUEL,
  HERO_MAX_HP,
  ITEM_STATS,
  ITEM_TIERS,
  ITEMS,
  MOB_KINDS,
  STAGE_MOBS,
  STAGES_PER_WORLD,
  UPGRADE_GROWTH,
  WEAPON_REVEAL_FRACTION,
  WEAPONS,
  WOLF_BASE_PERCENT,
  WOLF_PERCENT_PER_LEVEL,
  WOLF_PRICE,
  WOLF_UPGRADE,
  characterCost,
  companionDamage,
  companionPercent,
  companionUpgradeCostAt,
  critDamage,
  critFromLevel,
  defenceFromLevel,
  defendedDamage,
  dropChance,
  hpFromLevel,
  itemRarityWeights,
  itemSellPrice,
  itemStatValue,
  mobCoins,
  mobDamage,
  mobHp,
  upgradeCost,
  weaponDamage,
} from './balance';

const LEVELS = Array.from({ length: 60 }, (_, i) => i + 1);
const at = (L: number) => ({
  world: Math.floor((L - 1) / STAGES_PER_WORLD) + 1,
  stage: ((L - 1) % STAGES_PER_WORLD) + 1,
});

/** One tab-separated section: a header row, then one row per stage level. */
function section(title: string, cols: Record<string, (L: number) => number | string>): string {
  const names = Object.keys(cols);
  const rows = LEVELS.map((L) => [L, ...names.map((n) => cols[n](L))].join('\t'));
  return [`## ${title}`, ['L', ...names].join('\t'), ...rows].join('\n');
}

function goldenTable(): string {
  const mob = (f: (w: number, s: number) => number) => (L: number) => f(at(L).world, at(L).stage);
  const weaponCols: Record<string, (L: number) => number> = {};
  WEAPONS.forEach((_, t) => {
    weaponCols[`upgradeCost${t}`] = (L) => upgradeCost(t, L);
    weaponCols[`damage${t}`] = (L) => weaponDamage(t, L);
  });
  const companionCols: Record<string, (L: number) => number> = {};
  for (const id of COMPANION_IDS) {
    const def = COMPANIONS[id];
    companionCols[`${id}Cost`] = (L) => companionUpgradeCostAt(def, L);
    companionCols[`${id}Percent`] = (L) => companionPercent(def, L);
    companionCols[`${id}Dmg@1000`] = (L) => companionDamage(def, L, 1000);
    companionCols[`${id}Dmg@heroL`] = (L) => companionDamage(def, L, weaponDamage(1, L));
  }
  const itemCols = (roll: number) => {
    const cols: Record<string, (L: number) => number> = {};
    for (const stat of ITEM_STATS) {
      for (const tier of ITEM_TIERS)
        cols[`${stat}.${tier}`] = (L) => itemStatValue(stat, L, tier, roll);
    }
    return cols;
  };
  const sellCols: Record<string, (L: number) => number> = {};
  for (const tier of ITEM_TIERS) sellCols[`sell${tier}`] = mob((w, s) => itemSellPrice(w, s, tier));
  const rarityCols: Record<string, (L: number) => number> = {};
  for (const tier of ITEM_TIERS)
    rarityCols[`rarity${tier}`] = (L) => itemRarityWeights(L / 20)[tier];

  const constants = {
    HERO_MAX_HP,
    DUEL,
    MOB_KINDS,
    STAGE_MOBS,
    WEAPONS,
    WEAPON_REVEAL_FRACTION,
    UPGRADE_GROWTH,
    ASCEND_GATE,
    ASCEND_GATE_LEVEL,
    ASCEND_COST_KILLS,
    ASCEND_COST,
    ASCEND_SPEED_PER,
    ITEMS,
    CROW_PRICE,
    CROW_BASE_PERCENT,
    CROW_PERCENT_PER_LEVEL,
    CROW_UPGRADE,
    WOLF_PRICE,
    WOLF_BASE_PERCENT,
    WOLF_PERCENT_PER_LEVEL,
    WOLF_UPGRADE,
    COMPANIONS,
    CHARACTER,
    CRIT_BUY_MAX_PERCENT,
    CRIT,
    CRIT_MAX_LEVEL,
  };

  return [
    '# Balance golden table (src/game/balance-golden.test.ts). Regenerate with -u.',
    section('mobs', {
      stage: (L) => `${at(L).world}.${at(L).stage}`,
      hp: mob(mobHp),
      damage: mob(mobDamage),
      coins: mob(mobCoins),
      dropChance: mob(dropChance),
      critOfHp: mob((w, s) => critDamage(mobHp(w, s))),
      ...sellCols,
    }),
    section('weapons (level = L)', weaponCols),
    section('character (level = L − 1 for cost, L for stat)', {
      defenceCost: (L) => characterCost('defence', L - 1),
      critCost: (L) => characterCost('crit', L - 1),
      hpCost: (L) => characterCost('hp', L - 1),
      defence: defenceFromLevel,
      crit: critFromLevel,
      hp: hpFromLevel,
      mobHitTaken: (L) => defendedDamage(mob(mobDamage)(L), defenceFromLevel(L)),
    }),
    section('companions (level = L)', companionCols),
    section('items, roll 0.8', itemCols(0.8)),
    section('items, roll 1.0', itemCols(1)),
    section('items, roll 1.2', itemCols(1.2)),
    section('rarity weights (item find = L / 20)', rarityCols),
    '## constants',
    JSON.stringify(constants, null, 2),
    '',
  ].join('\n\n');
}

describe('balance golden table', () => {
  it('every balance value for stage levels 1–60 equals the committed table', async () => {
    await expect(goldenTable()).toMatchFileSnapshot('./fixtures/balance-golden.txt');
  });
});
