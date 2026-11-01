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
/** The pixel font, then the old monospace stack while it loads (or if it can't). */
export const FONT_STACK = `${FONT_FAMILY}, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
/** Pixelify Sans is drawn on an 11-unit grid per em: sizes that are multiples of 11 px stay crisp. */
export const FONT_GRID = 11;

/** Rounds a pixel size to the nearest whole multiple of the font grid (at least 1×). */
export function snapFontSize(px: number): number {
  return Math.max(1, Math.round(px / FONT_GRID)) * FONT_GRID;
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
