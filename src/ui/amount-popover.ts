/**
 * Buy amount picker: one small button next to each Buy / Upgrade button shows
 * the shared amount (`×10 ▾`); it opens one small popover where the player
 * picks ×1, ×10, ×100 or MAX. Only one popover exists and it moves to the
 * button that opened it.
 */
import { BUY_AMOUNTS, type BuyAmount } from '../game/balance';

export const AMOUNT_STYLES = `
.menu .amount-btn { flex: none; min-width: 0; gap: 6px; padding: 6px 8px; }
.amount-btn svg { width: 10px; height: 6px; flex: none; shape-rendering: crispEdges; }
.amount-btn[aria-expanded='true'] { color: var(--_bg); background: var(--_fg); }
.amount-btn:focus-visible, .amount-opt:focus-visible { outline: 3px solid var(--_yellow); outline-offset: 2px; }
/* Crow upgrades: the amount button and its bulk button stay together when the row wraps. */
.bulk { display: inline-flex; gap: 4px; min-width: max-content; }
.amount-pop {
  position: absolute;
  z-index: 3;
  display: grid;
  gap: 4px;
  min-width: 96px;
  padding: 6px;
  background: var(--_bg);
  border: 3px solid var(--_fg);
}
.amount-opt { min-height: 38px; padding: 4px 12px; text-align: center; white-space: nowrap; }
.amount-opt[aria-checked='true'] { color: var(--_bg); background: var(--_fg); font-weight: bold; }
@container afk-box (max-width: 767px) {
  .amount-opt { min-height: 44px; min-width: 44px; }
}
@container afk-box (max-width: 480px) {
  .menu .item .action > .amount-btn { flex: none; }
  /* Content-sized so the row wraps instead of squeezing the labels. */
  .menu .buy-row > button { flex: 1 1 auto; }
  .buy-row .bulk { flex: 1 1 auto; }
  .buy-row .bulk > button { flex: 1 1 auto; }
  .buy-row .bulk > .amount-btn { flex: none; }
}
`;

export const amountLabel = (a: BuyAmount): string => (a === 'max' ? 'MAX' : `×${a}`);

/** A tiny down-pointing pixel caret (5×3), drawn in the text colour. */
const CARET = `<svg viewBox="0 0 5 3" aria-hidden="true" focusable="false"><path fill="currentColor" d="M0 0h5v1h-5zM1 1h3v1h-3zM2 2h1v1h-1z"/></svg>`;

/** The per-row amount button. Its label is filled by `sync`. */
export const AMOUNT_BUTTON = `<button type="button" class="amount-btn" data-act="amount-menu" aria-haspopup="true" aria-expanded="false"><span class="amount-label">${amountLabel(BUY_AMOUNTS[0])}</span>${CARET}</button>`;

/** The one shared popover (hidden until a row's amount button opens it). */
export const AMOUNT_POPOVER = `<div class="amount-pop" role="menu" aria-label="Buy amount" hidden>${BUY_AMOUNTS.map(
  (a) =>
    `<button type="button" class="amount-opt" role="menuitemradio" aria-checked="false" data-act="amount" data-amount="${a}">${amountLabel(a)}</button>`,
).join('')}</div>`;

export type Rect = { left: number; top: number; right: number; bottom: number };

/**
 * Where to put a popover of `size` for `anchor`, in the coordinates of
 * `bounds` (the menu box). Right edges line up, then it is clamped into the
 * bounds. It opens below the button, or above when there is no room below.
 */
export function placePopover(
  anchor: Rect,
  bounds: Rect,
  size: { width: number; height: number },
  gap = 4,
  margin = 4,
): { left: number; top: number; above: boolean } {
  const maxLeft = bounds.right - margin - size.width;
  const left = Math.max(bounds.left + margin, Math.min(anchor.right - size.width, maxLeft));
  const roomBelow = bounds.bottom - margin - (anchor.bottom + gap);
  const roomAbove = anchor.top - gap - (bounds.top + margin);
  const above = roomBelow < size.height && roomAbove > roomBelow;
  const wanted = above ? anchor.top - gap - size.height : anchor.bottom + gap;
  const maxTop = bounds.bottom - margin - size.height;
  const top = Math.max(bounds.top + margin, Math.min(wanted, maxTop));
  return { left: left - bounds.left, top: top - bounds.top, above };
}

