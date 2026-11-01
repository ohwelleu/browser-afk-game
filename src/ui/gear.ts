import { ITEM_SLOTS, ITEM_STATS, ITEMS, type ItemSlot, type ItemStat } from '../game/balance';
import { formatNumber } from '../game/format';
import { sellPrice, type Item } from '../game/items';
import type { GameState } from '../game/state';
import { gearIcons } from '../sprites/gear-placeholder';
import type { SpriteDef } from '../sprites';
import { createShow, setFlag } from './dom';

/**
 * Ring & pendant UI: the slots and the bag (in the menu's Inventory tab) and
 * the drop toast. Tier frames use existing accents until the palette step
 * picks the C/B/A/S colours.
 */
export const GEAR_STYLES = `
.tier { --_tier: var(--_fg); flex: none; display: grid; place-items: center; width: 40px; height: 40px; border: 3px solid var(--_tier); position: relative; }
.tier img { width: 24px; height: 24px; }
.tc-B { --_tier: var(--_green); }
.tc-A { --_tier: var(--_blue); }
.tc-S { --_tier: var(--_yellow); }
.tier.tc-S { box-shadow: 0 0 6px 1px var(--_yellow); }
.tier.tc-S::after { content: '✦'; position: absolute; top: -10px; right: -8px; color: var(--_yellow); font-size: 12px; animation: afk-sparkle 0.9s steps(2) infinite; }
@keyframes afk-sparkle { 50% { opacity: 0.2; transform: scale(0.6); } }
.tier-name { font-weight: bold; color: var(--_tier, inherit); }
.gear-head { display: flex; align-items: baseline; gap: 8px; margin-top: 1em !important; }
.gear-list .item { min-height: 56px; }
.gear-empty { opacity: 0.6; }
.toast {
  position: absolute;
  left: 50%;
  bottom: 56px;
  transform: translateX(-50%);
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100% - 24px);
  padding: 6px 12px 6px 6px;
  border: 3px solid var(--_fg);
  background: var(--_bg);
  pointer-events: none;
  transition: opacity 0.3s;
}
.toast[hidden] { display: flex; opacity: 0; }
.toast .toast-text { display: grid; }
@media (prefers-reduced-motion: reduce) {
  .tier.tc-S::after { animation: none; }
  .toast { transition: none; }
}
`;

const STAT_LABEL: Record<ItemStat, (v: number) => string> = {
  damage: (v) => `+${formatNumber(v)} dmg`,
  defence: (v) => `+${formatNumber(v)} def`,
  speed: (v) => `+${pct(v)} speed`,
  itemFind: (v) => `+${pct(v)} item find`,
};
const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;
const SLOT_NAME: Record<ItemSlot, string> = { ring: 'Ring', pendant: 'Pendant' };

export const itemName = (it: Item) => `${SLOT_NAME[it.slot]} · ${it.tier}`;
export const itemStatsText = (it: Item) =>
  ITEM_STATS.filter((s) => it.stats[s] !== undefined)
    .map((s) => STAT_LABEL[s](it.stats[s]!))
    .join(', ');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export type GearDeps = { iconUrl(def: SpriteDef): string };

/** Frame + icon for one item (or an empty slot). */
function frame(deps: GearDeps, slot: ItemSlot, it: Item | null): string {
  const cls = it ? `tier tc-${it.tier}` : 'tier gear-empty';
  return `<span class="${cls}"><img alt="" src="${deps.iconUrl(gearIcons[slot])}" /></span>`;
}

const coinPrice = (coin: string, n: number) =>
  `<span class="price"><img alt="" src="${coin}" /><span>${formatNumber(n)}</span></span>`;

/** Inventory-tab markup; `createGearView` fills it. */
export const GEAR_HTML = `
  <h3 class="gear-head">Ring &amp; pendant</h3>
  <ul class="list gear-list gear-slots"></ul>
  <h3 class="gear-head">Bag <span class="note gear-count"></span></h3>
  <ul class="list gear-list gear-bag"></ul>
  <p class="note gear-hint">Rings and pendants drop from monsters now and then (bosses more often). When the bag is full, new drops are sold.</p>`;

export type GearView = { refresh(state: GameState): void; refreshIcons(): void };

/**
 * Re-renders the slots/bag only when the items change (the menu refreshes
 * every frame while open). Buttons carry `data-act` = item-equip / item-sell /
 * item-unequip and `data-id` / `data-slot` for the menu's click handler.
 */
export function createGearView(
  root: HTMLElement,
  deps: GearDeps & { coinUrl(): string },
): GearView {
  const slots = root.querySelector<HTMLElement>('.gear-slots')!;
  const bag = root.querySelector<HTMLElement>('.gear-bag')!;
  const show = createShow();
  let key = '';

  const row = (it: Item | null, slot: ItemSlot, action: string) => `
    <li class="item">
      ${frame(deps, slot, it)}
      <div class="item-body">
        <span class="item-name ${it ? `tc-${it.tier}` : ''}"><span class="tier-name">${it ? esc(itemName(it)) : `${SLOT_NAME[slot]} · empty`}</span></span>
        <span class="item-stats">${it ? `<span>${esc(itemStatsText(it))}</span><span class="note">from ${it.world}.${it.stage}</span>` : ''}</span>
      </div>
      <div class="action">${action}</div>
    </li>`;

  function refresh(s: GameState): void {
    const g = s.items;
    const bagFull = g.bag.length >= ITEMS.inventorySize;
    const next = JSON.stringify([g.ring?.id, g.pendant?.id, g.bag.map((i) => i.id), bagFull]);
    show(root.querySelector('.gear-count')!, `${g.bag.length}/${ITEMS.inventorySize}`);
    setFlag(
      root.querySelector('.gear-hint')!,
      'hidden',
      g.bag.length > 0 || !!g.ring || !!g.pendant,
    );
    if (next === key) return;
    key = next;
    const coin = deps.coinUrl();
    slots.innerHTML = ITEM_SLOTS.map((slot) => {
      const it = g[slot];
      const btn = it
        ? `<button type="button" data-act="item-unequip" data-slot="${slot}" ${bagFull ? 'disabled title="Bag is full"' : ''}>Unequip</button>`
        : '';
      return row(it, slot, btn);
    }).join('');
    bag.innerHTML = g.bag
      .map((it) =>
        row(
          it,
          it.slot,
          `<button type="button" data-act="item-equip" data-id="${it.id}">Equip</button>` +
            `<button type="button" data-act="item-sell" data-id="${it.id}">Sell ${coinPrice(coin, sellPrice(it))}</button>`,
        ),
      )
      .join('');
  }

  return {
    refresh,
    refreshIcons() {
      key = ''; // icons are baked into the markup: rebuild on the next refresh
    },
  };
}

/** Drop toast: item icon in its tier frame, name and stats; S gets the sparkle. */
export function createToast(box: HTMLElement, deps: GearDeps, ms = 3000) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.hidden = true;
  box.append(el);
  let timer = 0;
  return {
    show(it: Item, soldFor: number) {
      const line = soldFor
        ? `Bag full: sold for ${formatNumber(soldFor)} coins`
        : esc(itemStatsText(it));
      el.innerHTML = `${frame(deps, it.slot, it)}<span class="toast-text"><span class="tc-${it.tier}"><b class="tier-name">${esc(itemName(it))}</b></span><span>${line}</span></span>`;
      el.hidden = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => (el.hidden = true), ms);
    },
    destroy() {
      window.clearTimeout(timer);
      el.remove();
    },
  };
}
