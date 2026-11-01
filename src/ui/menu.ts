import { upgradeCost, weaponDamage, WEAPONS } from '../game/balance';
import { formatNumber } from '../game/format';
import { equipItem, sellItem, unequipItem } from '../game/items';
import {
  buyUpgrade,
  buyWeapon,
  canBuyWeapon,
  canUpgrade,
  equip,
  nextWeapon,
  type GameState,
} from '../game/state';
import { coinSpin, weapons as weaponSprites, type SpriteDef } from '../sprites';
import { createShow, html, setClass, setFlag } from './dom';
import { createGearView, GEAR_HTML } from './gear';
import { dialogHtml } from './modal';

// Sizes are in em so a future pixel font can change the metrics in one place.
export const MENU_STYLES = `
.menu [hidden] { display: none !important; }
.menu .panel {
  display: flex;
  flex-direction: column;
  width: min(600px, 100%);
  height: min(470px, 100%);
  padding: 0;
  overflow: hidden;
  font-size: 1.15em;
}
.menu-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 50px;
  padding: 6px 56px 6px 14px;
  border-bottom: 3px solid var(--_fg);
}
.menu-head h2 { margin: 0; font-size: 1.2em; }
.menu .close { top: 6px; right: 6px; width: 38px; height: 38px; }
.wallet { margin-left: auto; }
.price { display: inline-flex; align-items: center; gap: 0.35em; color: var(--_yellow); font-weight: bold; white-space: nowrap; }
.price img { width: 16px; height: 16px; flex: none; }
.tabs { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 3px solid var(--_fg); }
.tab {
  border: 0;
  border-right: 3px solid var(--_fg);
  padding: 8px 4px;
  min-height: 42px;
  white-space: nowrap;
}
.tab:last-child { border-right: 0; }
.tab[aria-selected='true'] { color: var(--_bg); background: var(--_fg); font-weight: bold; }
.tab:focus-visible { outline: 3px solid var(--_yellow); outline-offset: -6px; }
.tab-panels { flex: 1; overflow: auto; padding: 12px 14px; }
.tab-panels [role='tabpanel']:focus-visible { outline: 3px solid var(--_yellow); outline-offset: 2px; }
.tab-panels p { margin: 0 0 0.6em; }
.tab-panels h3 { margin: 0.4em 0 0.4em; font-size: 1em; }
.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 3px solid var(--_fg);
  padding: 6px 10px;
  min-height: 64px;
}
.item.locked { opacity: 0.5; }
.icon { flex: none; width: 48px; height: 48px; display: grid; place-items: center; }
.item-body { flex: 1; min-width: 0; display: grid; gap: 2px; }
.item-name { font-weight: bold; }
.item-stats { display: flex; flex-wrap: wrap; gap: 0 14px; }
.item .action { flex: none; display: flex; align-items: center; gap: 8px; }
.item button, .buy-row button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 6px 12px;
  min-height: 42px;
  white-space: nowrap;
}
/* Status labels are plain text so they never look like buttons. */
.tag { padding: 0 4px; font-weight: bold; white-space: nowrap; }
.tag.on { color: var(--_green); }
.dmg-next { color: var(--_green); font-weight: bold; }
.buy-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.menu button:hover:not(:disabled) .price,
.menu button:focus-visible .price { color: inherit; }
.note { opacity: 0.75; }
.list + .note { margin-top: 10px; }

/* Narrow boxes (phones): the menu fills the game box, touch-sized controls. */
@container afk-box (max-width: 767px) {
  .menu { padding: 0; }
  .menu .panel { width: 100%; height: 100%; border: 0; }
  .menu .close { width: 44px; height: 44px; top: 4px; right: 4px; }
  .menu-head { min-height: 52px; padding-right: 60px; }
  .tab, .item button, .buy-row button { min-height: 44px; min-width: 44px; }
  .tab-panels { padding: 10px; }
}
@container afk-box (max-width: 480px) {
  .tabs { grid-template-columns: repeat(2, 1fr); }
  .tab:nth-child(2) { border-right: 0; }
  .tab:nth-child(-n + 2) { border-bottom: 3px solid var(--_fg); }
  .item { flex-wrap: wrap; }
  .item:has(.action > button:not([hidden])) .action { width: 100%; }
  .item .action > button { flex: 1; }
  .buy-row button { flex: 1; }
}
`;

/** Tabs in display order. */
const TABS = [
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'shop', label: 'Weapons' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'help', label: 'Help' },
] as const;
export type MenuTab = (typeof TABS)[number]['id'];

