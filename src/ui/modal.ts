/**
 * Shared modal / popover helper. One dialog open at a time inside the game
 * box, a square [X] close button, Esc, click outside, a focus trap, and focus
 * goes back to the button that opened it.
 */

export const MODAL_STYLES = `
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
.panel h2 { margin: 0 40px 8px 0; font-size: 16px; }
.panel p { margin: 4px 0; }
.close { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; padding: 0; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 0; }
.row button { padding: 3px 10px; white-space: nowrap; }
.muted { opacity: 0.6; }
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

type Open = { el: HTMLElement; opener: HTMLElement; onClose?: () => void };

const FOCUSABLE = 'button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export class Dialogs {
  private current: Open | null = null;

  constructor(
    private readonly root: ShadowRoot,
    private readonly box: HTMLElement,
  ) {
    box.addEventListener('keydown', this.onKeyDown);
    box.addEventListener('click', this.onClick);
  }

  /** The open dialog element, or null. */
  get openEl(): HTMLElement | null {
    return this.current?.el ?? null;
  }

  isOpen(el: HTMLElement): boolean {
    return this.current?.el === el;
  }

  open(
    el: HTMLElement,
    opener: HTMLElement,
    opts: { focus?: HTMLElement | null; onClose?: () => void } = {},
  ): void {
    this.close(false);
    el.hidden = false;
    this.current = { el, opener, onClose: opts.onClose };
    (opts.focus ?? el.querySelector<HTMLElement>('.close'))?.focus();
  }

  close(restoreFocus = true): void {
    const cur = this.current;
    if (!cur) return;
    cur.el.hidden = true;
    this.current = null;
    cur.onClose?.();
    if (restoreFocus) cur.opener.focus();
  }

  toggle(el: HTMLElement, opener: HTMLElement): void {
    if (this.isOpen(el)) this.close();
    else this.open(el, opener);
  }

  destroy(): void {
    this.box.removeEventListener('keydown', this.onKeyDown);
    this.box.removeEventListener('click', this.onClick);
    this.current = null;
  }

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
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
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
