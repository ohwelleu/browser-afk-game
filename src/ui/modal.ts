/**
 * Shared modal / popover helper. One dialog open at a time inside the game
 * box, a square [X] close button, Esc, click outside, a focus trap, and focus
 * goes back to the button that opened it.
 */

export const MODAL_STYLES = `
/* Dialog layouts respond to the game box width, not the page. */
.box { container: afk-box / inline-size; }
.modal {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background: color-mix(in srgb, var(--_bg) 60%, transparent);
}
.modal[hidden], .popover[hidden] { display: none; }
/* Popover, under the top-right HUD buttons */
.popover {
  position: absolute;
  top: 58px;
  right: 12px;
  z-index: 2;
  width: min(300px, calc(100% - 24px));
}
.popover .panel { width: 100%; }
.panel {
  position: relative;
  width: min(560px, 100%);
  max-height: 100%;
  overflow: auto;
  background: var(--_bg);
  border: 3px solid var(--_fg);
  padding: 14px 16px;
}
.panel h2 { margin: 0 44px 8px 0; font-size: 1.15em; }
.panel p { margin: 4px 0; }
.close { position: absolute; top: 8px; right: 8px; width: 34px; height: 34px; padding: 0; font-weight: bold; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 0; }
.row button { padding: 3px 10px; white-space: nowrap; }
@container afk-box (max-width: 767px) {
  .close { width: 44px; height: 44px; top: 4px; right: 4px; }
  .panel h2 { margin-right: 52px; line-height: 44px; }
  .row button { min-height: 44px; min-width: 64px; }
}
`;

export type DialogKind = 'modal' | 'popover';

/** Markup for a dialog shell: backdrop/positioner, panel, title and [X]. */
export function dialogHtml(o: {
  kind: DialogKind;
  id: string;
  title: string;
  closeLabel: string;
  body: string;
}): string {
  const modal = o.kind === 'modal' ? ' aria-modal="true"' : '';
  return `
    <div class="${o.kind}" role="dialog"${modal} aria-labelledby="${o.id}-title" hidden>
      <div class="panel">
        <h2 id="${o.id}-title">${o.title}</h2>
        <button class="close" type="button" data-act="close" aria-label="${o.closeLabel}">X</button>
        ${o.body}
      </div>
    </div>`;
}

type Open = { el: HTMLElement; opener: HTMLElement };

const FOCUSABLE = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export class Dialogs {
  private current: Open | null = null;

  constructor(
    private readonly root: ShadowRoot,
    private readonly box: HTMLElement,
  ) {
    box.addEventListener('keydown', this.onKeyDown);
    box.addEventListener('click', this.onClick);
    box.addEventListener('scroll', this.onScroll);
  }

  isOpen(el: HTMLElement): boolean {
    return this.current?.el === el;
  }

  /** Opens `el` (closing any other dialog) and focuses `focus` or its [X]. */
  open(el: HTMLElement, opener: HTMLElement, focus?: HTMLElement): void {
    this.close(false);
    el.hidden = false;
    this.current = { el, opener };
    (focus ?? el.querySelector<HTMLElement>('.close'))?.focus({ preventScroll: true });
  }

  close(restoreFocus = true): void {
    const cur = this.current;
    if (!cur) return;
    cur.el.hidden = true;
    this.current = null;
    if (restoreFocus) cur.opener.focus({ preventScroll: true });
  }

  toggle(el: HTMLElement, opener: HTMLElement): void {
    if (this.isOpen(el)) this.close();
    else this.open(el, opener);
  }

  destroy(): void {
    this.box.removeEventListener('keydown', this.onKeyDown);
    this.box.removeEventListener('click', this.onClick);
    this.box.removeEventListener('scroll', this.onScroll);
    this.current = null;
  }

  // The box clips its content and never scrolls, but the browser scrolls it
  // anyway to reveal a focused element that overflows (e.g. a HUD button on a
  // narrow screen), which shifts the dialogs sideways. Undo that.
  private readonly onScroll = (): void => {
    this.box.scrollLeft = 0;
    this.box.scrollTop = 0;
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.current) return;
    const dialog = this.current.el;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const list = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !(el as HTMLButtonElement).disabled && !el.closest('[hidden]') && el.tabIndex >= 0,
      );
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = this.root.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  };

  private readonly onClick = (e: MouseEvent): void => {
    const cur = this.current;
    if (!cur) return;
    const target = e.target as Element;
    // Content that re-rendered under the click is still "inside".
    if (!target.isConnected) return;
    const panel = cur.el.querySelector('.panel')!;
    if (panel.contains(target)) {
      if (target.closest('[data-act="close"]')) this.close();
      return;
    }
    // A click outside the panel (and not on its opener, which toggles) closes it.
    if (!cur.opener.contains(target)) this.close(false);
  };
}
