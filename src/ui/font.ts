// Pixelify Sans by The Pixelify Sans Project Authors, SIL Open Font License 1.1
// (see src/assets/fonts/OFL.txt). Source: github.com/google/fonts ofl/pixelifysans
// @ 8b0a1d0. Subset to Latin + Latin-1 + Lithuanian + common punctuation, one
// static instance per weight:
//   fonttools varLib.instancer "PixelifySans[wght].ttf" wght=400 -o r.ttf  (and 700)
//   pyftsubset r.ttf --flavor=woff2 --layout-features=kern --no-hinting \
//     --unicodes=U+0020-007E,U+00A0-00FF,U+0104-0105,U+010C-010D,U+0116-0119,\
//     U+012E-012F,U+0160-0161,U+016A-016B,U+0172-0173,U+017D-017E,U+2013-2014,\
//     U+2018-2019,U+201C-201E,U+2022,U+2026,U+2212
// Lib builds inline these as data: URLs, so the one-file embed still works.
import regularUrl from '../assets/fonts/PixelifySans-Regular.subset.woff2?inline';
import boldUrl from '../assets/fonts/PixelifySans-Bold.subset.woff2?inline';

export const FONT_FAMILY = 'afk-pixel';
const FALLBACK_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
/** The pixel font, then the old monospace stack while it loads (or if it can't). */
export const FONT_STACK = `${FONT_FAMILY}, ${FALLBACK_STACK}`;
/** Pixelify Sans is drawn on an 11-unit grid per em: sizes that are multiples of 11 px stay crisp. */
export const FONT_GRID = 11;

// ── Debug font picker (?afkdebug) ──────────────────────────────────────────
// Candidates to compare against Pixelify Sans. Their files live in demo/fonts/
// (with licences) and load by URL only when picked, so the bundle doesn't grow.
// Every file was checked with fonttools: cmap has ą č ę ė į š ų ū ž + capitals;
// `grid` = unitsPerEm / the outline step, `cap` = height of H / unitsPerEm.

export type FontCandidate = {
  id: string;
  label: string;
  /** File under demo/fonts/; absent = the embedded Pixelify Sans. */
  file?: string;
  /** Design grid, in pixels per em: crisp at whole multiples of it. */
  grid: number;
  /** Snap UI (CSS) sizes to the grid; false keeps today's sizes. */
  snapUi: boolean;
  /** Cap height / em. Sizes scale so caps match Pixelify's before snapping. */
  cap: number;
  /** Has a real bold face; without one, bold isn't faked (it smears). */
  bold: boolean;
  licence: string;
  source: string;
};

/** Pixelify Sans' cap height / em (H is 631 of 1000 units). */
const PIXELIFY_CAP = 0.631;
const PIXELIFY = {
  grid: FONT_GRID,
  cap: PIXELIFY_CAP,
  bold: true,
  licence: 'OFL-1.1',
  source: 'https://github.com/google/fonts/tree/main/ofl/pixelifysans',
};

export const FONT_CANDIDATES: readonly FontCandidate[] = [
  { id: 'pixelify', label: 'Pixelify Sans (current sizes)', snapUi: false, ...PIXELIFY },
  { id: 'pixelify-snap', label: 'Pixelify Sans (snapped to 11 px)', snapUi: true, ...PIXELIFY },
  {
    id: 'press-start-2p',
    label: 'Press Start 2P (8 px grid)',
    // Unmodified original: the licence reserves the name, so no subsetting.
    file: 'press-start-2p/PressStart2P-Regular.ttf',
    grid: 8,
    snapUi: true,
    cap: 1,
    bold: false,
    licence: 'OFL-1.1',
    source: 'https://github.com/google/fonts/tree/main/ofl/pressstart2p',
  },
  {
    id: 'tiny5',
    label: 'Tiny5 (16 px grid)',
    file: 'tiny5/Tiny5-Regular.subset.woff2',
    grid: 16,
    snapUi: true,
    cap: 0.625,
    bold: false,
    licence: 'OFL-1.1',
    source: 'https://github.com/google/fonts/tree/main/ofl/tiny5',
  },
  {
    id: 'galmuri11',
    label: 'Galmuri11 (12 px grid)',
    file: 'galmuri11/Galmuri11.subset.woff2',
    grid: 12,
    snapUi: true,
    cap: 0.9167,
    bold: false,
    licence: 'OFL-1.1',
    source: 'https://github.com/quiple/galmuri',
  },
  {
    id: 'ark-pixel-12',
    label: 'Ark Pixel 12px (12 px grid)',
    file: 'ark-pixel-12/ArkPixel12-latin.subset.woff2',
    grid: 12,
    snapUi: true,
    cap: 0.75,
    bold: false,
    licence: 'OFL-1.1',
    source: 'https://github.com/TakWolf/ark-pixel-font',
  },
];

export const DEFAULT_FONT = FONT_CANDIDATES[0];

let active: FontCandidate = DEFAULT_FONT;

/** The font in use now (always Pixelify unless the debug picker changed it). */
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

/** The size variables for `f`: crisp px values, or none (CSS fallbacks) if it doesn't snap. */
export function uiFontVars(f: FontCandidate): Record<string, string> {
  if (!f.snapUi) return {};
  return Object.fromEntries(
    Object.entries(UI_FONT_SIZES).map(([k, px]) => [k, `${crispSize(px, f)}px`]),
  );
}

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
    const url = new URL(f.file, base).href;
    const face = new FontFace(fontFamily(f), `url(${JSON.stringify(url)})`);
    doc.fonts.add(face);
    load = face.load().then(() => undefined);
    candidateLoads.set(f.id, load);
    load.catch(() => {
      candidateLoads.delete(f.id);
      doc.fonts.delete(face);
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
 * is ignored by some browsers). Runs once; skips the faces if another copy of
 * the bundle already added them. Resolves when both weights are usable (or
 * after a timeout), never rejects: text just keeps the fallback stack. Games
 * mount after this so the first canvas frame already uses the font.
 */
export function loadFont(doc: Document = document): Promise<void> {
  if (ready) return ready;
  const fonts = doc.fonts;
  if (!fonts || typeof FontFace === 'undefined') return (ready = Promise.resolve());
  const has = [...fonts].some((f) => f.family.replace(/["']/g, '') === FONT_FAMILY);
  if (!has) {
    for (const [src, weight] of [
      [regularUrl, '400'],
      [boldUrl, '700'],
    ]) {
      fonts.add(new FontFace(FONT_FAMILY, `url(${src}) format('woff2')`, { weight }));
    }
  }
  const loaded = Promise.all([
    fonts.load(`11px ${FONT_FAMILY}`),
    fonts.load(`bold 11px ${FONT_FAMILY}`),
  ]).then(
    () => undefined,
    () => undefined,
  );
  // A data: URL decodes in a few ms; the timeout only guards against a stuck load.
  ready = Promise.race([loaded, new Promise<void>((r) => setTimeout(r, LOAD_TIMEOUT_MS))]);
  return ready;
}
