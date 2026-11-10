import { crowUnlockLevel, nextRun, questStep, type QuestRun, type QuestStep } from '../game/quest';
import type { GameState } from '../game/state';
import { reducedCss } from '../motion';
import { createShow, setClass, setFlag } from './dom';
import { stageName } from './menu';

/**
 * Starter quest line: a small button under the stage label that names the
 * current step and opens Shop → Companions. The menu button and the
 * Companions sub tab pulse while a step is open (no pulse when the
 * Animations setting is Reduced, just a static frame). The rules are in game/quest.ts.
 */
export const QUEST_STYLES = `
.quest {
  position: absolute;
  top: 44px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  max-width: calc(100% - 24px);
}
.quest[hidden] { display: none; }
.quest-btn { display: block; max-width: 100%; padding: 4px 10px; text-align: left; font-size: var(--afk-fs-small, 0.85em); }
.quest-btn.done { color: var(--_bg); background: var(--_green); border-color: var(--_green); }
.quest-sub { display: block; opacity: 0.7; }
.quest-hint { outline: 3px solid var(--_yellow); outline-offset: 2px; }
.quest-hint { animation: afk-quest-pulse 1.2s steps(2) infinite; }
${reducedCss('.quest-hint')} { animation: none; }
@keyframes afk-quest-pulse { 50% { outline-color: transparent; } }
@container (max-width: 767px) {
  .quest { top: 112px; left: 12px; right: 70px; transform: none; max-width: none; }
  .quest-btn { min-height: 44px; width: 100%; }
}
`;

type Line = { text: string; sub: string };

/** What the quest line says for each step. */
export function questText(step: QuestStep): Line {
  if (step === 'unlock') {
    return {
      text: `Quest: clear stage ${stageName(crowUnlockLevel)} to unlock the crow`,
      sub: '',
    };
  }
  return {
    text: step === 'buy' ? 'Quest: buy the crow to start clicking' : 'Quest: upgrade the crow',
    sub: 'Menu → Shop → Companions',
  };
}

/** The short confirmation shown when a step is done, or null (nothing finished). */
export function doneText(from: QuestStep | null, to: QuestStep | null): string | null {
  if (from === 'buy' && to === 'upgrade') return '✓ Crow bought! Click anywhere to peck';
  if (from === 'upgrade' && to === null) return '✓ Crow upgraded! Quest complete';
  return null;
}

export type Quest = {
  el: HTMLElement;
  refresh(state: GameState): void;
  destroy(): void;
};

/**
 * The menu button and the shop's Companions sub tab (found in `menuEl`) pulse
 * while a step can be acted on.
 */
export function createQuest(
  box: HTMLElement,
  menuButton: HTMLElement,
  menuEl: HTMLElement,
  ms = 2500,
): Quest {
  const el = document.createElement('div');
  el.className = 'quest';
  el.setAttribute('role', 'status'); // announces each new step politely
  el.hidden = true;
  el.innerHTML = `<button class="quest-btn" type="button" data-act="quest" aria-haspopup="dialog"><span class="quest-text"></span><span class="quest-sub"></span></button>`;
  box.append(el);
  const btn = el.querySelector<HTMLElement>('.quest-btn')!;
  const textEl = el.querySelector<HTMLElement>('.quest-text')!;
  const subEl = el.querySelector<HTMLElement>('.quest-sub')!;
  const show = createShow();

  let run: QuestRun = 'unseen';
  let step: QuestStep | null = null;
  let flash: string | null = null;
  let timer = 0;

  function render(): void {
    const line = flash ? { text: flash, sub: '' } : step ? questText(step) : null;
    setFlag(el, 'hidden', !line);
    setClass(btn, 'done', flash !== null);
    show(textEl, line?.text ?? '');
    show(subEl, line?.sub ?? '');
    setFlag(subEl, 'hidden', !line?.sub);
    // Pulse only when the player can act: the crow is in the shop, or owned and not upgraded.
    const hint = step === 'buy' || step === 'upgrade';
    const sub = menuEl.querySelector<HTMLElement>('[data-subtabs="shop"] [data-sub="companions"]');
    setClass(menuButton, 'quest-hint', hint);
    if (sub) setClass(sub, 'quest-hint', hint);
  }

  return {
    el,
    refresh(s) {
      run = nextRun(run, questStep(s));
      const next = run === 'on' ? questStep(s) : null;
      if (next !== step) {
        const msg = doneText(step, next);
        step = next;
        if (msg) {
          flash = msg;
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            flash = null;
            render();
          }, ms);
        }
      }
      render();
    },
    destroy() {
      window.clearTimeout(timer);
      setClass(menuButton, 'quest-hint', false);
      el.remove();
    },
  };
}
