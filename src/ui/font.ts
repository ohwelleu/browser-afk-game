// Game font: Press Start 2P by The Press Start 2P Project Authors (cody@zone38.net),
// SIL Open Font License 1.1 (see src/assets/fonts/OFL.txt). Source:
// github.com/google/fonts ofl/pressstart2p. The licence reserves the name
// "Press Start 2P", so this subset is renamed "AFK Start" inside the file:
//   pyftsubset PressStart2P-Regular.ttf --layout-features=kern --no-hinting //     --unicodes=U+0020-007E,U+00A0-00FF,U+0104-0105,U+010C-010D,U+0116-0119,//     U+012E-012F,U+0160-0161,U+016A-016B,U+0172-0173,U+017D-017E,U+2013-2014,//     U+2018-2019,U+201C-201E,U+2022,U+2026,U+2212
//   then name IDs 1/3/4/6 set to "AFK Start" and saved as woff2 (fonttools).
// It has no bold: bold text keeps the regular face (font-synthesis: none).
// Lib builds inline it as a data: URL, so the one-file embed still works.
import regularUrl from '../assets/fonts/AfkStart-Regular.subset.woff2?inline';

export const FONT_FAMILY = 'afk-pixel';
const FALLBACK_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
/** The pixel font, then the old monospace stack while it loads (or if it can't). */
export const FONT_STACK = `${FONT_FAMILY}, ${FALLBACK_STACK}`;
/** The game font is drawn on an 8-unit grid per em: multiples of 8 px stay crisp. */
export const FONT_GRID = 8;

// ── Debug font picker (?afkdebug) ──────────────────────────────────────────
// The embedded game font plus candidates to compare. Candidate files live in
// demo/fonts/ (with licences) and load by URL only when picked, so the bundle
// doesn't grow. Sizes are designed for Pixelify Sans (the first game font) and
// converted per font, see `crispSize`.
// Measured with fonttools on the shipped files: `grid` = pixels per em (every
// letter/digit outline point sits on unitsPerEm / grid), `cap` = height of H /
// unitsPerEm, and which of ą č ę ė į š ų ū ž (+ capitals) the cmap lacks.

export type FontCandidate = {
  id: string;
  label: string;
  /** "shortlist": every Lithuanian letter and usable sizes; "more": the rest, to compare. */
  group: 'shortlist' | 'more';
  /** File under demo/fonts/; absent = the embedded game font. */
  file?: string;
  /** Bold face under demo/fonts/, if the font has one. */
  boldFile?: string;
  /** Design grid, in pixels per em: crisp at whole multiples of it (1 = no pixel grid). */
  grid: number;
  /** Snap UI (CSS) sizes to the grid; false keeps the Pixelify design sizes (16 px base). */
  snapUi: boolean;
  /** Cap height / em. Sizes scale so caps match Pixelify's before snapping. */
  cap: number;
  /** Has a real bold face; without one, bold isn't faked (it smears). */
  bold: boolean;
  /** Lithuanian letters the font lacks (they fall back to the game font). */
  missing?: string;
  licence: string;
  source: string;
};

/** Pixelify Sans' cap height / em (H is 631 of 1000 units). */
const PIXELIFY_CAP = 0.631;
const PIXELIFY = {
  group: 'shortlist',
  file: 'pixelify/PixelifySans-Regular.subset.woff2',
  boldFile: 'pixelify/PixelifySans-Bold.subset.woff2',
  grid: 11,
  cap: PIXELIFY_CAP,
  bold: true,
  licence: 'OFL-1.1',
  source: 'https://github.com/google/fonts/tree/main/ofl/pixelifysans',
} as const;
const GF = 'https://github.com/google/fonts/tree/main/ofl/';
const GALMURI = 'https://github.com/quiple/galmuri';
const ARK = 'https://github.com/TakWolf/ark-pixel-font';
const PIXEL_OPERATOR = 'https://notabug.org/HarvettFox96/ttf-pixeloperator (via dafont.com)';

/** A snapped candidate from demo/fonts/<dir>/<file>. */
function candidate(
  group: FontCandidate['group'],
  id: string,
  label: string,
  file: string,
  grid: number,
  cap: number,
  source: string,
  extra: Partial<FontCandidate> = {},
): FontCandidate {
  return {
    id,
    label,
    group,
    file: `${id}/${file}`,
    grid,
    snapUi: true,
    cap,
    bold: false,
    licence: 'OFL-1.1',
    source,
    ...extra,
  };
}

