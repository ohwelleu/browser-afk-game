import {
  companionAutoInterval,
  companionDamage,
  companionMaxSpeedLevel,
  COMPANIONS,
  defenceFromLevel,
  defenceReduction,
  STAGES_PER_WORLD,
  weaponDamage,
  WEAPONS,
  type BuyAmount,
  type CompanionDef,
} from '../game/balance';
import { formatNumber } from '../game/format';
import { equipItem, sellItem, unequipItem } from '../game/items';
import {
  buyCompanion,
  buyUpgrades,
  heroDefence,
  buyWeapon,
  canBuyCompanion,
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
  upgradeQuote,
  type UpgradeTarget,
} from '../game/state';
import { hiddenWeaponCount } from '../game/reveal';
import { coinSpin, crowIcon, weapons as weaponSprites, type SpriteDef } from '../sprites';
import { createShow, html, setClass, setFlag } from './dom';
import { createGearView, GEAR_HTML } from './gear';
import {
  AMOUNT_BUTTON,
  AMOUNT_POPOVER,
  AMOUNT_STYLES,
  amountLabel,
  createAmountPopover,
  parseAmount,
} from './amount-popover';
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
/* Help: a pixel (i) toggle next to [X], same size as [X], 44 px on phones. */
.help-btn { flex: none; display: grid; place-items: center; width: 38px; height: 38px; padding: 0; }
.help-btn svg { width: 16px; height: 16px; shape-rendering: crispEdges; }
.help-btn[aria-pressed='true'] { color: var(--_bg); background: var(--_fg); }
.help-btn:focus-visible { outline: 3px solid var(--_yellow); outline-offset: 2px; }
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
.icon { flex: none; width: 56px; height: 56px; display: grid; place-items: center; }
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
${AMOUNT_STYLES}.menu button:hover:not(:disabled) .price,
.menu button:focus-visible .price { color: inherit; }
.note { opacity: 0.75; }
.list + .note { margin-top: 10px; }
.soon { margin-top: 1.5em !important; text-align: center; font-weight: bold; }

/* Narrow boxes (phones): the menu fills the game box, touch-sized controls. */
@container afk-box (max-width: 767px) {
  .menu { padding: 0; }
  .menu .panel { width: 100%; height: 100%; border: 0; }
  .menu .close { width: 44px; height: 44px; top: 4px; right: 4px; }
  .help-btn { width: 44px; height: 44px; }
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
      { id: 'character', label: 'Character' },
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
] as const;
export const MENU_TABS: readonly string[] = TABS.map((t) => t.id);
/** A tab, or the Help view (opened with the (i) button, not a tab). */
export type MenuTab = (typeof TABS)[number]['id'] | 'help';
type TabId = (typeof TABS)[number]['id'];

/** The Help icon: a pixel circle with an "i", 11×11, one string per row. */
export const HELP_ICON = [
  '...#####...',
  '.##.....##.',
  '.#...#...#.',
  '#.........#',
  '#...##....#',
  '#....#....#',
  '#....#....#',
  '#...###...#',
  '.#.......#.',
  '.##.....##.',
  '...#####...',
];

/** An SVG of 1×1 squares for each '#', drawn in the text colour. */
export function pixelSvg(rows: readonly string[]): string {
  const rects = rows.flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '#' ? [`M${x} ${y}h1v1h-1z`] : [])),
  );
  const w = Math.max(...rows.map((r) => r.length));
  return `<svg viewBox="0 0 ${w} ${rows.length}" aria-hidden="true" focusable="false"><path fill="currentColor" d="${rects.join('')}"/></svg>`;
}

/** A bulk buy button: label, level count (`.buy-n`) and total price (`.buy-cost`). */
const bulkButton = (label: string, attrs: string) =>
  `<button type="button" ${attrs}>${label} <span class="buy-n"></span> ${price('buy-cost')}</button>`;

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
/** Icon box size in CSS px (`.icon`). Sprites are scaled by whole numbers to fit it. */
const ICON_BOX = 56;

