import { crowUnlockLevel, nextRun, questStep, type QuestRun, type QuestStep } from '../game/quest';
import type { GameState } from '../game/state';
import { reducedCss } from '../motion';
import { createShow, setClass, setFlag } from './dom';
import { pixelSvg, stageName } from './menu';

/** The arrow, pointing right (the tip is the middle of the right edge). One char = ARROW_SIZE / 8 px. */
const ARROW_ROWS = [
  '...#....',
  '...##...',
  '#######.',
  '########',
  '#######.',
  '...##...',
  '...#....',
];
/** The arrow's square box in px (it is rotated inside it, so every side takes the same room). */
export const ARROW_SIZE = 32;
const ARROW_GAP = 4;

/**
 * Starter quest line: a small button under the stage label that names the
 * current step and opens Shop → Companions. A bouncing pixel arrow points at
 * what to tap next: the menu button, the Shop tab, the Companions sub tab,
 * then the crow's Buy / Upgrade button. It bounces in 2 steps; with the
 * Animations setting on Reduced it stands still. The rules are in game/quest.ts.
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
.quest-arrow {
  position: absolute;
  z-index: 3;
  width: ${ARROW_SIZE}px;
  height: ${ARROW_SIZE}px;
  display: grid;
  place-items: center;
  color: var(--_yellow);
  pointer-events: none;
  animation: afk-quest-bounce 0.8s steps(1) infinite;
}
.quest-arrow[hidden] { display: none; }
.quest-arrow svg { width: ${ARROW_SIZE}px; height: ${(ARROW_SIZE * ARROW_ROWS.length) / ARROW_ROWS[0].length}px; display: block; }
.quest-arrow.left { --dx: 1; --dy: 0; rotate: 0deg; }
.quest-arrow.right { --dx: -1; --dy: 0; rotate: 180deg; }
.quest-arrow.above { --dx: 0; --dy: 1; rotate: 90deg; }
.quest-arrow.below { --dx: 0; --dy: -1; rotate: -90deg; }
${reducedCss('.quest-arrow')} { animation: none; }
@keyframes afk-quest-bounce { 50% { translate: calc(var(--dx) * 4px) calc(var(--dy) * 4px); } }
@container (max-width: 767px) {
  .quest { top: 112px; left: 12px; right: 70px; transform: none; max-width: none; }
  .quest-btn { min-height: 44px; width: 100%; }
}
`;

type Rect = { left: number; top: number; width: number; height: number };
export type ArrowSide = 'left' | 'right' | 'above' | 'below';
export type ArrowPlacement = { side: ArrowSide; left: number; top: number };

/**
 * Where the arrow goes, relative to `box`: on the first of `prefer` where it
 * fits inside the box, next to `target` and pointing at it (`left` = to the
 * left of the target, pointing right). If no side fits it takes the first one
 * and is clamped into the box, so it never leaves the screen.
 */
export function arrowPlacement(
  target: Rect,
  box: Rect,
  prefer: readonly ArrowSide[] = ['left', 'right', 'below', 'above'],
): ArrowPlacement {
  const t = { left: target.left - box.left, top: target.top - box.top };
  const centreX = t.left + (target.width - ARROW_SIZE) / 2;
  const centreY = t.top + (target.height - ARROW_SIZE) / 2;
  const at = (side: ArrowSide): { left: number; top: number } => {
    if (side === 'left') return { left: t.left - ARROW_GAP - ARROW_SIZE, top: centreY };
    if (side === 'right') return { left: t.left + target.width + ARROW_GAP, top: centreY };
    if (side === 'above') return { left: centreX, top: t.top - ARROW_GAP - ARROW_SIZE };
    return { left: centreX, top: t.top + target.height + ARROW_GAP };
  };
  const fits = (p: { left: number; top: number }) =>
    p.left >= 0 &&
    p.top >= 0 &&
    p.left + ARROW_SIZE <= box.width &&
    p.top + ARROW_SIZE <= box.height;
  const side = prefer.find((s) => fits(at(s))) ?? prefer[0];
  const p = at(side);
  return {
    side,
    left: Math.round(Math.max(0, Math.min(box.width - ARROW_SIZE, p.left))),
    top: Math.round(Math.max(0, Math.min(box.height - ARROW_SIZE, p.top))),
  };
}

