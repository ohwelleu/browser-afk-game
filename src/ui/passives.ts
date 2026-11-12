import { ITEM_TIER_LABEL } from '../game/balance';
import { formatNumber } from '../game/format';
import {
  passiveDef,
  passiveTotals,
  pickCount,
  type Passive,
  type PassiveDef,
  type PassiveStat,
  type PassiveTier,
  type PickOption,
} from '../game/passives';
import type { GameState } from '../game/state';
import { createShow, setFlag } from './dom';

/** Text parts shared by Inventory → Passives, the pick panel and the stats window. */

export const tierLabel = (t: PassiveTier): string => ITEM_TIER_LABEL[t];

/** Fraction as percent with up to 2 decimals: 0.0075 → "0.75%". */
const pct = (v: number) => `${+(v * 100).toFixed(2)}%`;

/** "+1% attack speed" / "+2 defence" for a value of `def`. */
export function valueText(def: PassiveDef, value: number): string {
  const v = def.unit === 'percent' ? pct(value) : formatNumber(value);
  return `+${v} ${def.effect}`;
}

/** Short names of the stats, for the totals line. */
const STAT_NAME: Record<PassiveStat, string> = {
  speed: 'Attack speed',
  crit: 'Crit chance',
  defence: 'Defence',
  click: 'Click bonus',
  extra: 'Second strike',
};

/** "Attack speed +3%, Defence +4" for the owned passives; empty when there are none. */
export function totalsText(owned: readonly Passive[]): string {
  const totals = passiveTotals(owned);
  return (Object.keys(STAT_NAME) as PassiveStat[])
    .filter((stat) => totals[stat] > 0)
    .map((stat) => {
      const unit = PERCENT_STATS.has(stat) ? pct(totals[stat]) : formatNumber(totals[stat]);
      return `${STAT_NAME[stat]} +${unit}`;
    })
    .join(', ');
}
const PERCENT_STATS = new Set<PassiveStat>(['speed', 'crit', 'click', 'extra']);

/** One owned passive as text: name, tier and what its levels add. Null for an unknown id. */
export function passiveLine(
  p: Passive,
): { name: string; tier: string; total: string; short: string } | null {
  const def = passiveDef(p.id);
  if (!def) return null;
  const sum = def.values[p.tier] * p.level;
  return {
    name: def.name,
    tier: tierLabel(p.tier),
    total: valueText(def, sum),
    // Without the effect name, for the narrow stats rows: "+3%" / "+4".
    short: def.unit === 'percent' ? `+${pct(sum)}` : `+${formatNumber(sum)}`,
  };
}

/** One offered option as text, with what the player has of it and the stat total before → after. */
export function optionLine(
  o: PickOption,
  owned: readonly Passive[],
): { name: string; tier: string; value: string; owned: string; total: string } | null {
  const def = passiveDef(o.id);
  if (!def) return null;
  const have = owned.filter((p) => p.id === o.id);
  const same = have.find((p) => p.tier === o.tier);
  const before = passiveTotals(owned)[def.stat];
  const after = passiveTotals([...owned, { id: o.id, tier: o.tier, level: 1 }])[def.stat];
  const fmt = (v: number) => (def.unit === 'percent' ? pct(v) : formatNumber(v));
  return {
    name: def.name,
    tier: tierLabel(o.tier),
    value: valueText(def, def.values[o.tier]),
    owned: same
      ? `You have Lv ${same.level} at this tier: it becomes Lv ${same.level + 1}.`
      : have.length
        ? 'You have it at another tier: this is a separate entry.'
        : 'New passive.',
    total: `Total ${fmt(before)} → ${fmt(after)}`,
  };
}

/** A tier badge: a framed box with the tier letter; S+ gets the rainbow frame and sparkles. */
export function tierBadge(t: PassiveTier): string {
  if (t === 'SS') {
    return `<span class="tier tc-SS rainbow-frame rainbow-glow"><b class="rainbow">${tierLabel(t)}</b><span class="sparkle rainbow" aria-hidden="true">✦</span><span class="sparkle rainbow" aria-hidden="true">✦</span></span>`;
  }
  return `<span class="tier tc-${t}"><b>${tierLabel(t)}</b></span>`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

// ── Inventory → Passives ─────────────────────────────────────────────────────

export const PASSIVES_HTML = `
  <h3 class="gear-head">Passive skills <span class="note pas-count"></span></h3>
  <p class="note pas-hint">None yet. Beat a boss and pick one of two skills.</p>
  <ul class="list gear-list pas-list"></ul>
  <p class="pas-total"></p>
  <p class="note">Passives belong to the run. The same passive at the same tier stacks as one more level.</p>`;

export type PassivesView = { refresh(state: GameState): void };

/** Fills the Passives panel (markup: `PASSIVES_HTML`). Rebuilds the list only when it changed. */
export function createPassivesView(root: HTMLElement): PassivesView {
  const list = root.querySelector<HTMLElement>('.pas-list')!;
  const show = createShow();
  let key = '';
  return {
    refresh(s) {
      const owned = s.passives;
      show(root.querySelector('.pas-count')!, `${formatNumber(pickCount(owned))} picks`);
      setFlag(root.querySelector('.pas-hint')!, 'hidden', owned.length > 0);
      show(root.querySelector('.pas-total')!, totalsText(owned) && `Total: ${totalsText(owned)}`);
      const next = JSON.stringify(owned);
      if (next === key) return;
      key = next;
      list.innerHTML = owned
        .map((p) => {
          const line = passiveLine(p);
          if (!line) return '';
          return `<li class="item">${tierBadge(p.tier)}<div class="item-body"><span class="item-name"><span class="tc-${p.tier}"><b class="${p.tier === 'SS' ? 'tier-name rainbow' : 'tier-name'}">${esc(line.name)}</b></span> · Lv ${p.level}</span><span class="item-stats"><span>${esc(line.total)}</span></span></div></li>`;
        })
        .join('');
    },
  };
}