/** Largest whole-number scale (≤ ICON_SCALE, ≥ 1) at which the sprite fits the icon box. */
export const iconScale = (def: Pick<SpriteDef, 'width' | 'height'>): number =>
  Math.max(1, Math.min(ICON_SCALE, Math.floor(ICON_BOX / Math.max(def.width, def.height))));

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

/**
 * Shop → Character rows: one coin upgrade each. HP and speed become new
 * entries here (markup and refresh are generic).
 */
type CharacterRow = {
  id: string;
  name: string;
  level(s: GameState): number;
  /** Stat now → after one more level, and the effect line. */
  stat(s: GameState): { now: string; next: string; effect: string };
  target: UpgradeTarget;
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

const CHARACTER_ROWS: readonly CharacterRow[] = [
  {
    id: 'defence',
    name: 'Defence',
    level: (s) => s.character.defenceLevel,
    stat: (s) => {
      const now = heroDefence(s);
      const next =
        now +
        defenceFromLevel(s.character.defenceLevel + 1) -
        defenceFromLevel(s.character.defenceLevel);
      return {
        now: formatNumber(now),
        next: formatNumber(next),
        effect: `Mob hits −${pct(defenceReduction(now))} → −${pct(defenceReduction(next))}`,
      };
    },
    target: { type: 'defence' },
  },
];

const companionIcon = `<span class="icon"><img alt="" data-icon="companion" /></span>`;

/** Crow stats line (Shop and Inventory fill it the same way). */
const companionStats = (next: boolean) =>
  `<span>Damage <span class="comp-dmg"></span>${next ? ' → <span class="dmg-next comp-next"></span>' : ''}</span><span class="comp-auto"></span>`;

export const SHOP = {
  character: `
    <ul class="list">${CHARACTER_ROWS.map(
      (r) => `
      <li class="item" data-char="${r.id}">
        <div class="item-body">
          <span class="item-name">${r.name} · Lv <span class="char-level"></span></span>
          <span class="item-stats">
            <span>${r.name} <span class="char-now"></span> → <span class="dmg-next char-next"></span></span>
            <span class="char-effect"></span>
          </span>
        </div>
        <div class="action">
          ${AMOUNT_BUTTON}${bulkButton('Buy', `data-act="buy-char" data-char="${r.id}"`)}
        </div>
      </li>`,
    ).join('')}</ul>
    <p class="note">Defence from rings and pendants counts too. A hit always does at least 1.</p>`,
  weapons: `${weaponRows(
    'shop-list',
    `<span class="shop-dmg"></span><span class="shop-price-text"></span>` +
      `<span class="shop-lv">Lv <span class="shop-level"></span></span>` +
      `<span class="shop-up-dmg">Damage <span class="shop-cur"></span> → <span class="dmg-next shop-next"></span></span>`,
    (i) =>
      `<span class="tag on shop-equipped">Equipped</span>` +
      `<button type="button" data-act="buy" data-tier="${i}" class="shop-buy">Buy ${price('shop-price')}</button>` +
      AMOUNT_BUTTON +
      bulkButton('Upgrade', `data-act="upgrade" data-tier="${i}" class="shop-upgrade"`) +
      `<span class="tag shop-locked">Locked</span>`,
  )}
    <p class="note">Upgrades raise a weapon's damage, equipped or not. Switch weapons in Inventory → Weapons.</p>
    <p class="note shop-more" hidden>More weapons appear as you earn coins.</p>`,
  companions: `
    <ul class="list"><li class="item comp-shop">
      ${companionIcon}
      <div class="item-body">
        <span class="item-name">${COMPANIONS.crow.name}</span>
        <span class="item-stats comp-pitch"><span>Pecks the mob when you click or tap</span></span>
        <span class="item-stats comp-stats" hidden>${companionStats(true)}</span>
        <span class="note comp-unlock"></span>
      </div>
      <div class="action">
        <span class="tag on comp-owned">Owned · Lv <span class="comp-level"></span></span>
        <button type="button" data-act="buy-companion" class="comp-buy">Buy ${price('comp-price')}</button>
        <span class="tag comp-locked">Locked</span>
      </div>
    </li></ul>
    <div class="comp-up" hidden>
      <h3>Upgrades</h3>
      <div class="buy-row">
        <span class="bulk">${AMOUNT_BUTTON}${bulkButton('Damage', 'data-act="comp-up" data-kind="dmg"')}</span>
        <button type="button" data-act="comp-up" data-kind="auto">Auto attack ${price('comp-cost-auto')}</button>
        <span class="bulk">${AMOUNT_BUTTON}${bulkButton('<span class="comp-speed-label">Faster</span>', 'data-act="comp-up" data-kind="speed"')}</span>
      </div>
    </div>`,
  ascend: `
    <p class="soon">Coming soon</p>
    <p class="note">Ascend will let you start over with a permanent bonus.</p>`,
};

export const INVENTORY = {
  weapons: `${weaponRows(
    'inv-list',
    `<span>Lv <span class="inv-level"></span></span><span>Damage <span class="inv-dmg"></span></span>`,
    (i) =>
      `<span class="tag on inv-equipped">Equipped</span>` +
      `<button type="button" data-act="equip" data-tier="${i}" class="inv-equip">Equip</button>`,
  )}
    <p class="note">Upgrade weapons in Shop → Weapons.</p>
    <p class="note inv-hint">Buy more weapons in Shop → Weapons.</p>`,
  companions: `
    <h3>Companion slot</h3>
    <p class="inv-comp-empty">Empty. Companions are sold in Shop → Companions.</p>
    <div class="inv-comp" hidden>
      <ul class="list"><li class="item">
        ${companionIcon}
        <div class="item-body">
          <span class="item-name"><span class="comp-name"></span> · Lv <span class="comp-level"></span> <span class="tag on">Equipped</span></span>
          <span class="item-stats">${companionStats(false)}</span>
        </div>
      </li></ul>
      <p class="note">Upgrade your companion in Shop → Companions.</p>
    </div>`,
  accessories: GEAR_HTML,
};

const HELP = `
    <section role="region" id="afk-panel-help" aria-label="Help" tabindex="0" hidden>
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
    <button class="help-btn" type="button" data-act="help" aria-label="Help" aria-controls="afk-panel-help" aria-pressed="false">${pixelSvg(HELP_ICON)}</button>
  </div>
  <div class="tabs" role="tablist" aria-label="Menu sections">${TABS.map(
    (t) =>
      `<button class="tab" type="button" role="tab" id="afk-tab-${t.id}" aria-controls="afk-panel-${t.id}" data-tab="${t.id}">${t.label}</button>`,
  ).join('')}</div>
  <div class="tab-panels">
    ${panelWithSubs(TABS[0], SHOP)}
    ${panelWithSubs(TABS[1], INVENTORY)}
    ${HELP}
  </div>
  ${AMOUNT_POPOVER}`;

/** Roving-tabindex steps for a tab row: ←/→ (and ↑/↓), Home/End. */
const KEY_STEP: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowDown: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  ArrowUp: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

/** The ☰ menu modal: shop (with upgrades), inventory; the (i) button shows help & credits. */
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
  const helpBtn = $<HTMLButtonElement>('.help-btn');
  const helpPanel = $('#afk-panel-help');
  let current: MenuTab = 'shop';
  /** The last selected tab; it keeps the roving tabindex while Help is shown. */
  let lastTab: TabId = 'shop';
  const selectedTab = () => tabs.find((t) => t.dataset.tab === lastTab)!;
  /** Selected sub tab per tab (kept while switching tabs). */
  const currentSub: Record<string, string> = Object.fromEntries(
    TABS.flatMap((t) => (t.subs.length ? [[t.id, t.subs[0]!.id]] : [])),
  );
  let last: GameState | null = null;
  /** Chosen buy amount (UI state only, back to ×1 on reload). */
  let amount: BuyAmount = 1;
  const gear = createGearView($(`#${subPanelId('inventory', 'accessories')}`), {
    iconUrl: deps.iconUrl,
    coinUrl: () => deps.iconUrl(coinSpin),
  });

  const amountPop = createAmountPopover({ menu: el, panel, pop: $('.amount-pop') });

  const savePanel = createSavePanel(deps.save);
  $('.save-slot').replaceWith(savePanel.el);

  const subTabsOf = (tab: string) => $$<HTMLButtonElement>(`[data-subtabs="${tab}"] [role="tab"]`);

  function selectSub(tab: string, sub: string, focus = false): void {
    amountPop.close(false);
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

  function select(view: MenuTab, focus = false): void {
    amountPop.close(false);
    current = view;
    const help = view === 'help';
    if (!help) lastTab = view;
    for (const t of tabs) {
      const on = t.dataset.tab === view;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = t.dataset.tab === lastTab ? 0 : -1;
      setFlag($(`#${t.getAttribute('aria-controls')}`), 'hidden', !on);
    }
    setFlag(helpPanel, 'hidden', !help);
    helpBtn.setAttribute('aria-pressed', String(help));
    if (focus) selectedTab().focus({ preventScroll: true });
    if (help) savePanel.refresh();
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
      case 'help':
        // Toggles: a second press goes back to the last tab.
        select(current === 'help' ? lastTab : 'help');
        return;
      case 'amount-menu':
        amountPop.toggle(target);
        return;
      case 'amount':
        // Picking closes the popover (focus goes back to the button) and updates every row.
        amount = parseAmount(target.dataset.amount);
        amountPop.close();
        if (last) refresh(last);
        return;
      case 'upgrade': {
        const a = amount;
        deps.act((s) => buyUpgrades(s, { type: 'weapon', tier: Number(target.dataset.tier) }, a));
        break;
      }
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
      case 'buy-char': {
        const row = CHARACTER_ROWS.find((r) => r.id === target.dataset.char);
        const a = amount;
        if (row) deps.act((s) => buyUpgrades(s, row.target, a));
        break;
      }
      case 'buy-companion':
        deps.act(buyCompanion);
        break;
      case 'comp-up': {
        const kind = target.dataset.kind as CompanionUpgrade;
        const a = amount;
        deps.act((s) =>
          kind === 'auto'
            ? upgradeCompanion(s, kind)
            : buyUpgrades(s, { type: 'companion', kind }, a),
        );
        break;
      }
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
    const scale = iconScale(def);
    img.width = def.width * scale;
    img.height = def.height * scale;
  }

  function refreshIcons(): void {
    const coin = deps.iconUrl(coinSpin);
    for (const img of $$<HTMLImageElement>('img[data-icon="coin"]')) img.src = coin;
    for (const img of $$<HTMLImageElement>('img[data-icon="weapon"][data-tier]')) {
      setWeaponIcon(img, Number(img.dataset.tier));
    }
    for (const img of $$<HTMLImageElement>('img[data-icon="companion"]')) {
      img.src = deps.iconUrl(crowIcon);
      img.width = crowIcon.width * iconScale(crowIcon);
      img.height = crowIcon.height * iconScale(crowIcon);
    }
    gear.refreshIcons();
  }

  /**
   * Fills a bulk buy button for the chosen amount. MAX with nothing affordable
   * shows the next level's price; a capped upgrade shows no price.
   */
  function setBulkButton(btn: HTMLButtonElement, state: GameState, t: UpgradeTarget): void {
    const q = upgradeQuote(state, t, amount);
    const shown = q.levels > 0 ? q : upgradeQuote(state, t, 1);
    const ok = q.levels > 0 && state.coins >= q.cost;
    show(
      btn.querySelector('.buy-n')!,
      q.levels > 0 ? `×${formatNumber(q.levels)}` : amountLabel(amount),
    );
    show(btn.querySelector('.buy-cost')!, formatNumber(shown.cost));
    setFlag(btn.querySelector('.price')!, 'hidden', shown.levels === 0);
    setFlag(btn.querySelector('.buy-n')!, 'hidden', shown.levels === 0);
    setFlag(btn, 'disabled', !ok);
    show(btn, ok || shown.levels === 0 ? '' : 'Not enough coins', 'title');
  }

  function refresh(state: GameState): void {
    last = state;
    show($('.wallet-coins'), formatNumber(state.coins));
    const sub = currentSub[current];
    if (current === 'shop') {
      if (sub === 'character') refreshShopCharacter(state);
      else if (sub === 'weapons') refreshShopWeapons(state);
      else if (sub === 'companions') refreshShopCompanions(state);
    } else if (current === 'inventory') {
      if (sub === 'weapons') refreshInventoryWeapons(state);
      else if (sub === 'companions') refreshInventoryCompanion(state);
      else if (sub === 'accessories') gear.refresh(state);
    }
    syncAmountButtons();
    amountPop.sync(amount);
  }

  /** An amount button shows only while the bulk button next to it does. */
  function syncAmountButtons(): void {
    for (const b of $$('.amount-btn')) {
      const gone = !!((b.nextElementSibling as HTMLElement | null)?.hidden ?? true);
      setFlag(b, 'hidden', gone);
      if (b.parentElement?.classList.contains('bulk')) setFlag(b.parentElement, 'hidden', gone);
    }
  }

  function refreshShopCharacter(state: GameState): void {
    for (const r of CHARACTER_ROWS) {
      const li = $(`li[data-char="${r.id}"]`);
      const st = r.stat(state);
      show(li.querySelector('.char-level')!, formatNumber(r.level(state)));
      show(li.querySelector('.char-now')!, st.now);
      show(li.querySelector('.char-next')!, st.next);
      show(li.querySelector('.char-effect')!, st.effect);
      setBulkButton(li.querySelector<HTMLButtonElement>('[data-act="buy-char"]')!, state, r.target);
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
      // Weapons only show up near their price (game/reveal.ts); hidden ones say nothing.
      setFlag(li, 'hidden', state.revealedWeapons[i] !== true);
      setClass(li, 'locked', locked);
      // Owned weapons show level and damage → next next to their Upgrade
      // button; the others show base damage and price.
      const dmg = li.querySelector('.shop-dmg')!;
      show(dmg, `${formatNumber(w.baseDmg)} base dmg`);
      setFlag(dmg, 'hidden', owned);
      // The next weapon shows its price on the Buy button, the others as text.
      const priceText = li.querySelector('.shop-price-text')!;
      show(priceText, w.price ? `${formatNumber(w.price)} coins` : 'Starter');
      setFlag(priceText, 'hidden', isNext || owned);
      show(li.querySelector('.shop-price')!, formatNumber(w.price));
      setFlag(li.querySelector('.shop-lv')!, 'hidden', !owned);
      setFlag(li.querySelector('.shop-up-dmg')!, 'hidden', !owned);
      const upgrade = li.querySelector<HTMLButtonElement>('.shop-upgrade')!;
      setFlag(upgrade, 'hidden', !owned);
      if (owned) {
        const lvl = state.weaponLevels[i];
        show(li.querySelector('.shop-level')!, formatNumber(lvl));
        show(li.querySelector('.shop-cur')!, formatNumber(weaponDamage(i, lvl)));
        show(li.querySelector('.shop-next')!, formatNumber(weaponDamage(i, lvl + 1)));
        setBulkButton(upgrade, state, { type: 'weapon', tier: i });
      }
      const equipped = i === state.equipped;
      setFlag(li.querySelector('.shop-equipped')!, 'hidden', !(owned && equipped));
      const lockTag = li.querySelector('.shop-locked')!;
      setFlag(lockTag, 'hidden', !locked);
      show(lockTag, locked ? `Buy ${WEAPONS[i - 1].name} first` : '', 'title');
      const buy = li.querySelector<HTMLButtonElement>('.shop-buy')!;
      setFlag(buy, 'hidden', !isNext);
      setFlag(buy, 'disabled', isNext && !affordable);
      show(buy, isNext && !affordable ? 'Not enough coins' : '', 'title');
    }
    setFlag($('.shop-more'), 'hidden', hiddenWeaponCount(state) === 0);
  }

  function refreshShopCompanions(state: GameState): void {
    const def = COMPANIONS.crow;
    const offer = shopCompanion(state);
    const owned = state.companion !== null;
    const locked = !owned && !offer;
    setClass($('.comp-shop'), 'locked', locked);
    setFlag($('.comp-owned'), 'hidden', !owned);
    setFlag($('.comp-locked'), 'hidden', !locked);
    const unlock = $('.comp-unlock');
    show(unlock, companionUnlockText(def));
    setFlag(unlock, 'hidden', !locked);
    const buyComp = $<HTMLButtonElement>('.comp-buy');
    setFlag(buyComp, 'hidden', !offer);
    show($('.comp-price'), formatNumber(def.price));
    const canComp = canBuyCompanion(state);
    setFlag(buyComp, 'disabled', !canComp);
    show(buyComp, offer && !canComp ? 'Not enough coins' : '', 'title');
    refreshCompanionUpgrades(state);
  }

  function refreshInventoryWeapons(state: GameState): void {
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
  }

  /** Crow level, damage (→ next, if shown) and auto line inside `root`. */
  function fillCompanionStats(root: HTMLElement, state: GameState): void {
    const c = state.companion;
    const def = companionDef(state);
    if (!c || !def) return;
    const q = (sel: string) => root.querySelector<HTMLElement>(sel);
    const name = q('.comp-name');
    if (name) show(name, def.name);
    show(q('.comp-level')!, formatNumber(c.dmgLevel));
    show(q('.comp-dmg')!, formatNumber(companionDamage(def, c.dmgLevel)));
    const next = q('.comp-next');
    if (next) show(next, formatNumber(companionDamage(def, c.dmgLevel + 1)));
    const interval = companionAutoInterval(def, c.speedLevel).toFixed(1);
    show(q('.comp-auto')!, c.autoUnlocked ? `Auto every ${interval} s` : 'Auto attack: locked');
  }

  function refreshInventoryCompanion(state: GameState): void {
    const has = !!state.companion && !!companionDef(state);
    setFlag($('.inv-comp'), 'hidden', !has);
    setFlag($('.inv-comp-empty'), 'hidden', has);
    if (has) fillCompanionStats($('.inv-comp'), state);
  }

  /** Shop → Companions once the crow is bought: its stats and upgrade buttons. */
  function refreshCompanionUpgrades(state: GameState): void {
    const c = state.companion;
    const def = companionDef(state);
    const has = !!c && !!def;
    setFlag($('.comp-up'), 'hidden', !has);
    setFlag($('.comp-pitch'), 'hidden', has);
    setFlag($('.comp-stats'), 'hidden', !has);
    if (!c || !def) return;
    fillCompanionStats($('.comp-shop'), state);
    const maxed = c.speedLevel >= companionMaxSpeedLevel(def);
    show($('.comp-speed-label'), maxed ? 'Fastest' : 'Faster');
    for (const btn of $$<HTMLButtonElement>('[data-act="comp-up"]')) {
      const kind = btn.dataset.kind as CompanionUpgrade;
      setFlag(
        btn,
        'hidden',
        (kind === 'auto' && c.autoUnlocked) || (kind === 'speed' && !c.autoUnlocked),
      );
      if (kind !== 'auto') {
        setBulkButton(btn, state, { type: 'companion', kind });
        continue;
      }
      const cost = companionUpgradeCost(state, kind);
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
      return current === 'help' ? helpBtn : selectedTab();
    },
    refresh,
    refreshIcons,
    select,
  };
}
