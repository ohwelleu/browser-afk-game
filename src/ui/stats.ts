import { weaponAttack } from '../game/attacks';
import {
  companionAutoInterval,
  companionDamage,
  CRIT,
  defenceReduction,
  ITEM_TIERS,
  WEAPONS,
} from '../game/balance';
import { formatNumber } from '../game/format';
import { gearTotals } from '../game/items';
import { ascendsOf, EXTRA_HIT_MULT, pickCount, tierChances } from '../game/passives';
import {
  clickBonus,
  companionDef,
  critChance,
  extraHitChance,
  heroDamage,
  heroDefence,
  heroMaxHp,
  heroSpeedBonus,
  type GameState,
} from '../game/state';
import { passiveLine, tierLabel } from './passives';
import { html } from './dom';
import { stageName } from './menu';
import { dialogHtml } from './modal';

/** One line of the stats window: a label and its value, both plain text. */
export type StatRow = { label: string; value: string };
export type StatSection = { title: string; rows: StatRow[] };

/** Percent with at most one decimal: 0.2 → "20%", 0.075 → "7.5%". */
const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;

/** Damage per second: one decimal below 100 (a slow crow still shows), else 1.2K style. */
const perSecond = (n: number) => (n < 100 ? `${+n.toFixed(1)}` : formatNumber(n));

/** "Stone sword · Lv 3" for a weapon tier, or "—" when it isn't owned. */
function weaponText(s: Pick<GameState, 'weaponLevels'>, tier: number): string {
  const level = s.weaponLevels[tier] ?? 0;
  const w = WEAPONS[tier];
  return w && level >= 1 ? `${w.name} · Lv ${formatNumber(level)}` : '—';
}

/** Highest weapon tier the player owns (the stick is always owned). */
const bestWeaponTier = (s: Pick<GameState, 'weaponLevels'>): number =>
  s.weaponLevels.reduce((best, level, tier) => (level >= 1 ? tier : best), 0);

/** The owned passive skills: how many picks, and one row per passive and tier. */
function passiveSection(s: GameState): StatSection {
  const rows: StatRow[] = [{ label: 'Picks', value: formatNumber(pickCount(s.passives)) }];
  for (const p of s.passives) {
    const line = passiveLine(p);
    if (line)
      rows.push({ label: `${line.name} · ${line.tier}`, value: `Lv ${p.level} · ${line.short}` });
  }
  return { title: 'Passive skills', rows };
}

/** Chance that a passive in a stage-clear offer has each tier, for the current ascends. */
function chanceSection(s: GameState): StatSection {
  const chances = tierChances(ascendsOf(s));
  return {
    title: 'Passive skill chances',
    rows: ITEM_TIERS.map((t) => ({ label: `Tier ${tierLabel(t)}`, value: pct(chances[t]) })),
  };
}

/**
 * Everything the stats window shows, as labelled rows. Pure: it only reads
 * the state and reuses the game's own formulas (`heroDamage`, `critChance`,
 * `gearTotals`, `companionDamage`, …).
 */
