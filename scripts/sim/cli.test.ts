import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const cli = (...args: string[]) =>
  spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--no-warnings=ExperimentalWarning',
      'scripts/sim/cli.ts',
      ...args,
    ],
    { encoding: 'utf8' },
  );

describe('npm run sim', () => {
  it('bundles the sim and prints one run as JSON', { timeout: 60_000 }, () => {
    const out = cli('--json', '--duration', '30s', '--seed', '3');
    expect(out.stderr).toBe('');
    expect(out.status).toBe(0);
    const [run] = JSON.parse(out.stdout);
    expect(run.meta).toMatchObject({ bot: 'idle', seed: 3, durationTicks: 1800 });
    expect(run.totals.ticks).toBe(1800);
    expect(run.totals.kills).toBeGreaterThan(0);
  });

  it('fails with a message on a bad flag value', { timeout: 60_000 }, () => {
    const out = cli('--json', '--bot', 'nope');
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('Unknown bot "nope"');
  });
});
