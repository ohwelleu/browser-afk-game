/**
 * Save format for passive skills (`passives` and `pick` in the save). Kept out
 * of save.ts so other save fields can change there without touching this.
 */
import { ITEM_TIERS } from './game/balance';
import { passiveDef, PICK_OPTIONS, type Passive, type PickOption } from './game/passives';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min: number): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const isTier = (v: unknown): v is Passive['tier'] => ITEM_TIERS.includes(v as never);
const isKnown = (v: unknown): v is string => typeof v === 'string' && !!passiveDef(v);

const copyPassive = (p: Passive): Passive => ({ id: p.id, tier: p.tier, level: p.level });
const copyOption = (o: PickOption): PickOption => ({ id: o.id, tier: o.tier });

/** Why `raw` isn't a valid owned passive, or null when it is. */
function passiveError(raw: unknown): string | null {
  if (!isObj(raw)) return 'must be an object';
  if (!isKnown(raw.id)) return 'id must be a known passive';
  if (!isTier(raw.tier)) return `tier must be ${ITEM_TIERS.join(', ')}`;
  if (!isInt(raw.level, 1)) return 'level must be a whole number from 1';
  return null;
}

/** Why `raw` isn't a valid offer option, or null when it is. */
function optionError(raw: unknown): string | null {
  if (!isObj(raw)) return 'must be an object';
  if (!isKnown(raw.id)) return 'id must be a known passive';
  if (!isTier(raw.tier)) return `tier must be ${ITEM_TIERS.join(', ')}`;
  return null;
}

/**
 * Lenient load: bad entries are dropped, the same id and tier twice is merged
 * into one entry. A missing list (saves from before passives) is empty.
 */
export function loadPassives(raw: unknown): Passive[] {
  const out: Passive[] = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    if (passiveError(v)) continue;
    const p = v as Passive;
    const same = out.find((o) => o.id === p.id && o.tier === p.tier);
    if (same) same.level += p.level;
    else out.push(copyPassive(p));
  }
  return out;
}

/** Lenient load of the open offer: needs at least one valid, distinct option, else no offer. */
export function loadPick(raw: unknown): PickOption[] | null {
  const out: PickOption[] = [];
  for (const v of Array.isArray(raw) ? raw : []) {
    if (optionError(v) || out.some((o) => o.id === (v as PickOption).id)) continue;
    out.push(copyOption(v as PickOption));
    if (out.length >= PICK_OPTIONS) break;
  }
  return out.length ? out : null;
}

/** Strict check for the debugger: lists every problem, repairs nothing. */
export function validatePassives(raw: unknown, errors: string[]): Passive[] | null {
  const before = errors.length;
  if (!Array.isArray(raw)) {
    errors.push('passives must be a list.');
    return null;
  }
  const seen = new Set<string>();
  raw.forEach((v, i) => {
    const e = passiveError(v);
    if (e) return errors.push(`passives[${i}]: ${e}.`);
    const key = `${(v as Passive).id}/${(v as Passive).tier}`;
    if (seen.has(key)) errors.push(`passives[${i}]: ${key} is listed twice.`);
    seen.add(key);
  });
  return errors.length > before ? null : (raw as Passive[]).map(copyPassive);
}

/** Strict check of the open offer: null, or 1–`PICK_OPTIONS` options with different passives. */
export function validatePick(raw: unknown, errors: string[]): PickOption[] | null {
  if (raw === null) return null;
  const before = errors.length;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > PICK_OPTIONS) {
    errors.push(`pick must be null or a list of 1 to ${PICK_OPTIONS} options.`);
    return null;
  }
  raw.forEach((v, i) => {
    const e = optionError(v);
    if (e) errors.push(`pick[${i}]: ${e}.`);
  });
  if (errors.length === before && new Set(raw.map((o: PickOption) => o.id)).size !== raw.length) {
    errors.push('pick must not offer the same passive twice.');
  }
  return errors.length > before ? null : (raw as PickOption[]).map(copyOption);
}

export const savePassives = (list: readonly Passive[]): Passive[] => list.map(copyPassive);
export const savePick = (list: readonly PickOption[] | null): PickOption[] | null =>
  list && list.map(copyOption);
