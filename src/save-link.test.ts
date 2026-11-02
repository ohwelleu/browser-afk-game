import { describe, expect, it } from 'vitest';
import { createState, newProgress } from './game/state';
import { encodeSave, toSaveData } from './save';
import { buildSaveLink, readSaveHash, stripSaveHash, takeSaveLink } from './save-link';
import { linkError, parseSaveText, SAVE_ERRORS, savePreviewText, toImport } from './ui/save-panel';

const audio = { muted: false, track: 'synthwave', musicVolume: 0.5, sfxVolume: 0.5 };
const save = encodeSave(
  toSaveData(createState({ ...newProgress(), world: 2, stage: 3, coins: 900 }), audio, '0.0.0'),
);

/** A fake `location` + `history` pair: `replaceState` updates the location. */
function page(href: string) {
  const loc = {
    href,
    get hash() {
      return new URL(this.href).hash;
    },
  };
  const calls: string[] = [];
  const hist = {
    state: null,
    replaceState(_: unknown, __: string, url?: string | URL | null) {
      calls.push(String(url));
      loc.href = String(url);
    },
  };
  return { loc, hist, calls };
}

describe('buildSaveLink', () => {
  it('puts the save in the hash, keeping path and query', () => {
    const link = buildSaveLink('https://x.dev/demo/?afkdebug#old', save);
    expect(link).toBe(`https://x.dev/demo/?afkdebug#save=${save}`);
    expect(readSaveHash(new URL(link).hash)).toBe(save);
  });
});

describe('readSaveHash', () => {
  it('reads #save= and ignores anything else', () => {
    expect(readSaveHash(`#save=${save}`)).toBe(save);
    expect(readSaveHash(`#a=1&save=${save}`)).toBe(save);
    expect(readSaveHash('')).toBeNull();
    expect(readSaveHash('#')).toBeNull();
    expect(readSaveHash('#save=')).toBeNull();
    expect(readSaveHash('#top')).toBeNull();
  });
});

describe('stripSaveHash', () => {
  it('removes only the save param, and a bare #', () => {
    expect(stripSaveHash(`https://x.dev/demo/?q=1#save=${save}`)).toBe('https://x.dev/demo/?q=1');
    expect(stripSaveHash(`https://x.dev/#a=1&save=${save}`)).toBe('https://x.dev/#a=1');
    expect(stripSaveHash('https://x.dev/')).toBe('https://x.dev/');
  });
});

describe('boot import from a #save= link', () => {
  it('previews a valid link and clears the hash when done', () => {
    const { loc, hist, calls } = page(buildSaveLink('https://x.dev/demo/', save));
    const link = takeSaveLink(loc, hist);
    expect(link?.save).toBe(save);
    const r = parseSaveText(link!.save);
    if (!r.ok) throw new Error(r.error);
    expect(savePreviewText(r.progress)).toBe('Stage 2.3, 900 coins, no companion, 0 items');
    const current = toSaveData(createState(), { ...audio, muted: true }, '0.0.0');
    expect(toImport(current, r).coins).toBe(900);
    link!.done();
    expect(calls).toEqual(['https://x.dev/demo/']);
    // A reload now finds no link, so it doesn't import again.
    expect(takeSaveLink(loc, hist)).toBeNull();
    link!.done();
    expect(calls).toHaveLength(1);
  });

  it('gives a short error for a broken link', () => {
    const { loc, hist } = page(`https://x.dev/#save=${save.slice(0, -2)}xx`);
    const r = parseSaveText(takeSaveLink(loc, hist)!.save);
    expect(r).toEqual({ ok: false, error: SAVE_ERRORS.checksum });
    if (!r.ok) expect(linkError(r.error)).toMatch(/^This save link doesn't work\. Checksum/);
  });

  it('does nothing without a link', () => {
    const { loc, hist, calls } = page('https://x.dev/demo/');
    expect(takeSaveLink(loc, hist)).toBeNull();
    expect(calls).toEqual([]);
  });
});
