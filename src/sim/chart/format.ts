/**
 * Number, time and label formatting for the sim charts. Locale-free on
 * purpose (no `toLocaleString`): the same input gives the same string on every
 * machine, so SVG snapshots are stable.
 */

const MINUS = '−';
const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Same stage numbering as the game (`STAGES_PER_WORLD` in `src/game/balance.ts`). */
export const STAGES_PER_WORLD = 6;

/** Escape text for SVG/HTML text nodes and attribute values. */
export function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Round to `sig` significant digits and drop trailing zeros: 12.30 → "12.3". */
function sigDigits(v: number, sig: number): string {
  if (v === 0) return '0';
  const digits = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(v))));
  const s = v.toFixed(Math.min(digits, 6));
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/** "1234.5" → "1,234.5": commas in the integer part only. */
function groupThousands(num: string): string {
  const [int, frac] = num.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

/**
 * A number for an axis, tile or table: in full under 10,000 (`1,234`, `12.5`),
 * compact above (`12.9K`, `4.2M`, … `Dc`), scientific past the suffixes
 * (`1.2e36`). `NaN`/`Infinity` print as `–` / `∞`.
 */
export function fmtNum(v: number): string {
  if (Number.isNaN(v)) return '–';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : `${MINUS}∞`;
  const sign = v < 0 ? MINUS : '';
  const a = Math.abs(v);
  if (a < 10_000) {
    const s = a >= 100 ? Math.round(a).toString() : sigDigits(a, 3);
    return sign + groupThousands(s);
  }
  let tier = Math.floor(Math.log10(a) / 3);
  // 999,999 rounds up to "1000K": move it to the next suffix.
  if (Number(sigDigits(a / 1000 ** tier, 3)) >= 1000) tier += 1;
  if (tier >= SUFFIXES.length) {
    const exp = Math.floor(Math.log10(a));
    let mant = Number(sigDigits(a / 10 ** exp, 2));
    let e = exp;
    if (mant >= 10) {
      mant /= 10;
      e += 1;
    }
    return `${sign}${sigDigits(mant, 2)}e${e}`;
  }
  return sign + sigDigits(a / 1000 ** tier, 3) + SUFFIXES[tier];
}

/** Percent from a 0–1 share: 0.0125 → "1.25%". */
export function fmtPct(share: number): string {
  return `${sigDigits(share * 100, 3)}%`;
}

/** Short duration for axes: 45s, 1.5m, 12m, 8h, 2d. */
export function fmtDurationShort(seconds: number): string {
  if (!Number.isFinite(seconds)) return '–';
  const s = Math.abs(seconds);
  const sign = seconds < 0 ? MINUS : '';
  if (s < 60) return `${sign}${sigDigits(s, 2)}s`;
  if (s < 3600) return `${sign}${sigDigits(s / 60, 2)}m`;
  if (s < 86400) return `${sign}${sigDigits(s / 3600, 2)}h`;
  return `${sign}${sigDigits(s / 86400, 2)}d`;
}

/** Readable duration for tables and tiles: 45s, 3m 05s, 2h 07m, 1d 4h. */
export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '–';
  const sign = seconds < 0 ? MINUS : '';
  let s = Math.round(Math.abs(seconds));
  if (s < 60) return `${sign}${s}s`;
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d > 0) return `${sign}${d}d ${h}h`;
  if (h > 0) return `${sign}${h}h ${pad(m)}m`;
  return `${sign}${m}m ${pad(s)}s`;
}

/** Parse a scenario duration: 90, "45s", "5m", "1.5h", "2d". */
export function parseDuration(v: number | string): number {
  if (typeof v === 'number') return v;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(s|m|h|d)?\s*$/.exec(v);
  if (!m) throw new Error(`bad duration "${v}"`);
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[(m[2] ?? 's') as 's' | 'm' | 'h' | 'd'];
  return Number(m[1]) * mult;
}

/** Stage level (1-based, as in the game) → "W.S": level 7 → "2.1". */
export function fmtStage(level: number): string {
  if (!Number.isFinite(level) || level < 1) return '–';
  const l = Math.floor(level);
  return `${Math.floor((l - 1) / STAGES_PER_WORLD) + 1}.${((l - 1) % STAGES_PER_WORLD) + 1}`;
}

/** First stage level of a world: world 2 → 7. */
export function worldStart(world: number): number {
  return (world - 1) * STAGES_PER_WORLD + 1;
}
