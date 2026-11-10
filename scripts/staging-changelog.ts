// Pure helpers for the "What's new on staging" section of the demo page.
// No I/O here; the Vite plugin (staging-changelog-plugin.ts) feeds them git output.

export const REPO_URL = 'https://github.com/ohwelleu/browser-afk-game';
export const MAX_ENTRIES = 50;

export interface ChangelogEntry {
  /** Subject without the trailing ` (#NN)`. */
  title: string;
  /** PR number from the squash-merge subject, if any. */
  pr?: number;
  /** Merge time from git (`%cI`), absent for entries from CHANGELOG.md. */
  date?: string;
}

export interface StagingChangelog {
  version: string;
  /** Short SHA of `staging`, absent when git is not available. */
  sha?: string;
  /** Where the entries came from. */
  source: 'git' | 'changelog' | 'none';
  entries: ChangelogEntry[];
  /** ISO time the list was generated. */
  generatedAt: string;
  /** How often it is regenerated, shown as a small label. */
  mode: 'page load' | 'build';
}

/** `Rain: 1 px lines (#86)` → `{ title: 'Rain: 1 px lines', pr: 86 }`. */
export function parseSubject(subject: string): { title: string; pr?: number } {
  const m = /^(.*?)\s*\(#(\d+)\)\s*$/.exec(subject.trim());
  if (!m) return { title: subject.trim() };
  return { title: m[1], pr: Number(m[2]) };
}

/** Merge commits and release commits are not features. */
export function isHiddenSubject(subject: string): boolean {
  return /^merge\b/i.test(subject) || /^release\b/i.test(subject);
}

/** Field separator of the `git log --format` used by the plugin. */
export const GIT_LOG_FORMAT = '%cI%x1f%s';

/** Parse `git log --format=GIT_LOG_FORMAT` output (newest first). */
export function parseGitLog(raw: string, max = MAX_ENTRIES): ChangelogEntry[] {
  const out: ChangelogEntry[] = [];
  for (const line of raw.split('\n')) {
    const [date, ...rest] = line.split('\x1f');
    const subject = rest.join('\x1f').trim();
    if (!date || !subject || isHiddenSubject(subject)) continue;
    out.push({ ...parseSubject(subject), date: date.trim() });
    if (out.length >= max) break;
  }
  return out;
}

/** Bullets of the `## [Unreleased]` section of CHANGELOG.md (fallback without git). */
export function parseUnreleased(markdown: string, max = MAX_ENTRIES): ChangelogEntry[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^##\s*\[Unreleased\]/i.test(l));
  if (start < 0) return [];
  const out: ChangelogEntry[] = [];
  let current: string | undefined;
  const flush = () => {
    if (current) out.push(parseSubject(current));
    current = undefined;
  };
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      current = bullet[1].trim();
    } else if (current && /^\s+\S/.test(line)) {
      current += ' ' + line.trim();
    } else {
      flush();
    }
  }
  flush();
  return out.slice(0, max);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function prUrl(pr: number): string {
  return `${REPO_URL}/pull/${pr}`;
}

export function prLink(pr: number): string {
  return `<a href="${prUrl(pr)}">#${pr}</a>`;
}

/** Escape text and render the little markdown CHANGELOG.md uses (`**bold**`, `code`). */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * A `<time>` whose text is UTC so it reads fine without JavaScript. The demo page's
 * script rewrites it into the viewer's local time zone.
 */
export function renderTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const utc = d.toISOString().slice(0, 16).replace('T', ' ');
  return `<time datetime="${d.toISOString()}">${utc} UTC</time>`;
}

export function renderEntry(e: ChangelogEntry): string {
  const date = e.date ? renderTime(e.date) : '';
  const pr = e.pr === undefined ? '' : ` (${prLink(e.pr)})`;
  return `<li>${inline(e.title)}${pr}${date ? ` <span class="sc-date">${date}</span>` : ''}</li>`;
}

export function renderSection(c: StagingChangelog): string {
  const meta = [
    `Version <code>${escapeHtml(c.version)}</code>`,
    c.sha ? `staging <code>${escapeHtml(c.sha)}</code>` : '',
    `Updated ${renderTime(c.generatedAt)} <small>(generated at ${c.mode})</small>`,
  ].filter(Boolean);
  const body = c.entries.length
    ? `<ul>\n${c.entries.map(renderEntry).join('\n')}\n</ul>`
    : '<p>Nothing is waiting on staging.</p>';
  const note =
    c.source === 'changelog'
      ? '<p><small>git history was not available; showing the Unreleased section of CHANGELOG.md.</small></p>'
      : c.source === 'none'
        ? '<p><small>git history was not available.</small></p>'
        : '';
  return `<section class="staging-changelog">
<h2>What's new on staging</h2>
<p class="sc-meta">${meta.join(' · ')}</p>
${body}
${note}
</section>`;
}
