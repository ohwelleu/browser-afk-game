import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
    '$id ships its file and licence in demo/fonts',
    (f) => {
      const file = new URL(f.file!, demoFonts);
      expect(existsSync(file)).toBe(true);
      expect(existsSync(join(dirname(file.pathname.replace(/^\/(\w:)/, '$1')), 'OFL.txt'))).toBe(
        true,
      );
    },
  );

  it.each(FONT_CANDIDATES.filter((f) => f.snapUi))('$id: every UI size is on its grid', (f) => {
    const vars = uiFontVars(f);
    expect(Object.keys(vars)).toEqual(Object.keys(UI_FONT_SIZES));
    for (const v of Object.values(vars)) expect(parseInt(v) % f.grid).toBe(0);
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
