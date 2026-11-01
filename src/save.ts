import { STAGES_PER_WORLD, stageLevel, WEAPONS } from './game/balance';
import { newProgress, type GameState, type Progress } from './game/state';
import { loadGear, saveGear, validateGear } from './save-items';

export const DEFAULT_SAVE_KEY = 'afk-game';
/**
 * Save format version. History:
 * 1. first demo save
 * 2. + `items` (ring, pendant, bag, drop RNG); v1 saves load with empty gear
 */
export const SAVE_VERSION = 2;

export type AudioSettings = {
  muted: boolean;
  track: string;
  musicVolume: number;
  sfxVolume: number;
};

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
const isVolume = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

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
  const world = stageOk ? (data.world as number) : fresh.world;
  const stage = stageOk ? (data.stage as number) : fresh.stage;
  return {
    progress: {
      world,
      stage,
      best: Math.max(isInt(data.best, 1) ? data.best : 1, stageLevel(world, stage)),
      autoAdvance: typeof data.autoAdvance === 'boolean' ? data.autoAdvance : fresh.autoAdvance,
      coins: isInt(data.coins, 0) ? data.coins : fresh.coins,
      weaponLevels,
      equipped,
      kills: isInt(data.kills, 0) ? data.kills : 0,
      deaths: isInt(data.deaths, 0) ? data.deaths : 0,
      // Migration v1 → v2: no `items` yet, so loadGear starts empty with a new seed.
      items: loadGear(data.items),
    },
    audio: {
      ...(typeof audio.muted === 'boolean' ? { muted: audio.muted } : {}),
      ...(typeof audio.track === 'string' ? { track: audio.track } : {}),
      ...(isVolume(audio.musicVolume) ? { musicVolume: audio.musicVolume } : {}),
      ...(isVolume(audio.sfxVolume) ? { sfxVolume: audio.sfxVolume } : {}),
    },
  };
}

export type Validated =
  { ok: true; progress: Progress; audio: AudioSettings } | { ok: false; errors: string[] };

/**
 * Strict check for hand-edited saves (debugger): unlike `loadSave`, nothing
 * is repaired. Every problem is listed and the data is only accepted when
 * there are none.
 */
export function validateSaveData(data: unknown, tracks: readonly string[]): Validated {
  const errors: string[] = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, errors: ['Save must be a JSON object.'] };
  }
  const d = data as Record<string, unknown>;
  const int = (key: string, v: unknown, min: number, max = Number.MAX_SAFE_INTEGER) => {
    if (!isInt(v, min) || v > max) {
      errors.push(`${key} must be a whole number from ${min} to ${max}.`);
      return false;
    }
    return true;
  };
  const bool = (key: string, v: unknown) => {
    if (typeof v !== 'boolean') errors.push(`${key} must be true or false.`);
  };

  const worldOk = int('world', d.world, 1);
  const stageOk = int('stage', d.stage, 1, STAGES_PER_WORLD);
  if (int('best', d.best, 1) && worldOk && stageOk) {
    const level = stageLevel(d.world as number, d.stage as number);
    if ((d.best as number) < level) {
      errors.push(`best must be at least the current stage level (${level}).`);
    }
  }
  int('coins', d.coins, 0);
  int('kills', d.kills, 0);
  int('deaths', d.deaths, 0);
  bool('autoAdvance', d.autoAdvance);
  const items = validateGear(d.items, errors);

  const levels = d.weaponLevels;
  if (!Array.isArray(levels) || levels.length !== WEAPONS.length) {
    errors.push(`weaponLevels must be a list of ${WEAPONS.length} numbers.`);
  } else {
    levels.forEach((v, i) => int(`weaponLevels[${i}] (${WEAPONS[i].name})`, v, i === 0 ? 1 : 0));
    if (
      int('equipped', d.equipped, 0, WEAPONS.length - 1) &&
      !((levels[d.equipped as number] as number) >= 1)
    ) {
      errors.push('equipped must be a weapon you own (level 1 or more).');
    }
  }

  const a = d.audio;
  if (!a || typeof a !== 'object' || Array.isArray(a)) {
    errors.push('audio must be an object.');
  } else {
    const au = a as Record<string, unknown>;
    bool('audio.muted', au.muted);
    if (typeof au.track !== 'string' || !tracks.includes(au.track)) {
      errors.push(
        `audio.track must be one of: ${tracks.map((t) => JSON.stringify(t)).join(', ')}.`,
      );
    }
    for (const key of ['musicVolume', 'sfxVolume']) {
      if (!isVolume(au[key])) errors.push(`audio.${key} must be a number from 0 to 1.`);
    }
  }

  if (errors.length) return { ok: false, errors };
  const au = a as AudioSettings;
  return {
    ok: true,
    progress: {
      world: d.world as number,
      stage: d.stage as number,
      best: d.best as number,
      autoAdvance: d.autoAdvance as boolean,
      coins: d.coins as number,
      weaponLevels: [...(levels as number[])],
      equipped: d.equipped as number,
      kills: d.kills as number,
      deaths: d.deaths as number,
      items: items!,
    },
    audio: {
      muted: au.muted,
      track: au.track,
      musicVolume: au.musicVolume,
      sfxVolume: au.sfxVolume,
    },
  };
}

export function toSaveData(s: GameState, audio: AudioSettings, gameVersion: string): SaveData {
  return {
    version: SAVE_VERSION,
    gameVersion,
    world: s.world,
    stage: s.stage,
    best: s.best,
    autoAdvance: s.autoAdvance,
    coins: s.coins,
    weaponLevels: [...s.weaponLevels],
    equipped: s.equipped,
    kills: s.kills,
    deaths: s.deaths,
    items: saveGear(s.items),
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
