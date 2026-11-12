import { ASCEND_COST, ASCEND_SPEED_PER, ASCEND_GATE, ASCEND_GATE_LEVEL } from '../game/balance';
import { ascendUnlocked } from '../game/ascend';
import { formatNumber } from '../game/format';
import { html } from './dom';
import { dialogHtml } from './modal';

/** What an ascend resets, for Shop → Ascend and the confirm dialog. */
export const ASCEND_RESETS: readonly string[] = [
  'Stage (back to 1.1) and coins',
  'Weapons and weapon levels',
  'Defence, HP, mana and crit upgrades',
  'Companions and their levels',
  'Auto-advance (on, as in a new game)',
];

/** What an ascend keeps. */
export const ASCEND_KEEPS: readonly string[] = [
  'Items: worn and in the bag',
  'Your records (best stage, best item, best DPS)',
  'Kills, deaths, sound settings and your save',
];

/** The gate line: locked (with where you are) or open. Plain text, `stage` is `world.stage`. */
export function ascendGateText(s: { best: number }, bestName: string): string {
  const gate = `${ASCEND_GATE.world}.${ASCEND_GATE.stage}`;
  return ascendUnlocked(s)
    ? `Unlocked: you reached stage ${gate}.`
    : `Locked: reach stage ${gate} first (highest this run: ${bestName}).`;
}

/** Why the Ascend button is disabled, or '' when it can be pressed. */
export function ascendBlockedReason(s: { best: number; coins: number }): string {
  if (s.best < ASCEND_GATE_LEVEL) return 'Reach the gate stage first';
  if (s.coins < ASCEND_COST) return 'Not enough coins';
  return '';
}

/** 0.1 → "10%". */
const pct = (v: number) => `${+(v * 100).toFixed(1)}%`;

/** The attack speed bonus the ascends give, e.g. "+30%". */
export const ascendBonusText = (ascends: number): string => `+${pct(ascends * ASCEND_SPEED_PER)}`;

const list = (items: readonly string[]) => `<ul>${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;

export const ASCEND_PANEL = `
    <div class="ascend">
      <p class="asc-count">Ascends: <b class="asc-n"></b></p>
      <p class="asc-gate"></p>
      <p>Price: <span class="price"><img alt="" data-icon="coin" /><span class="asc-price"></span></span></p>
      <h3>Resets</h3>
      ${list(ASCEND_RESETS)}
      <h3>Stays</h3>
      ${list(ASCEND_KEEPS)}
      <div class="buy-row"><button type="button" data-act="ascend" class="asc-btn">Ascend</button></div>
      <p class="note">Each ascend gives <b>+${pct(ASCEND_SPEED_PER)} attack speed</b>, on top of your items. Your bonus now: <b class="asc-bonus"></b>.</p>
    </div>`;

export const ASCEND_STYLES = `
.ascend ul { margin: 0 0 0.6em; padding-left: 1.3em; }
.ascend li { margin: 2px 0; }
.ascend .asc-gate { font-weight: bold; }
.ascend .asc-gate.open { color: var(--_green); }
.ascend-confirm .panel { width: min(380px, 100%); }
.ascend-confirm h2 { box-sizing: border-box; min-height: 36px; display: flex; align-items: center; }
.ascend-confirm .buy-row { margin-bottom: 0; }
.ascend-confirm .buy-row button { min-height: 42px; padding: 6px 12px; }
.ascend-confirm ul { margin: 0 0 0.6em; padding-left: 1.3em; }
@container afk-box (max-width: 767px) {
  .ascend-confirm .buy-row button { min-height: 44px; flex: 1; }
}
`;

export type AscendConfirm = { el: HTMLElement; readonly noButton: HTMLElement };

/** The "Are you sure?" dialog. The game opens it with the shared `Dialogs` helper and handles `ascend-yes` / `ascend-no`. */
export function createAscendConfirm(): AscendConfirm {
  const el = html(
    dialogHtml({
      kind: 'modal',
      id: 'afk-ascend',
      title: 'Ascend?',
      closeLabel: 'Close',
      body: `
        <p>You start over from stage 1.1. This can't be undone.</p>
        <p>Resets:</p>${list(ASCEND_RESETS)}
        <p>Stays: your items and records.</p>
        <p>Price: ${formatNumber(ASCEND_COST)} coins. The rest of your coins goes too.</p>
        <div class="buy-row">
          <button type="button" data-act="ascend-yes">Ascend</button>
          <button type="button" data-act="ascend-no">Cancel</button>
        </div>`,
    }),
  );
  el.classList.add('ascend-confirm');
  return { el, noButton: el.querySelector<HTMLElement>('[data-act="ascend-no"]')! };
}