export function characterStats(s: GameState): StatSection[] {
  const gear = gearTotals(s.items);
  const defence = heroDefence(s);
  const chance = critChance(s);

  // Item and passive speed shorten the swing interval (see `combat` in game/state.ts).
  const hit = heroDamage(s);
  const dps = (hit * (1 + heroSpeedBonus(s))) / weaponAttack(s.equipped).interval;
  const extra = extraHitChance(s);
  // Average damage per swing: the crit bonus, plus the "Second strike" hits (never crits).
  const critDps = dps * (1 + chance * (CRIT.damageMult - 1) + extra * EXTRA_HIT_MULT);

  const hero: StatSection = {
    title: 'Hero',
    rows: [
      { label: 'HP', value: `${formatNumber(s.duel.heroHp)} / ${formatNumber(heroMaxHp(s))}` },
      {
        label: 'Defence',
        value: `${formatNumber(defence)} (−${pct(defenceReduction(defence))} damage taken)`,
      },
      { label: 'Damage per hit', value: formatNumber(hit) },
      { label: 'DPS', value: perSecond(dps) },
      { label: 'Crit chance', value: `${pct(chance)} (×${CRIT.damageMult} damage)` },
      { label: 'DPS with crits (avg)', value: perSecond(critDps) },
    ],
  };
  if (extra > 0) {
    hero.rows.push({ label: 'Second strike', value: `${pct(extra)} (×${EXTRA_HIT_MULT} damage)` });
  }
  if (clickBonus(s) > 0) {
    hero.rows.push({ label: 'Crow click bonus', value: `+${pct(clickBonus(s))} of your hit` });
  }
  const sections = [hero];

  const crow = companionDef(s);
  if (crow && s.companion) {
    const dmg = companionDamage(crow, s.companion.dmgLevel, hit);
    const auto = s.companion.autoUnlocked;
    const interval = companionAutoInterval(crow, s.companion.speedLevel);
    sections.push({
      title: crow.name,
      rows: [
        { label: 'Damage per peck', value: formatNumber(dmg) },
        { label: 'DPS (auto attack)', value: auto ? perSecond(dmg / interval) : 'Auto locked' },
      ],
    });
  }

  const bonuses: StatRow[] = [];
  if (gear.damage) bonuses.push({ label: 'Damage', value: `+${formatNumber(gear.damage)}` });
  if (gear.defence) bonuses.push({ label: 'Defence', value: `+${formatNumber(gear.defence)}` });
  if (gear.speed) bonuses.push({ label: 'Attack speed', value: `+${pct(gear.speed)}` });
  if (gear.itemFind) bonuses.push({ label: 'Item find', value: `+${pct(gear.itemFind)}` });
  if (gear.crit) bonuses.push({ label: 'Crit chance', value: `+${pct(gear.crit)}` });
  sections.push({
    title: 'Ring & pendant',
    rows: bonuses.length ? bonuses : [{ label: 'Bonuses', value: 'None' }],
  });

  sections.push(passiveSection(s), chanceSection(s));

  sections.push({
    title: 'Progress',
    rows: [
      { label: 'Equipped weapon', value: weaponText(s, s.equipped) },
      { label: 'Best weapon', value: weaponText(s, bestWeaponTier(s)) },
      { label: 'Highest stage', value: stageName(s.best) },
      { label: 'Kills', value: formatNumber(s.kills) },
      { label: 'Deaths', value: formatNumber(s.deaths) },
    ],
  });
  return sections;
}

export const STATS_STYLES = `
.stats .panel { width: min(420px, 100%); font-size: var(--afk-fs-menu, 1.15em); }
.stats h3 { margin: 0.8em 0 0.3em; font-size: 1em; }
.stats h3:first-of-type { margin-top: 0.2em; }
.stats dl { margin: 0; display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; }
.stats dt { opacity: 0.8; }
.stats dd { margin: 0; text-align: right; font-weight: bold; }
@container afk-box (max-width: 480px) {
  .stats dl { grid-template-columns: 1fr; gap: 0; }
  .stats dt { margin-top: 4px; }
  .stats dd { text-align: left; }
}
`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Markup for the sections: a heading and a label/value list each. */
export function statsHtml(sections: readonly StatSection[]): string {
  return sections
    .map(
      (sec) =>
        `<h3>${esc(sec.title)}</h3><dl>${sec.rows
          .map((r) => `<dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd>`)
          .join('')}</dl>`,
    )
    .join('');
}

export type StatsWindow = { el: HTMLElement; refresh(state: GameState): void };

/** The character stats modal (opened from the HP bar). The DOM part is thin: `characterStats` does the work. */
export function createStatsWindow(): StatsWindow {
  const el = html(
    dialogHtml({
      kind: 'modal',
      id: 'afk-stats',
      title: 'Character stats',
      closeLabel: 'Close stats',
      body: '<div class="stats-body"></div>',
    }),
  );
  el.classList.add('stats');
  const body = el.querySelector<HTMLElement>('.stats-body')!;
  // innerHTML is rebuilt only when the markup changes (refreshed every frame while open).
  let last = '';
  return {
    el,
    refresh(state) {
      const markup = statsHtml(characterStats(state));
      if (markup === last) return;
      last = markup;
      body.innerHTML = markup;
    },
  };
}
