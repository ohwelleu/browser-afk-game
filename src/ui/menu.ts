import {
  companionAutoInterval,
  companionDamage,
  companionMaxSpeedLevel,
  COMPANIONS,
  STAGES_PER_WORLD,
  upgradeCost,
  weaponDamage,
  WEAPONS,
  type CompanionDef,
} from '../game/balance';
import { formatNumber } from '../game/format';
import { equipItem, sellItem, unequipItem } from '../game/items';
import {
  buyCompanion,
  buyUpgrade,
  buyWeapon,
  canBuyCompanion,
  canUpgrade,
  canUpgradeCompanion,
  canBuyWeapon,
  companionDef,
  companionUpgradeCost,
  equip,
  shopCompanion,
  upgradeCompanion,
  type CompanionUpgrade,
  nextWeapon,
  type GameState,
} from '../game/state';
import { coinSpin, crowIcon, weapons as weaponSprites, type SpriteDef } from '../sprites';
import { createShow, html, setClass, setFlag } from './dom';
import { createGearView, GEAR_HTML } from './gear';
import { dialogHtml } from './modal';
import { createSavePanel, type SavePanelDeps } from './save-panel';

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
.tabs { display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; border-bottom: 3px solid var(--_fg); }
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
/* Sub tabs: a row of smaller framed buttons at the top of a panel. */
.subtabs { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
.subtabs .subtab { flex: 1 1 0; min-width: max-content; padding: 4px 8px; min-height: 38px; white-space: nowrap; }
.subtab[aria-selected='true'] { color: var(--_bg); background: var(--_fg); font-weight: bold; }
.subtab:focus-visible { outline: 3px solid var(--_yellow); outline-offset: 2px; }
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
.soon { margin-top: 1.5em !important; text-align: center; font-weight: bold; }

/* Narrow boxes (phones): the menu fills the game box, touch-sized controls. */
@container afk-box (max-width: 767px) {
  .menu { padding: 0; }
  .menu .panel { width: 100%; height: 100%; border: 0; }
  .menu .close { width: 44px; height: 44px; top: 4px; right: 4px; }
  .menu-head { min-height: 52px; padding-right: 60px; }
  .tab, .subtab, .item button, .buy-row button { min-height: 44px; min-width: 44px; }
  .tab-panels { padding: 10px; }
}
@container afk-box (max-width: 480px) {
  .item { flex-wrap: wrap; }
  .item:has(.action > button:not([hidden])) .action { width: 100%; }
  .item .action > button { flex: 1; }
  .buy-row button { flex: 1; }
}
`;

/** Tabs in display order; `subs` are the sub tabs inside that tab. */
const TABS = [
  {
    id: 'shop',
    label: 'Shop',
    subs: [
      { id: 'weapons', label: 'Weapons' },
      { id: 'companions', label: 'Companions' },
      { id: 'ascend', label: 'Ascend' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    subs: [
      { id: 'weapons', label: 'Weapons' },
      { id: 'companions', label: 'Companions' },
      { id: 'accessories', label: 'Accessories' },
    ],
  },
  { id: 'help', label: 'Help', subs: [] },
] as const;
export type MenuTab = (typeof TABS)[number]['id'];

/**
 * Upgrade amounts, one buy button each. v1 has ×1 only. Later: 10, 100 and
 * MAX (bulk cost formula in docs/PLAN.md → Weapons & upgrades), once the game
 * has a pure bulk-buy action to call.
 */
const BUY_AMOUNTS = [1] as const;

/** "1.1" for stage level 1, "2.1" for level 7. */
export function stageName(level: number): string {
  const l = Math.max(1, Math.floor(level));
  return `${Math.floor((l - 1) / STAGES_PER_WORLD) + 1}.${((l - 1) % STAGES_PER_WORLD) + 1}`;
}

/** Lock text for a companion: `unlockLevel` is reached by clearing the level before it. */
export const companionUnlockText = (def: Pick<CompanionDef, 'unlockLevel'>) =>
  `Unlocks after clearing ${stageName(def.unlockLevel - 1)}`;

export type MenuDeps = {
  /** Applies a pure game action (purchases go through the state guards). */
  act(fn: (s: GameState) => GameState): void;
  /** Data URL of a sprite's first frame in the current palette. */
  iconUrl(def: SpriteDef): string;
  /** Save export/import in Help. */
  save: SavePanelDeps;
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

const subId = (tab: string, sub: string) => `afk-sub-${tab}-${sub}`;
const subPanelId = (tab: string, sub: string) => `afk-subpanel-${tab}-${sub}`;

/** A tab panel with its sub tab row; `content` maps sub id → panel markup. */
function panelWithSubs(tab: (typeof TABS)[number], content: Record<string, string>): string {
  const subs = tab.subs.map(
    (s) =>
      `<button class="subtab" type="button" role="tab" id="${subId(tab.id, s.id)}" aria-controls="${subPanelId(tab.id, s.id)}" data-sub="${s.id}">${s.label}</button>`,
  );
  const panels = tab.subs.map(
    (s) =>
      `<div role="tabpanel" id="${subPanelId(tab.id, s.id)}" aria-labelledby="${subId(tab.id, s.id)}" data-sub-panel="${s.id}" hidden>${content[s.id]}</div>`,
  );
  return `
    <section role="tabpanel" id="afk-panel-${tab.id}" aria-labelledby="afk-tab-${tab.id}" hidden>
      <div class="subtabs" role="tablist" aria-label="${tab.label} sections" data-subtabs="${tab.id}">${subs.join('')}</div>
      ${panels.join('')}
    </section>`;
}

const companionIcon = `<span class="icon"><img alt="" data-icon="companion" /></span>`;

const SHOP = {
  weapons: weaponRows(
    'shop-list',
    `<span class="shop-dmg"></span><span class="shop-price-text"></span>`,
    (i) =>
      `<span class="tag on shop-equipped">Equipped</span>` +
      `<span class="tag on shop-owned">Owned</span>` +
      `<button type="button" data-act="buy" data-tier="${i}" class="shop-buy">Buy ${price('shop-price')}</button>` +
      `<span class="tag shop-locked">Locked</span>`,
  ),
  companions: `
    <ul class="list"><li class="item comp-shop">
      ${companionIcon}
      <div class="item-body">
        <span class="item-name">${COMPANIONS.crow.name}</span>
        <span class="item-stats"><span>Pecks the mob when you click or tap</span></span>
        <span class="note comp-unlock"></span>
      </div>
      <div class="action">
        <span class="tag on comp-owned">Owned</span>
        <button type="button" data-act="buy-companion" class="comp-buy">Buy ${price('comp-price')}</button>
        <span class="tag comp-locked">Locked</span>
      </div>
    </li></ul>
    <p class="note comp-shop-hint" hidden>Upgrade your companion in Inventory → Companions.</p>`,
  ascend: `
    <p class="soon">Coming soon</p>
    <p class="note">Ascend will let you start over with a permanent bonus.</p>`,
};

const INVENTORY = {
  weapons: `${weaponRows(
    'inv-list',
    `<span>Lv <span class="inv-level"></span></span><span>Damage <span class="inv-dmg"></span><span class="inv-next-wrap"> → <span class="dmg-next inv-next"></span></span></span>`,
    (i) =>
      `<span class="tag on inv-equipped">Equipped</span>` +
      `<button type="button" data-act="equip" data-tier="${i}" class="inv-equip">Equip</button>` +
      BUY_AMOUNTS.map(
        (n) =>
          `<button type="button" data-act="upgrade" data-amount="${n}" class="inv-upgrade">Upgrade ×${n} ${price('inv-cost')}</button>`,
      ).join(''),
  )}
    <p class="note">Upgrades raise the equipped weapon's damage. Equip a weapon to upgrade it.</p>
    <p class="note inv-hint">Buy more weapons in Shop → Weapons.</p>`,
  companions: `
    <h3>Companion slot</h3>
    <p class="inv-comp-empty">Empty. Companions are sold in Shop → Companions.</p>
    <div class="comp-up" hidden>
      <div class="item">
        ${companionIcon}
        <div class="item-body">
          <span class="item-name"><span class="comp-name"></span> · Lv <span class="comp-level"></span> <span class="tag on">Equipped</span></span>
          <span class="item-stats">
            <span>Damage <span class="comp-dmg"></span> → <span class="dmg-next comp-next"></span></span>
            <span class="comp-auto"></span>
          </span>
        </div>
      </div>
      <div class="buy-row">
        <button type="button" data-act="comp-up" data-kind="dmg">Damage +1 ${price('comp-cost-dmg')}</button>
        <button type="button" data-act="comp-up" data-kind="auto">Auto attack ${price('comp-cost-auto')}</button>
        <button type="button" data-act="comp-up" data-kind="speed"><span class="comp-speed-label">Faster</span> ${price('comp-cost-speed')}</button>
      </div>
    </div>`,
  accessories: GEAR_HTML,
};

const HELP = `
    <section role="tabpanel" id="afk-panel-help" aria-labelledby="afk-tab-help" tabindex="0" hidden>
      <h3>How to play</h3>
      <p>Your hunter fights one monster per stage on his own. Wins pay coins. Every 6th stage is a boss.</p>
      <p>Buy new weapons in the <b>Shop</b>. A new weapon is equipped if it hits harder. In <b>Inventory</b> you switch weapons and upgrade the equipped one for more damage.</p>
      <p>Monsters sometimes drop a <b>ring</b> or <b>pendant</b> (C, B, A or the rare S). Equip them in <b>Inventory → Accessories</b> for extra damage, defence, speed or item find.</p>
      <p>Clear stage ${stageName(COMPANIONS.crow.unlockLevel - 1)} to unlock the <b>crow</b> in <b>Shop → Companions</b>. Click or tap anywhere on the game to make it peck the monster.</p>
      <p>If the hunter falls, he steps back one stage and auto-advance turns off. Upgrade, then turn <b>AUTO</b> back on.</p>
      <div class="save-slot"></div>
      <h3>Credits</h3>
      <p>Sound effects: ZzFX by Frank Force (MIT licence).<br />Music: original chiptune, synthesized in the browser.<br />Sprites: original pixel art, drawn in code.</p>
      <p class="note">browser-afk-game v${__VERSION__}</p>
    </section>`;

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
    ${panelWithSubs(TABS[0], SHOP)}
    ${panelWithSubs(TABS[1], INVENTORY)}
    ${HELP}
  </div>`;

/** Roving-tabindex steps for a tab row: ←/→ (and ↑/↓), Home/End. */
const KEY_STEP: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

/** The ☰ menu modal: shop, inventory (with upgrades), help & credits. */
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
  const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = el) => [
    ...root.querySelectorAll<T>(sel),
  ];
  const show = createShow();
  const tabs = $$<HTMLButtonElement>('.tabs [role="tab"]');
  const selectedTab = () => tabs.find((t) => t.dataset.tab === current)!;
  let current: MenuTab = 'shop';
  /** Selected sub tab per tab (kept while switching tabs). */
  const currentSub: Record<string, string> = Object.fromEntries(
    TABS.flatMap((t) => (t.subs.length ? [[t.id, t.subs[0]!.id]] : [])),
  );
  let last: GameState | null = null;
  const gear = createGearView($(`#${subPanelId('inventory', 'accessories')}`), {
    iconUrl: deps.iconUrl,
    coinUrl: () => deps.iconUrl(coinSpin),
  });

  const savePanel = createSavePanel(deps.save);
  $('.save-slot').replaceWith(savePanel.el);

  const subTabsOf = (tab: string) => $$<HTMLButtonElement>(`[data-subtabs="${tab}"] [role="tab"]`);

  function selectSub(tab: string, sub: string, focus = false): void {
    currentSub[tab] = sub;
    for (const t of subTabsOf(tab)) {
      const on = t.dataset.sub === sub;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      setFlag($(`#${t.getAttribute('aria-controls')}`), 'hidden', !on);
      if (on && focus) t.focus({ preventScroll: true });
    }
    if (last) refresh(last);
  }

  function select(tab: MenuTab, focus = false): void {
    current = tab;
    for (const t of tabs) {
      const on = t.dataset.tab === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      setFlag($(`#${t.getAttribute('aria-controls')}`), 'hidden', !on);
    }
    if (focus) selectedTab().focus({ preventScroll: true });
    if (tab === 'help') savePanel.refresh();
    if (last) refresh(last);
  }

  // Tabs and sub tabs: click, ←/→ (and ↑/↓), Home/End. Roving tabindex, so
  // Tab goes from the selected tab to the selected sub tab, then into the panel.
  el.addEventListener('keydown', (e) => {
    const step = KEY_STEP[e.key];
    const target = e.target as HTMLButtonElement;
    if (!step || target.getAttribute('role') !== 'tab') return;
    const i = tabs.indexOf(target);
    if (i >= 0) {
      e.preventDefault();
      select(tabs[step(i, tabs.length)].dataset.tab as MenuTab, true);
      return;
    }
    const row = target.closest<HTMLElement>('[data-subtabs]');
    if (!row) return;
    const subs = subTabsOf(row.dataset.subtabs!);
    const j = subs.indexOf(target);
    e.preventDefault();
    selectSub(row.dataset.subtabs!, subs[step(j, subs.length)].dataset.sub!, true);
  });

  /** Where focus goes when a clicked button disappears: the selected sub tab, else the tab. */
  function focusFallback(): void {
    const sub = subTabsOf(current).find((t) => t.dataset.sub === currentSub[current]);
    (sub ?? selectedTab()).focus({ preventScroll: true });
  }

  el.addEventListener('click', (e) => {
    const target = (e.target as Element).closest<HTMLButtonElement>(
      '[data-tab], [data-sub], [data-act]',
    );
    if (!target) return;
    if (target.dataset.tab) {
      select(target.dataset.tab as MenuTab);
      return;
    }
    if (target.dataset.sub) {
      const row = target.closest<HTMLElement>('[data-subtabs]')!;
      selectSub(row.dataset.subtabs!, target.dataset.sub);
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
      case 'buy-companion':
        deps.act(buyCompanion);
        break;
      case 'comp-up':
        deps.act((s) => upgradeCompanion(s, target.dataset.kind as CompanionUpgrade));
        break;
      default:
        return;
    }
    // A button that just became disabled or hidden drops focus; keep it in the menu.
    if (!target.isConnected || target.disabled || target.closest('[hidden]')) focusFallback();
  });

  function setWeaponIcon(img: HTMLImageElement, tier: number): void {
    const def = weaponSprites.find((w) => w.tier === tier)?.poses.upFwd.sprite;
    if (!def) return;
    img.src = deps.iconUrl(def);
    img.width = def.width * ICON_SCALE;
    img.height = def.height * ICON_SCALE;
  }

  function refreshIcons(): void {
    const coin = deps.iconUrl(coinSpin);
    for (const img of $$<HTMLImageElement>('img[data-icon="coin"]')) img.src = coin;
    for (const img of $$<HTMLImageElement>('img[data-icon="weapon"][data-tier]')) {
      setWeaponIcon(img, Number(img.dataset.tier));
    }
    for (const img of $$<HTMLImageElement>('img[data-icon="companion"]')) {
      img.src = deps.iconUrl(crowIcon);
      img.width = crowIcon.width * ICON_SCALE;
      img.height = crowIcon.height * ICON_SCALE;
    }
    gear.refreshIcons();
  }

  function refresh(state: GameState): void {
    last = state;
    show($('.wallet-coins'), formatNumber(state.coins));
    const sub = currentSub[current];
    if (current === 'shop') {
      if (sub === 'weapons') refreshShopWeapons(state);
      else if (sub === 'companions') refreshShopCompanions(state);
    } else if (current === 'inventory') {
      if (sub === 'weapons') refreshInventoryWeapons(state);
      else if (sub === 'companions') refreshCompanionUpgrades(state);
      else if (sub === 'accessories') gear.refresh(state);
    }
  }

  function refreshShopWeapons(state: GameState): void {
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
      setFlag(li.querySelector('.shop-owned')!, 'hidden', !owned || equipped);
      const lockTag = li.querySelector('.shop-locked')!;
      setFlag(lockTag, 'hidden', !locked);
      show(lockTag, locked ? `Buy ${WEAPONS[i - 1].name} first` : '', 'title');
      const buy = li.querySelector<HTMLButtonElement>('.shop-buy')!;
      setFlag(buy, 'hidden', !isNext);
      setFlag(buy, 'disabled', isNext && !affordable);
      show(buy, isNext && !affordable ? 'Not enough coins' : '', 'title');
    }
  }

  function refreshShopCompanions(state: GameState): void {
    const def = COMPANIONS.crow;
    const offer = shopCompanion(state);
    const owned = state.companion !== null;
    const locked = !owned && !offer;
    setClass($('.comp-shop'), 'locked', locked);
    setFlag($('.comp-owned'), 'hidden', !owned);
    setFlag($('.comp-locked'), 'hidden', !locked);
    setFlag($('.comp-shop-hint'), 'hidden', !owned);
    const unlock = $('.comp-unlock');
    show(unlock, companionUnlockText(def));
    setFlag(unlock, 'hidden', !locked);
    const buyComp = $<HTMLButtonElement>('.comp-buy');
    setFlag(buyComp, 'hidden', !offer);
    show($('.comp-price'), formatNumber(def.price));
    const canComp = canBuyCompanion(state);
    setFlag(buyComp, 'disabled', !canComp);
    show(buyComp, offer && !canComp ? 'Not enough coins' : '', 'title');
  }

  function refreshInventoryWeapons(state: GameState): void {
    let owned = 0;
    const affordable = canUpgrade(state);
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
      setFlag(li.querySelector('.inv-next-wrap')!, 'hidden', !equipped);
      setFlag(li.querySelector('.inv-equipped')!, 'hidden', !equipped);
      setFlag(li.querySelector('.inv-equip')!, 'hidden', equipped);
      for (const btn of $$<HTMLButtonElement>('.inv-upgrade', li)) {
        setFlag(btn, 'hidden', !equipped);
        if (!equipped) continue;
        setFlag(btn, 'disabled', !affordable);
        show(btn, affordable ? '' : 'Not enough coins', 'title');
      }
      if (!equipped) continue;
      show(li.querySelector('.inv-next')!, formatNumber(weaponDamage(i, lvl + 1)));
      for (const c of $$('.inv-cost', li)) show(c, formatNumber(upgradeCost(i, lvl)));
    }
    setFlag($('.inv-hint'), 'hidden', owned >= WEAPONS.length);
  }

  function refreshCompanionUpgrades(state: GameState): void {
    const c = state.companion;
    const def = companionDef(state);
    setFlag($('.comp-up'), 'hidden', !c || !def);
    setFlag($('.inv-comp-empty'), 'hidden', !!c && !!def);
    if (!c || !def) return;
    show($('.comp-name'), def.name);
    show($('.comp-level'), formatNumber(c.dmgLevel));
    show($('.comp-dmg'), formatNumber(companionDamage(def, c.dmgLevel)));
    show($('.comp-next'), formatNumber(companionDamage(def, c.dmgLevel + 1)));
    const interval = companionAutoInterval(def, c.speedLevel).toFixed(1);
    show($('.comp-auto'), c.autoUnlocked ? `Auto every ${interval} s` : 'Auto attack: locked');
    const maxed = c.speedLevel >= companionMaxSpeedLevel(def);
    show($('.comp-speed-label'), maxed ? 'Fastest' : 'Faster');
    for (const btn of $$<HTMLButtonElement>('[data-act="comp-up"]')) {
      const kind = btn.dataset.kind as CompanionUpgrade;
      const cost = companionUpgradeCost(state, kind);
      setFlag(
        btn,
        'hidden',
        (kind === 'auto' && c.autoUnlocked) || (kind === 'speed' && !c.autoUnlocked),
      );
      setFlag(btn.querySelector('.price')!, 'hidden', cost === null);
      if (cost !== null) show(btn.querySelector(`.comp-cost-${kind}`)!, formatNumber(cost));
      const ok = canUpgradeCompanion(state, kind);
      setFlag(btn, 'disabled', !ok);
      show(btn, ok || cost === null ? '' : 'Not enough coins', 'title');
    }
  }

  for (const t of TABS) if (t.subs.length) selectSub(t.id, currentSub[t.id]);
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
