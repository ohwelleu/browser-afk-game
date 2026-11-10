import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import {
  GIT_LOG_FORMAT,
  MAX_ENTRIES,
  parseGitLog,
  parseUnreleased,
  renderSection,
  type StagingChangelog,
} from './staging-changelog.ts';

/** Placeholder in demo/index.html that gets replaced by the section. */
export const PLACEHOLDER = '<!-- staging-changelog -->';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  });
}

function refExists(ref: string, root: string): boolean {
  try {
    git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root);
    return true;
  } catch {
    return false;
  }
}

/**
 * A local branch can lag behind its remote-tracking ref (or the other way round, depending on
 * which checkout the server runs from). Use whichever is newer, i.e. descends from the other.
 */
function newestRef(local: string, root: string): string | null {
  const refs = [local, `origin/${local}`].filter((r) => refExists(r, root));
  if (refs.length < 2) return refs[0] ?? null;
  try {
    git(['merge-base', '--is-ancestor', refs[0], refs[1]], root);
    return refs[1]; // local is an ancestor of origin/…
  } catch {
    return refs[0];
  }
}

/** `git log main..staging` on the newest known `main` and `staging`. No network access. */
function readGit(root: string): { sha: string; entries: ReturnType<typeof parseGitLog> } | null {
  try {
    const base = newestRef('main', root);
    const head = newestRef('staging', root);
    if (!base || !head) return null;
    const sha = git(['rev-parse', '--short', head], root).trim();
    const raw = git(['log', `${base}..${head}`, `--format=${GIT_LOG_FORMAT}`], root);
    return { sha, entries: parseGitLog(raw, MAX_ENTRIES) };
  } catch {
    return null; // not a git checkout, or git is not installed
  }
}

export function loadStagingChangelog(
  root: string,
  version: string,
  mode: StagingChangelog['mode'],
): StagingChangelog {
  const generatedAt = new Date().toISOString();
  const fromGit = readGit(root);
  if (fromGit) {
    return {
      version,
      sha: fromGit.sha,
      source: 'git',
      entries: fromGit.entries,
      generatedAt,
      mode,
    };
  }
  try {
    const entries = parseUnreleased(readFileSync(`${root}/CHANGELOG.md`, 'utf8'), MAX_ENTRIES);
    return { version, source: entries.length ? 'changelog' : 'none', entries, generatedAt, mode };
  } catch {
    return { version, source: 'none', entries: [], generatedAt, mode };
  }
}

/**
 * Fills the `<!-- staging-changelog -->` placeholder. In dev the HTML is transformed on every
 * page request, so a reload re-reads git. For `vite build` (which does not process the demo
 * pages) the finished demo/index.html is emitted as `demo-index.html` next to the bundle.
 */
export function stagingChangelogPlugin(version: string): Plugin {
  let root = process.cwd();
  return {
    name: 'afk-demo-staging-changelog',
    configResolved(config) {
      root = config.root;
    },
    transformIndexHtml(html) {
      return html.replace(
        PLACEHOLDER,
        renderSection(loadStagingChangelog(root, version, 'page load')),
      );
    },
    generateBundle() {
      const page = readFileSync(`${root}/demo/index.html`, 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'demo-index.html',
        source: page.replace(
          PLACEHOLDER,
          renderSection(loadStagingChangelog(root, version, 'build')),
        ),
      });
    },
  };
}
