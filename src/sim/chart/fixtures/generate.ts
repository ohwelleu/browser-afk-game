/**
 * Makes the report fixtures: a tiny, deterministic TOY idle model (not the
 * game, not balance data) that produces results JSON in the report's input
 * shape, with the features the charts need: walls, deaths, purchases, drops,
 * ascends and wall-clock gaps.
 *
 *   node --experimental-strip-types src/sim/chart/fixtures/generate.ts
 *
 * Writes `bots.json`, `ascend-sweep.json` and `grid-sweep.json` next to this file.
 */
import { writeFileSync } from 'node:fs';
import type {
  ReportInput,
  ReportPurchase,
  ReportRun,
  ReportSample,
  ReportVariant,
  SpendKind,
  Tier,
} from '../data.ts';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 3 significant digits keeps the files small. */
const r3 = (v: number) => (v === 0 || !Number.isFinite(v) ? v : Number(v.toPrecision(3)));

interface Toy {
  buy: boolean;
  /** Seconds between the bot's looks (buy, re-enable advance). */
  every: number;
  click: number;
  /** Re-enable auto-advance after a death. */
  recover: boolean;
  ascendAt?: number;
  dropChance?: number;
  hpGrowth?: number;
  /** Play seconds on, then seconds closed (wall-clock only). */
  sessions?: [number, number];
}

