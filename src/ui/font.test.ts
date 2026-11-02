import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  activeFont,
  boldPrefix,
  crispSize,
  defaultFontVarsCss,
  DEFAULT_FONT,
  FONT_CANDIDATES,
  fontStack,
  loadCandidate,
  resetActiveFont,
  snapFontSize,
  uiFontVars,
  UI_FONT_SIZES,
  useFont,
} from './font';

const byId = (id: string) => FONT_CANDIDATES.find((f) => f.id === id)!;
const demoFonts = new URL('../../demo/fonts/', import.meta.url);

afterEach(resetActiveFont);

describe('default font (Press Start 2P, embedded)', () => {
  it('is active and snaps canvas text to its 8 px grid', () => {
    expect(activeFont()).toBe(DEFAULT_FONT);
    expect(DEFAULT_FONT.id).toBe('press-start-2p');
    expect(DEFAULT_FONT.file).toBeUndefined();
    // Damage numbers (scale × 5) and the banner (≥ 22) at scale 4 and 6.
    expect(snapFontSize(20)).toBe(16);
    expect(snapFontSize(30)).toBe(16);
    expect(snapFontSize(42)).toBe(24);
    expect(snapFontSize(3)).toBe(8);
    expect(boldPrefix()).toBe('');
    expect(fontStack().startsWith('afk-pixel,')).toBe(true);
  });

  it('gives the CSS crisp sizes: 8 px text, 16 px menu titles', () => {
    expect(uiFontVars(DEFAULT_FONT)).toEqual({
      '--afk-fs': '8px',
      '--afk-fs-small': '8px',
      '--afk-fs-menu': '8px',
      '--afk-fs-menu-title': '16px',
      '--afk-fs-title': '8px',
      '--afk-fs-popover': '8px',
    });
    expect(defaultFontVarsCss()).toContain('--afk-fs: 8px;');
  });

  it('keeps Pixelify at its old sizes as a picker option', () => {
    expect(uiFontVars(byId('pixelify'))['--afk-fs']).toBe('16px');
  });
});

describe('font candidates', () => {
  it('have unique ids', () => {
    const ids = FONT_CANDIDATES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(FONT_CANDIDATES.filter((f) => f.file))(
    '$id ships its files and licence in demo/fonts',
    (f) => {
      for (const file of [f.file!, f.boldFile].filter((x) => x !== undefined)) {
        expect(existsSync(fileURLToPath(new URL(file, demoFonts)))).toBe(true);
      }
      const dir = dirname(fileURLToPath(new URL(f.file!, demoFonts)));
      const licence = f.licence === 'CC0-1.0' ? 'LICENSE.txt' : 'OFL.txt';
      expect(existsSync(join(dir, licence))).toBe(true);
    },
  );

  it.each(FONT_CANDIDATES.filter((f) => f.snapUi))('$id: every UI size is on its grid', (f) => {
    const vars = uiFontVars(f);
    expect(Object.keys(vars)).toEqual(Object.keys(UI_FONT_SIZES));
    for (const v of Object.values(vars)) {
      const steps = parseFloat(v) / f.grid;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(0.01);
    }
  });

  it('only the shortlist is promised every Lithuanian letter', () => {
    for (const f of FONT_CANDIDATES.filter((c) => c.group === 'shortlist')) {
      expect(f.missing).toBeUndefined();
    }
  });

  it('scale sizes so caps roughly match Pixelify before snapping', () => {
    const pressStart = byId('press-start-2p'); // caps = 1 em: half the size
    expect(crispSize(16, pressStart)).toBe(8);
    expect(crispSize(22, pressStart)).toBe(16);
    expect(crispSize(16, byId('tiny5'))).toBe(16);
    expect(crispSize(16, byId('galmuri11'))).toBe(12);
    expect(uiFontVars(byId('pixelify-snap'))['--afk-fs-menu-title']).toBe('22px');
  });

  it('switch canvas text once picked', async () => {
    // Node has no FontFace: useFont just switches.
    await useFont(byId('pixelify'), 'http://x/fonts/');
    expect(fontStack().startsWith('afk-font-pixelify,')).toBe(true);
    expect(boldPrefix()).toBe('bold ');
    expect(snapFontSize(20)).toBe(22);
  });

  it('load for comparison without becoming active', async () => {
    await loadCandidate(byId('tiny5'), 'http://x/fonts/');
    expect(activeFont()).toBe(DEFAULT_FONT);
  });
});