export const FONT_CANDIDATES: readonly FontCandidate[] = [
  {
    id: 'press-start-2p',
    label: 'Press Start 2P (8 px) — game font',
    group: 'shortlist',
    grid: FONT_GRID,
    snapUi: true,
    cap: 1,
    bold: false,
    licence: 'OFL-1.1',
    source: `${GF}pressstart2p`,
  },
  { id: 'pixelify', label: 'Pixelify Sans (16 px, old sizes)', snapUi: false, ...PIXELIFY },
  { id: 'pixelify-snap', label: 'Pixelify Sans (snapped to 11 px)', snapUi: true, ...PIXELIFY },
  candidate(
    'shortlist',
    'tiny5',
    'Tiny5 (8 px)',
    'Tiny5-Regular.subset.woff2',
    8,
    0.625,
    `${GF}tiny5`,
  ),
  candidate(
    'shortlist',
    'galmuri11',
    'Galmuri11 (12 px)',
    'Galmuri11.subset.woff2',
    12,
    0.9167,
    GALMURI,
  ),
  candidate(
    'shortlist',
    'ark-pixel-12',
    'Ark Pixel 12px (12 px)',
    'ArkPixel12-latin.subset.woff2',
    12,
    0.75,
    ARK,
  ),
  candidate('more', 'galmuri7', 'Galmuri7 (8 px)', 'Galmuri7.subset.woff2', 8, 0.875, GALMURI),
  candidate('more', 'galmuri9', 'Galmuri9 (10 px)', 'Galmuri9.subset.woff2', 10, 0.9, GALMURI),
  candidate(
    'more',
    'ark-pixel-10',
    'Ark Pixel 10px (10 px)',
    'ArkPixel10-latin.subset.woff2',
    10,
    0.7,
    ARK,
  ),
  candidate(
    'more',
    'pixel-operator',
    'Pixel Operator (16 px)',
    'PixelOperator.subset.woff2',
    16,
    0.5625,
    PIXEL_OPERATOR,
    {
      boldFile: 'pixel-operator/PixelOperator-Bold.subset.woff2',
      bold: true,
      missing: 'ąęėįųū ĄĘĖĮŲŪ',
      licence: 'CC0-1.0',
    },
  ),
  candidate(
    'more',
    'pixel-operator-8',
    'Pixel Operator 8 (8 px)',
    'PixelOperator8.subset.woff2',
    8,
    0.875,
    PIXEL_OPERATOR,
    {
      boldFile: 'pixel-operator-8/PixelOperator8-Bold.subset.woff2',
      bold: true,
      missing: 'ąęėįųū ĄĘĖĮŲŪ',
      licence: 'CC0-1.0',
    },
  ),
  candidate(
    'more',
    'silkscreen',
    'Silkscreen (8 px)',
    'Silkscreen-Regular.subset.woff2',
    8,
    0.625,
    `${GF}silkscreen`,
    {
      boldFile: 'silkscreen/Silkscreen-Bold.subset.woff2',
      bold: true,
      missing: 'ąčęėįųū ĄČĘĖĮŲŪ',
    },
  ),
  candidate(
    'more',
    'bytesized',
    'Bytesized (8 px)',
    'Bytesized-Regular.subset.woff2',
    8,
    0.375,
    `${GF}bytesized`,
  ),
  candidate(
    'more',
    'micro5',
    'Micro 5 (11 px)',
    'Micro5-Regular.subset.woff2',
    11,
    0.4545,
    `${GF}micro5`,
  ),
  // Pixels are 75 of 1400 units: crisp at 18.67 px steps.
  candidate(
    'more',
    'jersey10',
    'Jersey 10 (18.67 px)',
    'Jersey10-Regular.subset.woff2',
    1400 / 75,
    0.5357,
    `${GF}jersey10`,
  ),
  candidate(
    'more',
    'vt323',
    'VT323 (no pixel grid)',
    'VT323-Regular.subset.woff2',
    1,
    0.56,
    `${GF}vt323`,
  ),
  // Round dots on a 16 px grid, slightly inset: never perfectly sharp.
  candidate(
    'more',
    'dotgothic16',
    'DotGothic16 (16 px, dotted)',
    'DotGothic16-Regular.subset.woff2',
    16,
    0.787,
    `${GF}dotgothic16`,
    {
      missing: 'ąčęėįųū ĄČĘĖĮŲŪ',
    },
  ),
];

export const DEFAULT_FONT = FONT_CANDIDATES[0];

let active: FontCandidate = DEFAULT_FONT;

/** The font in use now (the game font unless the debug picker changed it). */
export const activeFont = (): FontCandidate => active;

/** CSS family for a candidate: the embedded face, or its own registered name. */
export const fontFamily = (f: FontCandidate): string => (f.file ? `afk-font-${f.id}` : FONT_FAMILY);

/** Family stack of the active font, for canvas text. */
export const fontStack = (): string => `${fontFamily(active)}, ${FALLBACK_STACK}`;

