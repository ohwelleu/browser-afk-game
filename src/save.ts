import { STAGES_PER_WORLD, stageLevel, WEAPONS } from './game/balance';
import { newProgress, type GameState, type Progress } from './game/state';

export const DEFAULT_SAVE_KEY = 'afk-game';
export const SAVE_VERSION = 1;
export const SAVE_PREFIX = 'AFK1';
export const backupKey = (key: string) => `${key}.bak`;

export type AudioSettings = {
  muted: boolean;
  track: string;
  musicVolume: number;
  sfxVolume: number;
};

/**
 * What the game saves. In localStorage it is stored as a save string (see
 * `encodeSave`); the previous good save is kept under `<key>.bak`.
 */
export type SaveData = Progress & {
  version: number;
  gameVersion: string;
  audio: AudioSettings;
};

export type Loaded = { progress: Progress; audio: Partial<AudioSettings> };

/**
 * `ok`: the main save loaded. `backup`: the main save was broken, the backup
 * loaded. `reset`: both were broken, this is a new game. `none`: no save yet.
 */
export type LoadStatus = 'none' | 'ok' | 'backup' | 'reset';
export type LoadResult = { saved: Loaded | null; status: LoadStatus };

type StorageLike = Pick<Storage, 'getItem'>;

const isInt = (v: unknown, min: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const isVolume = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/**
 * Loads the save under `key`, falling back to `<key>.bak`, then to a new
 * game. Never throws. A save string must pass `decodeSave` (format, checksum
 * and the strict schema). A plain-JSON v1 save (written before save strings)
 * is still accepted and repaired leniently; the next write turns it into a
 * save string.
 */
export function loadSave(storage: StorageLike | undefined, key: string): LoadResult {
  const main = readRaw(storage, key);
  if (main === null) return { saved: null, status: 'none' };
  const fromMain = parseStored(main);
  if (fromMain) return { saved: fromMain, status: 'ok' };
  const bak = readRaw(storage, backupKey(key));
  const fromBak = bak === null ? null : parseStored(bak);
  return fromBak ? { saved: fromBak, status: 'backup' } : { saved: null, status: 'reset' };
}

function parseStored(raw: string): Loaded | null {
  if (raw.startsWith(`${SAVE_PREFIX}.`)) {
    const r = decodeSave(raw);
    return r.ok ? { progress: r.progress, audio: r.audio } : null;
  }
  const data = parseJsonObject(raw);
  return data ? repairV1(data) : null;
}

/** v1 (plain JSON) saves: anything missing or out of range gets a new game's value. */
function repairV1(data: Record<string, unknown>): Loaded {
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
 * Strict schema check (save strings, debugger): nothing is repaired. Every
 * problem is listed and the data is only accepted when there are none.
 * Without `tracks`, any track name is accepted (the game falls back to its
 * default track when it doesn't know one).
 */
export function validateSaveData(data: unknown, tracks?: readonly string[]): Validated {
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
    if (typeof au.track !== 'string') {
      errors.push('audio.track must be text.');
    } else if (tracks && !tracks.includes(au.track)) {
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
    audio,
  };
}

// ── Save string ──────────────────────────────────────────────────────────────
//
// `AFK1.<base64url(JSON)>.<checksum>`, checksum = FNV-1a 32-bit of the base64
// payload as 8 hex digits. The checksum catches corruption and casual edits.
// It is NOT anti-cheat: anyone can decode and re-sign a save with the public JS.

/** Save data → save string. Pure; meant for reuse by export/import and share links. */
export function encodeSave(data: SaveData): string {
  const payload = toBase64Url(JSON.stringify(data));
  return `${SAVE_PREFIX}.${payload}.${fnv1a(payload)}`;
}

export type Decoded =
  | { ok: true; data: Record<string, unknown>; progress: Progress; audio: AudioSettings }
  | { ok: false; errors: string[] };

/** Checks the format, checksum and schema of a save string. Pure, never throws. */
export function decodeSave(text: string, tracks?: readonly string[]): Decoded {
  const parts = String(text).trim().split('.');
  if (parts.length !== 3 || parts[0] !== SAVE_PREFIX) {
    return { ok: false, errors: [`Not a save string (expected ${SAVE_PREFIX}.…).`] };
  }
  const [, payload, sum] = parts;
  if (fnv1a(payload) !== sum.toLowerCase()) {
    return { ok: false, errors: ['Checksum does not match: the save is damaged or edited.'] };
  }
  let json: string;
  try {
    json = fromBase64Url(payload);
  } catch {
    return { ok: false, errors: ['Save data is not valid base64url text.'] };
  }
  const data = parseJsonObject(json);
  if (!data) return { ok: false, errors: ['Save data is not a JSON object.'] };
  const r = validateSaveData(data, tracks);
  return r.ok ? { ok: true, data, progress: r.progress, audio: r.audio } : r;
}

/** FNV-1a 32-bit over char codes (the payload is ASCII), as 8 hex digits. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function toBase64Url(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(b64: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(b64)) throw new Error('bad base64url');
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// ── Storage ──────────────────────────────────────────────────────────────────

/**
 * Writes the save string. The value it replaces is first copied to
 * `<key>.bak`, but only if it still loads, so a broken save never overwrites
 * a good backup. Returns false instead of throwing when storage fails.
 */
export function writeSave(
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined,
  key: string,
  data: SaveData,
): boolean {
  if (!storage) return false;
  try {
    const next = encodeSave(data);
    const prev = readRaw(storage, key);
    if (prev !== null && prev !== next && parseStored(prev)) {
      storage.setItem(backupKey(key), prev);
    }
    storage.setItem(key, next);
    return true;
  } catch {
    return false; // quota full or storage blocked: keep playing, just don't save
  }
}

/** Removes the save and its backup. */
export function clearSave(storage: Pick<Storage, 'removeItem'> | undefined, key: string): void {
  try {
    storage?.removeItem(key);
    storage?.removeItem(backupKey(key));
  } catch {
    // storage blocked: nothing to clear
  }
}

export type SavePreview = { stage: string };

/**
 * Peek at an existing save to label the Start button with the stage
 * `loadSave` would continue from. Null when there is no usable save.
 */
export function readSavePreview(storage: StorageLike | undefined, key: string): SavePreview | null {
  const { saved } = loadSave(storage, key);
  return saved ? { stage: `${saved.progress.world}.${saved.progress.stage}` } : null;
}

function readRaw(storage: StorageLike | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) || null;
  } catch {
    return null; // storage blocked (privacy mode, sandboxed iframe)
  }
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