/** What the arrow points at. */
export type ArrowTarget = 'menu' | 'shop' | 'companions' | 'action';

/**
 * The next thing to tap for `step`: the menu button while the menu is closed,
 * then the Shop tab, the Companions sub tab, and the crow's Buy / Upgrade button.
 * Null when no step is open (unlock, done).
 */
export function arrowTarget(
  step: QuestStep | null,
  menu: { open: boolean; tab: string | null; sub: string | null },
): ArrowTarget | null {
  if (step !== 'buy' && step !== 'upgrade') return null;
  if (!menu.open) return 'menu';
  if (menu.tab !== 'shop') return 'shop';
  return menu.sub === 'companions' ? 'action' : 'companions';
}

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
 * The arrow points at the menu button, then at the Shop tab, the Companions sub
 * tab and the crow's button (found in `menuEl`) while a step can be acted on.
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
  const arrow = document.createElement('div');
  arrow.className = 'quest-arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.hidden = true;
  arrow.innerHTML = pixelSvg(ARROW_ROWS);
  box.append(arrow);
  let arrowKey = '';

  /** The element the arrow points at right now, with the sides it prefers. */
  function findTarget(): { el: Element; prefer: ArrowSide[] } | null {
    const tab = menuEl.querySelector('[role="tab"][data-tab][aria-selected="true"]');
    const sub = menuEl.querySelector('[data-subtabs="shop"] [role="tab"][aria-selected="true"]');
    const t = arrowTarget(step, {
      open: !menuEl.hidden,
      tab: tab?.getAttribute('data-tab') ?? null,
      sub: sub?.getAttribute('data-sub') ?? null,
    });
    const pick = (sel: string, prefer: ArrowSide[]) => {
      const el = menuEl.querySelector(sel);
      return el ? { el, prefer } : null;
    };
    if (t === 'menu') return { el: menuButton, prefer: ['below', 'left', 'above', 'right'] };
    if (t === 'shop') return pick('[data-tab="shop"]', ['below', 'above', 'left', 'right']);
    if (t === 'companions') {
      return pick('[data-subtabs="shop"] [data-sub="companions"]', [
        'below',
        'above',
        'left',
        'right',
      ]);
    }
    if (t === 'action') {
      const act = step === 'buy' ? 'comp-buy' : 'comp-upgrade';
      return pick(`.comp-shop [data-comp="crow"] .${act}`, ['left', 'above', 'below', 'right']);
    }
    return null;
  }

  /** Moves the arrow next to its target; hidden when there is nothing visible to point at. */
  function placeArrow(): void {
    const target = findTarget();
    const r = target?.el.getBoundingClientRect();
    if (!target || !r || (r.width === 0 && r.height === 0)) {
      setFlag(arrow, 'hidden', true);
      return;
    }
    const b = box.getBoundingClientRect();
    const p = arrowPlacement(r, b, target.prefer);
    const key = `${p.side} ${p.left} ${p.top}`;
    setFlag(arrow, 'hidden', false);
    if (key === arrowKey) return;
    arrowKey = key;
    arrow.className = `quest-arrow ${p.side}`;
    arrow.style.left = `${p.left}px`;
    arrow.style.top = `${p.top}px`;
  }

  // The menu changes tab on a click or a key: follow at once, even while the game is paused.
  // (After the other handlers ran, so the menu state is up to date.)
  let followTimer = 0;
  const follow = () => {
    window.clearTimeout(followTimer);
    followTimer = window.setTimeout(placeArrow, 0);
  };
  box.addEventListener('click', follow);
  box.addEventListener('keyup', follow);

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
    placeArrow();
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
      window.clearTimeout(followTimer);
      box.removeEventListener('click', follow);
      box.removeEventListener('keyup', follow);
      arrow.remove();
      el.remove();
    },
  };
}
