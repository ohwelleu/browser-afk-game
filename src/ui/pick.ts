import type { GameState } from '../game/state';
import { html } from './dom';
import { dialogHtml } from './modal';
import { optionLine, tierBadge } from './passives';

/**
 * The "Choose a skill" panel shown after a stage clear. It is a locked modal
 * (`data-locked`): Esc and a click outside don't close it, only picking does.
 * The fight waits (game/state.ts freezes the duel while an offer is open).
 */
export const PICK_STYLES = `
.pick .panel { width: min(520px, 100%); }
.pick h2 { margin-right: 0; line-height: 1.3; }
.pick .close { display: none; }
.pick-options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.pick-card {
  display: grid;
  justify-items: start;
  align-content: start;
  gap: 4px;
  min-height: 44px;
  padding: 10px;
  text-align: left;
  border-color: var(--_tier, var(--_fg));
}
.pick-card .tier { margin-bottom: 4px; }
.tab-panels .pas-total { margin-top: 10px; font-weight: bold; }
.pick-name { font-weight: bold; }
.pick-value { color: var(--_green); font-weight: bold; }
.pick-card:hover:not(:disabled) .pick-value, .pick-card:focus-visible .pick-value { color: inherit; }
.pick-card .note { font-size: 0.85em; }
@container afk-box (max-width: 480px) {
  .pick { padding: 8px; }
  .pick-options { grid-template-columns: 1fr; gap: 8px; }
  .pick-card { grid-template-columns: auto 1fr; column-gap: 10px; padding: 8px; }
  .pick-card .tier { grid-row: span 4; margin: 0; }
}
`;

/** Clicks right after the panel appears are ignored, so a click on the game doesn't pick by accident. */
export const PICK_GUARD_MS = 600;

export type PickPanel = {
  el: HTMLElement;
  /** Draws the offer in `state.pick` (nothing happens if it is the one already shown). */
  refresh(state: GameState): void;
  /** The first option, where focus goes when the panel opens. */
  focusTarget(): HTMLElement | undefined;
  /** False for the first moments after the offer appeared. */
  ready(now?: number): boolean;
};

export function createPickPanel(): PickPanel {
  const el = html(
    dialogHtml({
      kind: 'modal',
      id: 'afk-pick',
      title: 'Choose a skill',
      closeLabel: '',
      body: '<p class="note pick-sub">Pick one. It stays with you for this run.</p><div class="pick-options"></div>',
    }),
  );
  el.classList.add('pick');
  el.dataset.locked = '';
  el.querySelector('.close')?.remove();
  const options = el.querySelector<HTMLElement>('.pick-options')!;
  let key = '';
  let shownAt = 0;
  return {
    el,
    refresh(state) {
      const offer = state.pick;
      const next = JSON.stringify([offer, state.passives]);
      if (next === key) return;
      if (!offer) {
        key = '';
        options.textContent = '';
        return;
      }
      if (!key) shownAt = performance.now();
      key = next;
      options.innerHTML = offer
        .map((o, i) => {
          const line = optionLine(o, state.passives);
          if (!line) return '';
          return `<button type="button" class="pick-card tc-${o.tier}" data-act="pick" data-index="${i}">${tierBadge(o.tier)}<span class="pick-name">${line.name}</span><span class="pick-value">${line.value}</span><span class="note">${line.total}</span><span class="note">${line.owned}</span></button>`;
        })
        .join('');
    },
    focusTarget: () => options.querySelector<HTMLElement>('.pick-card') ?? undefined,
    ready: (now = performance.now()) => now - shownAt >= PICK_GUARD_MS,
  };
}
