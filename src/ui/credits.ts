import type { TrackCredits } from '../audio';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** "A", "A and B", "A, B and C". */
const list = (names: string[]) =>
  names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/**
 * The music lines of Help → Credits, one per credited track (a link to its source),
 * then one line for the tracks without a credit. Text and URLs come from the tracks.
 */
export function musicCreditsHtml({ credited, uncredited }: TrackCredits): string {
  const lines = credited.map(
    (c) => `<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.text)}</a>`,
  );
  if (uncredited.length) {
    lines.push(`${esc(list(uncredited))}: original, synthesized in the browser`);
  }
  return lines.join('<br />');
}