/**
 * Upgrade amounts, one buy button each. v1 has ×1 only. Later: 10, 100 and
 * MAX (bulk cost formula in docs/PLAN.md → Weapons & upgrades), once the game
 * has a pure bulk-buy action to call.
 */
const BUY_AMOUNTS = [1] as const;

export type MenuDeps = {
  /** Applies a pure game action (purchases go through the state guards). */
  act(fn: (s: GameState) => GameState): void;
  /** Data URL of a sprite's first frame in the current palette. */
  iconUrl(def: SpriteDef): string;
};

export type Menu = {
  el: HTMLElement;
  /** What to focus when the menu opens: the selected tab. */
  readonly focusTarget: HTMLElement;
  refresh(state: GameState): void;
  /** Re-renders the pixel icons (theme change). */
  refreshIcons(): void;
  select(tab: MenuTab, focus?: boolean): void;
};

/** Icons are drawn at a whole-number scale only (pixel art). */
const ICON_SCALE = 3;

const price = (cls: string) =>
  `<span class="price"><img alt="" data-icon="coin" /><span class="${cls}"></span></span>`;

function weaponRows(cls: string, stats: string, action: (tier: number) => string): string {
  return `<ul class="list ${cls}">${WEAPONS.map(
    (w, i) => `
      <li class="item" data-tier="${i}">
        <span class="icon"><img alt="" data-icon="weapon" data-tier="${i}" /></span>
        <div class="item-body">
          <span class="item-name">${w.name}</span>
          <span class="item-stats">${stats}</span>
        </div>
        <div class="action">${action(i)}</div>
      </li>`,
  ).join('')}</ul>`;
}

const BODY = `
  <div class="menu-head">
    <h2 id="afk-menu-title">Menu</h2>
    <span class="wallet" title="Coins">${price('wallet-coins')}</span>
  </div>
  <div class="tabs" role="tablist" aria-label="Menu sections">${TABS.map(
    (t) =>
      `<button class="tab" type="button" role="tab" id="afk-tab-${t.id}" aria-controls="afk-panel-${t.id}" data-tab="${t.id}">${t.label}</button>`,
  ).join('')}</div>
  <div class="tab-panels">
    <section role="tabpanel" id="afk-panel-upgrades" aria-labelledby="afk-tab-upgrades" hidden>
      <div class="item">
        <span class="icon"><img alt="" data-icon="weapon" class="up-icon" /></span>
        <div class="item-body">
          <span class="item-name"><span class="up-name"></span> · Lv <span class="up-level"></span></span>
          <span class="item-stats"><span>Damage <span class="up-dmg"></span> → <span class="dmg-next up-next"></span></span></span>
        </div>
      </div>
      <div class="buy-row">${BUY_AMOUNTS.map(
        (n) =>
          `<button type="button" data-act="upgrade" data-amount="${n}">Upgrade ×${n} ${price('up-cost')}</button>`,
      ).join('')}</div>
      <p class="note">Upgrades raise the equipped weapon's damage. Switch weapons in Inventory.</p>
    </section>
    <section role="tabpanel" id="afk-panel-shop" aria-labelledby="afk-tab-shop" hidden>
      ${weaponRows(
        'shop-list',
        `<span class="shop-dmg"></span><span class="shop-price-text"></span>`,
        (i) =>
          `<span class="tag on shop-equipped">Equipped</span>` +
          `<button type="button" data-act="equip" data-tier="${i}" class="shop-equip">Equip</button>` +
          `<button type="button" data-act="buy" data-tier="${i}" class="shop-buy">Buy ${price('shop-price')}</button>` +
          `<span class="tag shop-locked">Locked</span>`,
      )}
    </section>
    <section role="tabpanel" id="afk-panel-inventory" aria-labelledby="afk-tab-inventory" hidden>
      ${weaponRows(
        'inv-list',
        `<span>Lv <span class="inv-level"></span></span><span><span class="inv-dmg"></span> dmg</span>`,
        (i) =>
          `<span class="tag on inv-equipped">Equipped</span>` +
          `<button type="button" data-act="equip" data-tier="${i}" class="inv-equip">Equip</button>`,
      )}
      <p class="note inv-hint">Buy more weapons in the Weapons tab.</p>
      ${GEAR_HTML}
    </section>
    <section role="tabpanel" id="afk-panel-help" aria-labelledby="afk-tab-help" tabindex="0" hidden>
      <h3>How to play</h3>
      <p>Your hunter fights one monster per stage on his own. Wins pay coins. Every 6th stage is a boss.</p>
      <p>Spend coins on <b>Upgrades</b> (more damage for the equipped weapon) and new <b>Weapons</b>. A new weapon is equipped if it hits harder; switch any time in <b>Inventory</b>.</p>
      <p>Monsters sometimes drop a <b>ring</b> or <b>pendant</b> (C, B, A or the rare S). Equip them in <b>Inventory</b> for extra damage, defence, speed or item find.</p>
      <p>If the hunter falls, he steps back one stage and auto-advance turns off. Upgrade, then turn <b>AUTO</b> back on.</p>
      <h3>Credits</h3>
      <p>Sound effects: ZzFX by Frank Force (MIT licence).<br />Music: original chiptune, synthesized in the browser.<br />Sprites: original pixel art, drawn in code.</p>
      <p class="note">browser-afk-game v${__VERSION__}</p>
    </section>
  </div>`;

