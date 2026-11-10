/**
 * The starter quest: "buy the crow", then "upgrade the crow". Pure rules, no
 * DOM. Progress is derived from the game state (nothing is saved), so the
 * quest can never get out of step with what the player owns.
 */
import { COMPANIONS } from './balance';
import { companionStatus, type GameState } from './state';

/** `unlock`: the crow is not in the shop yet. `buy` / `upgrade`: the two quest steps. */
export type QuestStep = 'unlock' | 'buy' | 'upgrade';

type QuestInput = Pick<GameState, 'best' | 'companions'>;

/** True once the crow was upgraded (its level is above 1). */
export const crowUpgraded = (s: Pick<GameState, 'companions'>): boolean => s.companions.crow > 1;

/** Where the player is in the quest by what they own; null when both steps are done. */
export function questStep(s: QuestInput): QuestStep | null {
  if (s.companions.crow < 1) return companionStatus(s, 'crow') === 'offer' ? 'buy' : 'unlock';
  return crowUpgraded(s) ? null : 'upgrade';
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
