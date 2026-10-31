import { STAGES_PER_WORLD, WEAPONS } from './game/balance';
import { newProgress, type GameState, type Progress } from './game/state';

export const DEFAULT_SAVE_KEY = 'afk-game';
export const SAVE_VERSION = 1;

export type AudioSettings = { muted: boolean; track: string };

/**
 * Demo save: plain JSON in localStorage. The checksummed save string, backup
 * slot and export/import come with Save v2 (docs/PLAN.md → Save).
 */
export type SaveData = Progress & {
  version: number;
  gameVersion: string;
  audio: AudioSettings;
};

export type Loaded = { progress: Progress; audio: Partial<AudioSettings> };

type StorageLike = Pick<Storage, 'getItem'>;

const isInt = (v: unknown, min: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min;

/**
 * Reads and validates a save. Anything missing or out of range falls back
 * to a new game's value; a broken save never throws. Returns null when
 * there is no save at all.
 */
export function loadSave(storage: StorageLike | undefined, key: string): Loaded | null {
  const data = readJson(storage, key);
  if (!data) return null;
  const fresh = newProgress();
  const levels = Array.isArray(data.weaponLevels) ? data.weaponLevels : [];
  const weaponLevels = WEAPONS.map((_, i) => {
    const v: unknown = levels[i];
    return isInt(v, 0) ? v : fresh.weaponLevels[i];
  });
  weaponLevels[0] = Math.max(1, weaponLevels[0]);
  const equipped =
    isInt(data.equipped, 0) && (weaponLevels[data.equipped] ?? 0) >= 1 ? data.equipped : 0;
  const stageOk = isInt(data.stage, 1) && data.stage <= STAGES_PER_WORLD && isInt(data.world, 1);
  const audio = (data.audio && typeof data.audio === 'object' ? data.audio : {}) as Record<
    string,
    unknown
  >;
  return {
    progress: {
      world: stageOk ? (data.world as number) : fresh.world,
      stage: stageOk ? (data.stage as number) : fresh.stage,
      autoAdvance: typeof data.autoAdvance === 'boolean' ? data.autoAdvance : fresh.autoAdvance,
      coins: isInt(data.coins, 0) ? data.coins : fresh.coins,
      weaponLevels,
      equipped,
      kills: isInt(data.kills, 0) ? data.kills : 0,
      deaths: isInt(data.deaths, 0) ? data.deaths : 0,
    },
    audio: {
      ...(typeof audio.muted === 'boolean' ? { muted: audio.muted } : {}),
      ...(typeof audio.track === 'string' ? { track: audio.track } : {}),
    },
  };
}

export function toSaveData(s: GameState, audio: AudioSettings, gameVersion: string): SaveData {
  return {
    version: SAVE_VERSION,
    gameVersion,
    world: s.world,
    stage: s.stage,
    autoAdvance: s.autoAdvance,
    coins: s.coins,
    weaponLevels: [...s.weaponLevels],
    equipped: s.equipped,
    kills: s.kills,
    deaths: s.deaths,
    audio,
  };
}

export function writeSave(
  storage: Pick<Storage, 'setItem'> | undefined,
  key: string,
  data: SaveData,
): boolean {
  try {
    storage?.setItem(key, JSON.stringify(data));
    return Boolean(storage);
  } catch {
    return false; // quota full or storage blocked: keep playing, just don't save
  }
}

export type SavePreview = { stage: string | null };

/** Peek at an existing save to label the Start button. Null when there is no usable save. */
export function readSavePreview(storage: StorageLike | undefined, key: string): SavePreview | null {
  const data = readJson(storage, key);
  if (!data) return null;
  const { world, stage } = data;
  const valid = Number.isInteger(world) && Number.isInteger(stage);
  return { stage: valid ? `${world as number}.${stage as number}` : null };
}

function readJson(storage: StorageLike | undefined, key: string): Record<string, unknown> | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(key) ?? null;
  } catch {
    return null; // storage blocked (privacy mode, sandboxed iframe)
  }
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