/** The ☰ menu modal: upgrades, weapons shop, inventory, help & credits. */
export function createMenu(deps: MenuDeps): Menu {
  const el = html(
    dialogHtml({ kind: 'modal', id: 'afk-menu', title: '', closeLabel: 'Close menu', body: '' }),
  );
  el.classList.add('menu');
  const panel = el.querySelector<HTMLElement>('.panel')!;
  // The menu has its own header (title + coins) instead of the shell's title.
  panel.querySelector('h2')!.remove();
  panel.insertAdjacentHTML('beforeend', BODY);

  const $ = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...el.querySelectorAll<T>(sel)];
  const show = createShow();
  const tabs = $$<HTMLButtonElement>('[role="tab"]');
  const selectedTab = () => tabs.find((t) => t.dataset.tab === current)!;
  let current: MenuTab = 'upgrades';
  let last: GameState | null = null;
  const gear = createGearView($('#afk-panel-inventory'), {
    iconUrl: deps.iconUrl,
    coinUrl: () => deps.iconUrl(coinSpin),
  });

  function select(tab: MenuTab, focus = false): void {
    current = tab;
    for (const t of tabs) {
      const on = t.dataset.tab === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      setFlag($(`#${t.getAttribute('aria-controls')}`), 'hidden', !on);
    }
    if (focus) selectedTab().focus({ preventScroll: true });
    if (last) refresh(last);
  }

  // Tabs: click, ←/→ (and ↑/↓), Home/End. Roving tabindex, so Tab goes from
  // the selected tab straight into its panel.
  const KEY_STEP: Record<string, (i: number, n: number) => number> = {
    ArrowRight: (i, n) => (i + 1) % n,
    ArrowDown: (i, n) => (i + 1) % n,
    ArrowLeft: (i, n) => (i - 1 + n) % n,
    ArrowUp: (i, n) => (i - 1 + n) % n,
    Home: () => 0,
    End: (_, n) => n - 1,
  };
  el.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(e.target as HTMLButtonElement);
    const step = KEY_STEP[e.key];
    if (i < 0 || !step) return;
    e.preventDefault();
    select(tabs[step(i, tabs.length)].dataset.tab as MenuTab, true);
  });

  el.addEventListener('click', (e) => {
    const target = (e.target as Element).closest<HTMLButtonElement>('[data-tab], [data-act]');
    if (!target) return;
    if (target.dataset.tab) {
      select(target.dataset.tab as MenuTab);
      return;
    }
    switch (target.dataset.act) {
      case 'upgrade':
        deps.act(buyUpgrade);
        break;
      case 'buy':
        // Only the next weapon's button is shown; buyWeapon re-checks anyway.
        deps.act(buyWeapon);
        break;
      case 'equip':
        deps.act((s) => equip(s, Number(target.dataset.tier)));
        break;
      case 'item-equip':
        deps.act((s) => equipItem(s, Number(target.dataset.id)));
        break;
      case 'item-sell':
        deps.act((s) => sellItem(s, Number(target.dataset.id)));
        break;
      case 'item-unequip':
        deps.act((s) => unequipItem(s, target.dataset.slot === 'ring' ? 'ring' : 'pendant'));
        break;
      default:
        return;
    }
    // A button that just became disabled or hidden drops focus; keep it in the menu.
    if (!target.isConnected || target.disabled || target.closest('[hidden]'))
      selectedTab().focus({ preventScroll: true });
  });

  function setWeaponIcon(img: HTMLImageElement, tier: number): void {
    const def = weaponSprites.find((w) => w.tier === tier)?.poses.upFwd.sprite;
    if (!def) return;
    img.src = deps.iconUrl(def);
    img.width = def.width * ICON_SCALE;
    img.height = def.height * ICON_SCALE;
    img.dataset.shown = String(tier);
  }

  function refreshIcons(): void {
    const coin = deps.iconUrl(coinSpin);
    for (const img of $$<HTMLImageElement>('img[data-icon="coin"]')) img.src = coin;
    for (const img of $$<HTMLImageElement>('img[data-icon="weapon"][data-tier]')) {
      setWeaponIcon(img, Number(img.dataset.tier));
    }
    const up = $<HTMLImageElement>('.up-icon');
    if (up.dataset.shown) setWeaponIcon(up, Number(up.dataset.shown));
    gear.refreshIcons();
  }

  function refresh(state: GameState): void {
    last = state;
    show($('.wallet-coins'), formatNumber(state.coins));
    if (current === 'upgrades') refreshUpgrades(state);
    else if (current === 'shop') refreshShop(state);
    else if (current === 'inventory') refreshInventory(state);
  }

  function refreshUpgrades(state: GameState): void {
    const tier = state.equipped;
    const level = state.weaponLevels[tier];
    const icon = $<HTMLImageElement>('.up-icon');
    if (icon.dataset.shown !== String(tier)) setWeaponIcon(icon, tier);
    show($('.up-name'), WEAPONS[tier].name);
    show($('.up-level'), formatNumber(level));
    show($('.up-dmg'), formatNumber(weaponDamage(tier, level)));
    show($('.up-next'), formatNumber(weaponDamage(tier, level + 1)));
    const cost = formatNumber(upgradeCost(tier, level));
    for (const c of $$('.up-cost')) show(c, cost);
    const affordable = canUpgrade(state);
    for (const btn of $$<HTMLButtonElement>('[data-act="upgrade"]')) {
      setFlag(btn, 'disabled', !affordable);
      show(btn, affordable ? '' : 'Not enough coins', 'title');
    }
  }

  function refreshShop(state: GameState): void {
    const next = nextWeapon(state);
    const affordable = canBuyWeapon(state);
    for (const li of $$('.shop-list .item')) {
      const i = Number(li.dataset.tier);
      const w = WEAPONS[i];
      const owned = state.weaponLevels[i] >= 1;
      const isNext = i === next;
      const locked = !owned && !isNext;
      setClass(li, 'locked', locked);
      show(li.querySelector('.shop-dmg')!, `${formatNumber(w.baseDmg)} base dmg`);
      // The next weapon shows its price on the Buy button, the others as text.
      const priceText = li.querySelector('.shop-price-text')!;
      show(priceText, w.price ? `${formatNumber(w.price)} coins` : 'Starter');
      setFlag(priceText, 'hidden', isNext);
      show(li.querySelector('.shop-price')!, formatNumber(w.price));
      const equipped = i === state.equipped;
      setFlag(li.querySelector('.shop-equipped')!, 'hidden', !(owned && equipped));
      setFlag(li.querySelector('.shop-equip')!, 'hidden', !owned || equipped);
      const lockTag = li.querySelector('.shop-locked')!;
      setFlag(lockTag, 'hidden', !locked);
      show(lockTag, locked ? `Buy ${WEAPONS[i - 1].name} first` : '', 'title');
      const buy = li.querySelector<HTMLButtonElement>('.shop-buy')!;
      setFlag(buy, 'hidden', !isNext);
      setFlag(buy, 'disabled', isNext && !affordable);
      show(buy, isNext && !affordable ? 'Not enough coins' : '', 'title');
    }
  }

  function refreshInventory(state: GameState): void {
    let owned = 0;
    for (const li of $$('.inv-list .item')) {
      const i = Number(li.dataset.tier);
      const lvl = state.weaponLevels[i];
      const has = lvl >= 1;
      setFlag(li, 'hidden', !has);
      if (!has) continue;
      owned++;
      const equipped = i === state.equipped;
      show(li.querySelector('.inv-level')!, formatNumber(lvl));
      show(li.querySelector('.inv-dmg')!, formatNumber(weaponDamage(i, lvl)));
      setFlag(li.querySelector('.inv-equipped')!, 'hidden', !equipped);
      setFlag(li.querySelector('.inv-equip')!, 'hidden', equipped);
    }
    setFlag($('.inv-hint'), 'hidden', owned >= WEAPONS.length);
    gear.refresh(state);
  }

  select(current);
  return {
    el,
    get focusTarget() {
      return selectedTab();
    },
    refresh,
    refreshIcons,
    select,
  };
}
