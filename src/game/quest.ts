/**
 * The starter quest: "buy the crow", then "upgrade the crow". Pure rules, no
 * DOM. Progress is derived from the game state (nothing is saved), so the
 * quest can never get out of step with what the player owns.
 */
import { COMPANIONS } from './balance';
import { shopCompanion, type GameState } from './state';

/** `unlock`: the crow is not in the shop yet. `buy` / `upgrade`: the two quest steps. */
export type QuestStep = 'unlock' | 'buy' | 'upgrade';

type QuestInput = Pick<GameState, 'best' | 'companion'>;

/** True once any crow upgrade was bought (damage level, auto pecks or speed). */
export const crowUpgraded = (c: NonNullable<GameState['companion']>): boolean =>
  c.dmgLevel > 1 || c.autoUnlocked || c.speedLevel > 1;

/** Where the player is in the quest by what they own; null when both steps are done. */
export function questStep(s: QuestInput): QuestStep | null {
  if (!s.companion) return shopCompanion(s) ? 'buy' : 'unlock';
  return crowUpgraded(s.companion) ? null : 'upgrade';
}

/**
 * Whether the quest runs this session. It only starts when the first look is
 * before the crow is bought, so players who already own the crow never see
 * it. Once it is over (or was skipped) it stays off.
 */
export type QuestRun = 'unseen' | 'on' | 'off';

export function nextRun(run: QuestRun, step: QuestStep | null): QuestRun {
  if (run === 'off') return 'off';
  if (run === 'unseen') return step === 'unlock' || step === 'buy' ? 'on' : 'off';
  return step === null ? 'off' : 'on';
}

/** Stage to clear before the crow is sold (e.g. "1.1"), for the `unlock` text. */
export const crowUnlockLevel = COMPANIONS.crow.unlockLevel - 1;
