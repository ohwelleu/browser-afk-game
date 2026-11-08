import { describe, expect, it } from 'vitest';
import { trackCredit, trackCredits } from '../audio';
import { musicCreditsHtml } from './credits';

describe('musicCreditsHtml', () => {
  const html = musicCreditsHtml(trackCredits());

  it('links the Gaming Time credit to the author, from the track data', () => {
    const c = trackCredit('gaming-time')!;
    expect(c.text).toBe('Music: Gaming Time by Otrebil');
    expect(html).toContain(
      `<a href="${c.url}" target="_blank" rel="noopener noreferrer">${c.text}</a>`,
    );
    expect(c.url).toBe('https://www.youtube.com/watch?v=qx7avPhISBo');
  });

  it('adds one line for the tracks without a credit', () => {
    expect(html).toContain('Synthwave and Medieval: original, synthesized in the browser');
  });

  it('joins three names with commas and "and"', () => {
    const out = musicCreditsHtml({ credited: [], uncredited: ['A', 'B', 'C'] });
    expect(out).toBe('A, B and C: original, synthesized in the browser');
  });

  it('escapes credit text and URLs', () => {
    const out = musicCreditsHtml({
      credited: [{ text: 'Music: <b>&"', url: 'https://x.test/?a=1&b="2"' }],
      uncredited: [],
    });
    expect(out).not.toContain('<b>');
    expect(out).toContain('href="https://x.test/?a=1&#38;b=&#34;2&#34;"');
  });
});