/** Arrow-key target inside the open list (wraps), or null for other keys. */
export function optionStep(key: string, index: number, count: number): number | null {
  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return (index + 1) % count;
    case 'ArrowUp':
    case 'ArrowLeft':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** Parses a `data-amount` value; anything unknown falls back to ×1. */
export function parseAmount(v: string | undefined): BuyAmount {
  return BUY_AMOUNTS.find((a) => String(a) === v) ?? BUY_AMOUNTS[0];
}

export type AmountPopover = {
  isOpen(): boolean;
  /** Opens at `btn`, or closes when it is already open there. */
  toggle(btn: HTMLElement): void;
  close(restoreFocus?: boolean): void;
  /** Updates every amount button and the popover's checked option. */
  sync(amount: BuyAmount): void;
};

/**
 * `menu` is the menu root (key and click events bubble to it) and `pop` the
 * popover inside `panel`. Picking an option is handled by the menu's click
 * handler (`data-act="amount"`), which closes the popover.
 */
export function createAmountPopover(o: {
  menu: HTMLElement;
  /** The positioned box (`position: relative`) the popover sits in. */
  panel: HTMLElement;
  pop: HTMLElement;
}): AmountPopover {
  const { menu, panel, pop } = o;
  const options = () => [...pop.querySelectorAll<HTMLButtonElement>('.amount-opt')];
  let opener: HTMLElement | null = null;
  let current: BuyAmount = BUY_AMOUNTS[0];

  function close(restoreFocus = true): void {
    if (!opener) return;
    const was = opener;
    opener = null;
    pop.hidden = true;
    was.setAttribute('aria-expanded', 'false');
    if (restoreFocus && was.isConnected && !was.closest('[hidden]')) {
      was.focus({ preventScroll: true });
    }
  }

  function place(anchor: HTMLElement): void {
    const host = panel;
    const hr = host.getBoundingClientRect();
    // Positions are relative to the padding box (inside the border).
    const bounds = {
      left: hr.left + host.clientLeft,
      top: hr.top + host.clientTop,
      right: hr.left + host.clientLeft + host.clientWidth,
      bottom: hr.top + host.clientTop + host.clientHeight,
    };
    const p = placePopover(anchor.getBoundingClientRect(), bounds, {
      width: pop.offsetWidth,
      height: pop.offsetHeight,
    });
    pop.style.left = `${p.left}px`;
    pop.style.top = `${p.top}px`;
  }

  function toggle(btn: HTMLElement): void {
    if (opener === btn) {
      close();
      return;
    }
    close(false);
    opener = btn;
    btn.setAttribute('aria-expanded', 'true');
    pop.hidden = false;
    place(btn);
    const opts = options();
    (opts.find((b) => b.getAttribute('aria-checked') === 'true') ?? opts[0])?.focus({
      preventScroll: true,
    });
  }

  function sync(amount: BuyAmount): void {
    current = amount;
    const label = amountLabel(current);
    for (const b of menu.querySelectorAll<HTMLElement>('.amount-btn')) {
      const l = b.querySelector('.amount-label')!;
      if (l.textContent !== label) l.textContent = label;
      b.setAttribute('aria-label', `Buy amount: ${label}`);
    }
    for (const b of options()) {
      b.setAttribute('aria-checked', String(b.dataset.amount === String(current)));
    }
    // A row whose button went away (hidden, re-rendered) takes the popover with it.
    if (opener && (!opener.isConnected || opener.closest('[hidden]'))) close(false);
  }

  menu.addEventListener('click', (e) => {
    if (!opener) return;
    const t = e.target as Element;
    // Option picks are handled by the menu (data-act="amount"); the button toggles itself.
    if (pop.contains(t) || t.closest('.amount-btn')) return;
    close(false);
  });

  menu.addEventListener('keydown', (e) => {
    if (!opener) return;
    if (e.key === 'Escape') {
      // Only the popover closes, not the whole menu.
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Tab') {
      // Focus back on the button, then Tab moves on from there.
      close();
      return;
    }
    const opts = options();
    const i = opts.indexOf(e.target as HTMLButtonElement);
    const next = i < 0 ? null : optionStep(e.key, i, opts.length);
    if (next !== null) {
      e.preventDefault();
      opts[next].focus({ preventScroll: true });
    }
  });

  // The popover does not follow scrolling content: close it instead.
  menu.addEventListener('scroll', () => close(false), true);

  // The menu closing (Esc, [X], click outside) takes the popover with it.
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(() => {
      if (menu.hidden) close(false);
    }).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  }

  return {
    isOpen: () => opener !== null,
    toggle,
    close,
    sync,
  };
}
