import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  activeFont,
  boldPrefix,
  crispSize,
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

describe('default font (Pixelify Sans)', () => {
  it('is active and snaps canvas text to the 11 px grid as before', () => {
    expect(activeFont()).toBe(DEFAULT_FONT);
    expect(snapFontSize(20)).toBe(22);
    expect(snapFontSize(28)).toBe(33);
    expect(snapFontSize(3)).toBe(11);
    expect(boldPrefix()).toBe('bold ');
    expect(fontStack().startsWith('afk-pixel,')).toBe(true);
  });

  it('keeps the shipped UI sizes', () => {
    expect(uiFontVars(DEFAULT_FONT)).toEqual({});
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
      const dir = fileURLToPath(new URL(`${f.id}/`, demoFonts));
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

  it('switch canvas text once picked (no faked bold)', async () => {
    // Node has no FontFace: useFont just switches.
    await useFont(byId('press-start-2p'), 'http://x/fonts/');
    expect(fontStack().startsWith('afk-font-press-start-2p,')).toBe(true);
    expect(boldPrefix()).toBe('');
    expect(snapFontSize(20)).toBe(16);
  });

  it('load for comparison without becoming active', async () => {
    await loadCandidate(byId('tiny5'), 'http://x/fonts/');
    expect(activeFont()).toBe(DEFAULT_FONT);
  });
});
