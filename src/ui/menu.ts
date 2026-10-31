import { upgradeCost, weaponDamage, WEAPONS } from '../game/balance';
import { formatNumber } from '../game/format';
import {
  buyUpgrade,
  buyWeapon,
  canBuyWeapon,
  canUpgrade,
  equip,
  nextWeapon,
  type GameState,
} from '../game/state';
import { createShow, html } from './dom';
import { dialogHtml } from './modal';

export const MENU_STYLES = `
.panel h3 { margin: 14px 0 6px; font-size: 14px; border-bottom: 3px solid var(--_fg); }
.inv { list-style: none; margin: 0; padding: 0; }
`;

export type MenuDeps = {
  /** Applies a pure game action (purchases go through the state guards). */
  act(fn: (s: GameState) => GameState): void;
};

export type Menu = { el: HTMLElement; refresh(state: GameState): void };

/** The ☰ menu modal: upgrades, weapons shop, inventory, help & credits. */
export function createMenu(deps: MenuDeps): Menu {
  const el = html(
    dialogHtml({
      kind: 'modal',
      id: 'afk-menu',
      title: 'Menu',
      closeLabel: 'Close menu',
      body: `
        <h3>Upgrades</h3>
        <div class="row"><span class="up-info"></span><button type="button" data-act="upgrade"></button></div>
        <h3>Weapons</h3>
        <div class="row"><span class="shop-info"></span><button type="button" data-act="buy"></button></div>
        <h3>Inventory</h3>
        <ul class="inv">${WEAPONS.map(
          (_, i) =>
            `<li class="row"><span class="inv-info"></span><button type="button" data-act="equip" data-tier="${i}"></button></li>`,
        ).join('')}</ul>
        <h3>Help &amp; credits</h3>
        <p>Your hunter duels one monster per stage and attacks on his own. Wins pay coins. Spend them on damage upgrades and new weapons. Every 6th stage is a boss. If the hunter falls, he steps back one stage and auto-advance turns off: upgrade, then turn it back on.</p>
        <p class="muted">browser-afk-game v${__VERSION__} · Sound effects: ZzFX by Frank Force (MIT)</p>`,
    }),
  );
  const $ = <T extends Element = HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const show = createShow();

  el.addEventListener('click', (e) => {
    const target = (e.target as Element).closest<HTMLElement>('[data-act]');
    switch (target?.dataset.act) {
      case 'upgrade':
        deps.act(buyUpgrade);
        return;
      case 'buy':
        deps.act(buyWeapon);
        return;
      case 'equip':
        deps.act((s) => equip(s, Number(target.dataset.tier)));
        return;
    }
  });

  function refresh(state: GameState): void {
    const tier = state.equipped;
    const level = state.weaponLevels[tier];
    const w = WEAPONS[tier];
    show(
      $('.up-info'),
      `${w.name} Lv ${level}: ${formatNumber(weaponDamage(tier, level))} → ${formatNumber(weaponDamage(tier, level + 1))} dmg`,
    );
    const up = $<HTMLButtonElement>('[data-act="upgrade"]');
    show(up, `Upgrade · ● ${formatNumber(upgradeCost(tier, level))}`);
    up.disabled = !canUpgrade(state);

    const nextTier = nextWeapon(state);
    const buy = $<HTMLButtonElement>('[data-act="buy"]');
    if (nextTier === null) {
      show($('.shop-info'), 'You own every weapon.');
      buy.hidden = true;
    } else {
      const nw = WEAPONS[nextTier];
      show($('.shop-info'), `${nw.name}: ${formatNumber(nw.baseDmg)} dmg at Lv 1`);
      show(buy, `Buy · ● ${formatNumber(nw.price)}`);
      buy.hidden = false;
      buy.disabled = !canBuyWeapon(state);
    }

    el.querySelectorAll<HTMLLIElement>('.inv li').forEach((li, i) => {
      const lvl = state.weaponLevels[i];
      const owned = lvl >= 1;
      li.classList.toggle('muted', !owned);
      show(
        li.querySelector('.inv-info')!,
        owned
          ? `${WEAPONS[i].name} · Lv ${lvl} · ${formatNumber(weaponDamage(i, lvl))} dmg`
          : `${WEAPONS[i].name} · not owned`,
      );
      const btn = li.querySelector('button')!;
      btn.hidden = !owned;
      show(btn, i === state.equipped ? 'Equipped' : 'Equip');
      btn.disabled = i === state.equipped;
    });
  }

  return { el, refresh };
}
