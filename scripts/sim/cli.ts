/**
 * `npm run sim -- [--bot idle] [--seed 1] [--duration 1h] [--sample 60s] [--out sim-out] [--json] [--list]`
 *
 * Runs one simulated player (docs/design/simulator.md) on the game's own
 * tick loop and writes `<out>/<bot>-<yyyymmdd-hhmm>/runs.json`. `--json`
 * prints the JSON to stdout instead (nothing is written). Same flags, same
 * seed: same JSON, byte for byte.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { RunResult, SimOptions } from '../../src/sim/index.ts';
import { bundleSim } from './bundle.ts';

type SimModule = {
  BOTS: Record<string, unknown>;
  DEFAULTS: Required<Omit<SimOptions, 'version'>>;
  simulate(opts: SimOptions): RunResult;
  summaryText(r: RunResult): string;
};

const HELP = `Usage: npm run sim -- [options]

  --bot <name>        player model (default idle; --list shows them)
  --seed <n>          seed for drops, crits, picks (default 1)
  --duration <time>   simulated play time: 90s, 10m, 8h, 1d, 1h30m (default 1h)
  --sample <time>     time between samples (default 60s; at most 1500 samples)
  --out <dir>         output folder (default sim-out)
  --json              print the result as JSON instead of writing a file
  --list              list the bots
  -h, --help          this text`;

const stamp = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

async function main(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      bot: { type: 'string' },
      seed: { type: 'string' },
      duration: { type: 'string' },
      sample: { type: 'string' },
      out: { type: 'string', default: 'sim-out' },
      json: { type: 'boolean', default: false },
      list: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return;
  }

  const sim = (await import(pathToFileURL(await bundleSim()).href)) as SimModule;
  if (values.list) {
    console.log(`bots: ${Object.keys(sim.BOTS).join(', ')}`);
    return;
  }

  const seed = values.seed === undefined ? undefined : Number(values.seed);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
  const started = performance.now();
  const result = sim.simulate({
    bot: values.bot,
    seed,
    duration: values.duration,
    sample: values.sample,
    version: pkg.version,
  });
  const ms = performance.now() - started;
  const json = JSON.stringify([result], null, 2) + '\n';

  if (values.json) {
    process.stdout.write(json);
    return;
  }
  const dir = join(values.out, `${result.meta.bot}-${stamp(new Date())}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'runs.json');
  writeFileSync(file, json);
  console.log(sim.summaryText(result));
  console.log(`ran in ${(ms / 1000).toFixed(2)} s · wrote ${file}`);
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