function simulate(toy: Toy, seed: number, duration: number, nSamples: number): ReportRun {
  const rng = mulberry32(seed * 7919 + 13);
  const hpGrowth = toy.hpGrowth ?? 1.28;
  const dropChance = toy.dropChance ?? 0.01;
  let level = 1;
  let best = 1;
  let coins = 0;
  let wpn = 0;
  let upg = 0;
  let chr = 0;
  let comp = 0;
  let dropBonus = 0;
  let ascendBonus = 0;
  let auto = true;
  let stageKills = 0;
  let killAcc = 0;
  let kills = 0;
  let deaths = 0;
  let ascends = 0;
  let hurt = 0;
  let earnedWindow = 0;
  let wallGap = 0;
  const spent: Record<SpendKind, number> = {
    weaponUpgrade: 0,
    weaponBuy: 0,
    character: 0,
    companion: 0,
    ascend: 0,
  };
  const drops: Record<Tier, number> = { C: 0, B: 0, A: 0, S: 0, SS: 0 };
  const purchases: ReportPurchase[] = [];
  const milestones: { level: number; t: number }[] = [{ level: 1, t: 0 }];
  const ascendLog: { t: number; level: number }[] = [];
  const samples: ReportSample[] = [];
  const sampleAt = new Set<number>();
  for (let i = 0; i < nSamples; i++) {
    sampleAt.add(Math.round(5 * (duration / 5) ** (i / (nSamples - 1))));
  }

  const dps = () =>
    (1 + dropBonus + ascendBonus) *
    2 *
    2 ** wpn *
    1.1 ** upg *
    (1 + 0.25 * comp) *
    (1 + 0.3 * Math.min(toy.click, 2));
  const heroHp = () => 30 * 1.1 ** chr * (1 + ascendBonus);
  const mobHp = (l: number) => 8 * hpGrowth ** (l - 1) * (l % 6 === 0 ? 4 : 1);
  const mobDmg = (l: number) => 1.5 * 1.16 ** (l - 1) * (l % 6 === 0 ? 2 : 1);
  const coinsPerKill = (l: number) => 1.5 * 1.22 ** (l - 1);

  for (let t = 1; t <= duration; t++) {
    if (toy.sessions && t % toy.sessions[0] === 0) wallGap += toy.sessions[1];
    const ttk = mobHp(level) / dps();
    const ttd = heroHp() / mobDmg(level);
    // At most one kill per 2 s (walk-in), like a real fight.
    killAcc += 1 / Math.max(ttk, 2);
    hurt += ttk > ttd ? 1 / ttd : 0;
    if (hurt >= 1) {
      hurt = 0;
      deaths += 1;
      level = Math.max(1, level - 1);
      stageKills = 0;
      killAcc = 0;
      auto = false;
    }
    while (killAcc >= 1) {
      killAcc -= 1;
      kills += 1;
      stageKills += 1;
      coins += coinsPerKill(level);
      earnedWindow += coinsPerKill(level);
      if (rng() < dropChance * (level % 6 === 0 ? 6 : 1)) {
        const r = rng();
        const tier: Tier = r < 0.55 ? 'C' : r < 0.82 ? 'B' : r < 0.94 ? 'A' : r < 0.99 ? 'S' : 'SS';
        drops[tier] += 1;
        dropBonus += 0.01 * (1 + ['C', 'B', 'A', 'S', 'SS'].indexOf(tier));
      }
      if (stageKills >= 10 && auto) {
        level += 1;
        stageKills = 0;
        if (level > best) {
          best = level;
          milestones.push({ level, t });
        }
      }
    }
    if (t % toy.every === 0) {
      if (!auto && toy.recover) {
        const nextTtk = mobHp(level + 1) / dps();
        if (heroHp() / mobDmg(level + 1) > 1.5 * nextTtk) auto = true;
      }
      if (toy.buy) {
        const quotes: [SpendKind, number][] = [
          ['weaponUpgrade', 5 * 1.15 ** upg],
          ['weaponBuy', 400 * 40 ** wpn],
          ['character', 10 * 1.17 ** chr],
          ['companion', 200 * 8 ** comp],
        ];
        // Bulk: keep buying the cheapest useful thing while affordable.
        let bought = true;
        while (bought) {
          bought = false;
          const affordable = quotes.filter((q) => q[1] <= coins).sort((a, b) => a[1] - b[1]);
          const pick = affordable.find((q) => q[0] === 'weaponBuy') ?? affordable[0];
          if (!pick) break;
          const [kind, cost] = pick;
          coins -= cost;
          spent[kind] += cost;
          const before = { weaponUpgrade: upg, weaponBuy: wpn, character: chr, companion: comp }[
            kind as Exclude<SpendKind, 'ascend'>
          ];
          if (kind === 'weaponUpgrade') upg += 1;
          if (kind === 'weaponBuy') wpn += 1;
          if (kind === 'character') chr += 1;
          if (kind === 'companion') comp += 1;
          const same = purchases.find((p) => p.t === t && p.kind === kind);
          if (same) {
            same.levelTo = (same.levelTo ?? 0) + 1;
            same.cost = r3((same.cost ?? 0) + cost);
          } else {
            purchases.push({
              t,
              kind,
              target: kind === 'weaponBuy' ? `tier ${wpn}` : undefined,
              levelFrom: before,
              levelTo: before + 1,
              cost: r3(cost),
            });
          }
          quotes.splice(
            0,
            4,
            ['weaponUpgrade', 5 * 1.15 ** upg],
            ['weaponBuy', 400 * 40 ** wpn],
            ['character', 10 * 1.17 ** chr],
            ['companion', 200 * 8 ** comp],
          );
          bought = true;
        }
      }
      // Ascend in the first half of the run only, then push as far as the bonus allows.
      if (toy.ascendAt && t < duration / 2 && level >= toy.ascendAt) {
        ascends += 1;
        ascendLog.push({ t, level });
        purchases.push({ t, kind: 'ascend', levelFrom: ascends - 1, levelTo: ascends, cost: 0 });
        ascendBonus += (level / 30) ** 2;
        level = 1;
        wpn = 0;
        upg = 0;
        chr = 0;
        comp = 0;
        coins = 0;
        auto = true;
        stageKills = 0;
      }
    }
    if (sampleAt.has(t)) {
      const prevT = samples.length ? samples[samples.length - 1].t : 0;
      samples.push({
        t,
        tWall: toy.sessions ? t + wallGap : undefined,
        level,
        best,
        coins: r3(coins),
        incomePerMin: r3((earnedWindow / Math.max(1, t - prevT)) * 60),
        spentTotal: r3(Object.values(spent).reduce((a, b) => a + b, 0)),
        spent: Object.fromEntries(Object.entries(spent).map(([k, v]) => [k, r3(v)])),
        dpsEff: r3(dps()),
        mobHp: r3(mobHp(level)),
        ttk: r3(mobHp(level) / dps()),
        ttd: r3(heroHp() / mobDmg(level)),
        kills,
        deaths,
        ascends,
        drops: { ...drops },
      });
      earnedWindow = 0;
    }
  }
  return { seed, samples, milestones, purchases, ascends: ascendLog };
}

