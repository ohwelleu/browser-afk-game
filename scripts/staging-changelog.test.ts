import { describe, expect, it } from 'vitest';
import {
  GIT_LOG_FORMAT,
  parseGitLog,
  parseSubject,
  parseUnreleased,
  prLink,
  renderEntry,
  renderSection,
  renderTime,
  type StagingChangelog,
} from './staging-changelog.ts';

describe('parseSubject', () => {
  it('strips the trailing PR number', () => {
    expect(parseSubject('Rain: 1 px lines (#86)')).toEqual({ title: 'Rain: 1 px lines', pr: 86 });
  });
  it('keeps other parentheses and subjects without a PR', () => {
    expect(parseSubject('Fix (rain) bug (#7)')).toEqual({ title: 'Fix (rain) bug', pr: 7 });
    expect(parseSubject('Direct commit')).toEqual({ title: 'Direct commit' });
    expect(parseSubject('Mentions (#12) in the middle')).toEqual({
      title: 'Mentions (#12) in the middle',
    });
  });
});

describe('parseGitLog', () => {
  const sep = '\x1f';
  const raw = [
    `2026-11-10T22:00:00+02:00${sep}Rain: lines (#86)`,
    `2026-11-10T21:00:00+02:00${sep}Merge pull request #5 from x/y`,
    `2026-11-10T20:00:00+02:00${sep}Release v0.6.0`,
    '',
    `2026-11-09T10:00:00+00:00${sep}Docs: backlog (#85)`,
  ].join('\n');

  it('keeps order, drops merge and release commits, parses PRs and dates', () => {
    expect(parseGitLog(raw)).toEqual([
      { title: 'Rain: lines', pr: 86, date: '2026-11-10T22:00:00+02:00' },
      { title: 'Docs: backlog', pr: 85, date: '2026-11-09T10:00:00+00:00' },
    ]);
  });
  it('caps the list', () => {
    expect(parseGitLog(raw, 1)).toHaveLength(1);
  });
  it('uses a format with a field separator', () => {
    expect(GIT_LOG_FORMAT).toBe('%cI%x1f%s');
  });
  it('handles empty output', () => {
    expect(parseGitLog('')).toEqual([]);
  });
});

describe('parseUnreleased', () => {
  const md = `# Changelog

## [Unreleased]

### Changed

- The **rainbow** flows faster (#84).
- A long line that
  wraps (#90)

## [0.5.0] - 2026-11-09

- Old thing
`;
  it('reads the bullets of the Unreleased section only', () => {
    expect(parseUnreleased(md)).toEqual([
      { title: 'The **rainbow** flows faster (#84).' },
      { title: 'A long line that wraps', pr: 90 },
    ]);
  });
  it('returns nothing when there is no section', () => {
    expect(parseUnreleased('# Changelog\n')).toEqual([]);
  });
});

describe('rendering', () => {
  it('links the PR', () => {
    expect(prLink(86)).toBe(
      '<a href="https://github.com/ohwelleu/browser-afk-game/pull/86">#86</a>',
    );
  });
  it('escapes titles and renders entries', () => {
    const html = renderEntry({ title: 'Fix <b> & `code`', pr: 3 });
    expect(html).toContain('Fix &lt;b&gt; &amp; <code>code</code>');
    expect(html).toContain(
      '(<a href="https://github.com/ohwelleu/browser-afk-game/pull/3">#3</a>)',
    );
    expect(html).not.toContain('<time');
  });
  it('renders times as UTC <time> elements', () => {
    expect(renderTime('2026-11-10T23:05:30+02:00')).toBe(
      '<time datetime="2026-11-10T21:05:30.000Z">2026-11-10 21:05 UTC</time>',
    );
    expect(renderTime('nonsense')).toBe('');
  });

  const base: StagingChangelog = {
    version: '0.5.0',
    sha: 'abc1234',
    source: 'git',
    entries: [{ title: 'Thing', pr: 1, date: '2026-11-10T10:00:00Z' }],
    generatedAt: '2026-11-10T11:00:00Z',
    mode: 'page load',
  };
  it('renders the header with version, sha, updated time and mode', () => {
    const html = renderSection(base);
    expect(html).toContain("What's new on staging");
    expect(html).toContain('<code>0.5.0</code>');
    expect(html).toContain('<code>abc1234</code>');
    expect(html).toContain('Updated <time datetime="2026-11-10T11:00:00.000Z">');
    expect(html).toContain('generated at page load');
    expect(html).toContain('<li>Thing');
  });
  it('handles an empty list and the changelog fallback', () => {
    expect(renderSection({ ...base, entries: [] })).toContain('Nothing is waiting on staging');
    expect(renderSection({ ...base, sha: undefined, source: 'changelog' })).toContain(
      'Unreleased section of CHANGELOG.md',
    );
    expect(renderSection({ ...base, sha: undefined, source: 'none', entries: [] })).not.toContain(
      'staging <code>',
    );
  });
});