/** Canvas `font` weight prefix: `bold ` only when the font has a real bold. */
export const boldPrefix = (): string => (active.bold ? 'bold ' : '');

/** Rounds `px` to the nearest whole multiple of `grid` (at least 1×). */
export function snapToGrid(px: number, grid: number): number {
  return Math.max(1, Math.round(px / grid)) * grid;
}

/**
 * A size designed for Pixelify, for font `f`: scaled so cap heights match,
 * then rounded to a whole multiple of `f`'s grid.
 */
export function crispSize(px: number, f: FontCandidate = active): number {
  return snapToGrid((px * PIXELIFY_CAP) / f.cap, f.grid);
}

/** Rounds a canvas text size to a crisp size of the active font. */
export function snapFontSize(px: number): number {
  return crispSize(px);
}

/**
 * UI font sizes as CSS custom properties (see styles.ts), at their design
 * size for Pixelify. Values are px; the CSS fallbacks are the same sizes.
 */
export const UI_FONT_SIZES: Readonly<Record<string, number>> = {
  '--afk-fs': 16,
  '--afk-fs-small': 12,
  '--afk-fs-menu': 16 * 1.15,
  '--afk-fs-menu-title': 16 * 1.15 * 1.2,
  '--afk-fs-title': 16 * 1.15,
  '--afk-fs-popover': 16 * 1.1,
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** The size variables for `f`: crisp px values, or the design sizes if it doesn't snap. */
export function uiFontVars(f: FontCandidate): Record<string, string> {
  return Object.fromEntries(
    Object.entries(UI_FONT_SIZES).map(([k, px]) => [
      k,
      `${round2(f.snapUi ? crispSize(px, f) : px)}px`,
    ]),
  );
}

/** The game font's size variables as CSS declarations (styles.ts puts them on .box). */
export const defaultFontVarsCss = (): string =>
  Object.entries(uiFontVars(DEFAULT_FONT))
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');

const candidateLoads = new Map<string, Promise<void>>();

/**
 * Registers `f`'s file (once, resolved against `base`) and waits for it,
 * without making it active. Rejects if the file can't load.
 */
export function loadCandidate(
  f: FontCandidate,
  base: string,
  doc: Document | undefined = globalThis.document,
): Promise<void> {
  if (!f.file || !doc?.fonts || typeof FontFace === 'undefined') return Promise.resolve();
  let load = candidateLoads.get(f.id);
  if (!load) {
    const fonts = doc.fonts;
    const faces = [[f.file, '400'], ...(f.boldFile ? [[f.boldFile, '700']] : [])].map(
      ([file, weight]) => {
        const src = `url(${JSON.stringify(new URL(file, base).href)})`;
        return new FontFace(fontFamily(f), src, { weight });
      },
    );
    for (const face of faces) fonts.add(face);
    load = Promise.all(faces.map((face) => face.load())).then(() => undefined);
    candidateLoads.set(f.id, load);
    load.catch(() => {
      candidateLoads.delete(f.id);
      for (const face of faces) fonts.delete(face);
    });
  }
  return load;
}

/**
 * Makes `f` the active font once its file has loaded (see `loadCandidate`).
 * Rejects if the file can't load; the old font stays.
 */
export async function useFont(
  f: FontCandidate,
  base: string,
  doc: Document | undefined = globalThis.document,
): Promise<void> {
  await loadCandidate(f, base, doc);
  active = f;
}

/** Test hook: back to the default without touching the document. */
export function resetActiveFont(): void {
  active = DEFAULT_FONT;
}

const LOAD_TIMEOUT_MS = 1000;
let ready: Promise<void> | null = null;

/**
 * Registers the font on the host document (`@font-face` inside a shadow root
 * is ignored by some browsers). Runs once; skips the face if another copy of
 * the bundle already added it. Resolves when the font is usable (or
 * after a timeout), never rejects: text just keeps the fallback stack. Games
 * mount after this so the first canvas frame already uses the font.
 */
export function loadFont(doc: Document = document): Promise<void> {
  if (ready) return ready;
  const fonts = doc.fonts;
  if (!fonts || typeof FontFace === 'undefined') return (ready = Promise.resolve());
  const has = [...fonts].some((f) => f.family.replace(/["']/g, '') === FONT_FAMILY);
  if (!has) fonts.add(new FontFace(FONT_FAMILY, `url(${regularUrl}) format('woff2')`));
  const loaded = fonts.load(`${FONT_GRID}px ${FONT_FAMILY}`).then(
    () => undefined,
    () => undefined,
  );
  // A data: URL decodes in a few ms; the timeout only guards against a stuck load.
  ready = Promise.race([loaded, new Promise<void>((r) => setTimeout(r, LOAD_TIMEOUT_MS))]);
  return ready;
}