function variant(
  id: string,
  label: string,
  toy: Toy,
  seeds: number[],
  duration: number,
  n: number,
  bot?: string,
  params?: Record<string, number>,
): ReportVariant {
  return {
    id,
    label,
    bot: bot ?? id,
    params,
    runs: seeds.map((s) => simulate(toy, s, duration, n)),
  };
}

const here = new URL('./', import.meta.url);
const write = (name: string, data: ReportInput) =>
  writeFileSync(new URL(name, here), `${JSON.stringify(data)}\n`);

const H8 = 8 * 3600;
const greedy: Toy = { buy: true, every: 120, click: 0, recover: true };

write('bots.json', {
  scenario: {
    name: 'fixture: compare bots (toy data)',
    gameVersion: '0.0.0-fixture',
    seed: 1,
    runs: 2,
    duration: '8h',
    bots: {
      idle: { buy: 'none', equip: 'never', click: 'none', advance: 'game-default' },
      'idle-greedy': { buy: 'greedy-dps', equip: 'best', click: 'none', advance: 'margin(1.5)' },
      active: {
        buy: 'greedy-dps',
        equip: 'best',
        click: 'rate(2)',
        advance: 'margin(1.5)',
        ascend: 'atLevel(19)',
      },
      'sessions-2h': { buy: 'greedy-dps', schedule: 'sessions(2h, 6h)' },
    },
    tuning: { 'mob.hp.growth': 1.28, 'items.dropChance.mob': 0.01 },
    report: {
      xAxis: 'log',
      targets: [
        { level: 7, label: 'World 2', at: '5m' },
        { level: 13, label: 'World 3', at: '20m' },
        { level: 25, label: 'World 5', at: '1h' },
        { level: 55, label: 'World 10', at: '24h' },
      ],
    },
  },
  variants: [
    variant('idle-greedy', 'idle-greedy', greedy, [1, 2], H8, 32),
    variant('active', 'active', { ...greedy, click: 2, ascendAt: 19 }, [1, 2], H8, 32),
    variant('idle', 'idle', { buy: false, every: 60, click: 0, recover: false }, [1, 2], H8, 32),
    variant(
      'sessions-2h',
      'sessions 2h on / 6h off',
      { ...greedy, sessions: [7200, 21600] },
      [4, 5],
      H8,
      32,
    ),
  ],
});

write('ascend-sweep.json', {
  scenario: {
    name: 'fixture: ascend threshold sweep (toy data)',
    gameVersion: '0.0.0-fixture',
    seed: 1,
    runs: 2,
    duration: '8h',
    bot: 'active',
    sweep: { 'bot.ascend.atLevel': [7, 13, 19, 25, 31] },
  },
  variants: [7, 13, 19, 25, 31].map((at) =>
    variant(
      `at-${at}`,
      `ascend at ${at}`,
      { ...greedy, every: 600, click: 2, ascendAt: at },
      [1, 2],
      H8,
      20,
      'active',
      {
        'bot.ascend.atLevel': at,
      },
    ),
  ),
});

const grid: ReportVariant[] = [];
for (const hp of [1.24, 1.28, 1.32]) {
  for (const dc of [0.005, 0.01, 0.02]) {
    grid.push(
      variant(
        `hp${hp}-dc${dc}`,
        `hp ${hp} · drop ${dc}`,
        { ...greedy, every: 600, hpGrowth: hp, dropChance: dc },
        [1],
        2 * 3600,
        16,
        'idle-greedy',
        {
          'items.dropChance.mob': dc,
          'mob.hp.growth': hp,
        },
      ),
    );
  }
}
write('grid-sweep.json', {
  scenario: {
    name: 'fixture: drop chance × mob HP growth (toy data)',
    gameVersion: '0.0.0-fixture',
    seed: 1,
    runs: 1,
    duration: '2h',
    bot: 'idle-greedy',
    sweep: { 'items.dropChance.mob': [0.005, 0.01, 0.02], 'mob.hp.growth': [1.24, 1.28, 1.32] },
  },
  variants: grid,
});
