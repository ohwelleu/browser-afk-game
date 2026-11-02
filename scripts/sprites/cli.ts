/**
 * `npm run sprites [-- --frame 32x64]`
 *
 * Reads Aseprite sheets (`art/<name>.png` + `art/<name>.json`, one animation
 * per tag, frame durations kept) and plain horizontal strips
 * (`art/<name>-<anim>.png`, cut by `--frame`), checks every pixel against the
 * palette and writes
 * `src/sprites/generated/<name>.ts`. Any error fails the run and nothing is written.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSprites } from './build.ts';
import { parseFrameSize, type FrameSize } from './convert.ts';

const ART = 'art';
const OUT = join('src', 'sprites', 'generated');

function main(args: string[]): number {
  let frame: FrameSize | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--frame') frame = parseFrameSize(args[++i] ?? '');
    else if (args[i].startsWith('--frame=')) frame = parseFrameSize(args[i].slice(8));
    else throw new Error(`unknown argument "${args[i]}"`);
  }

  const { modules, errors, files } = buildSprites(ART, frame);

  if (errors.length) {
    const shown = errors.slice(0, 50);
    for (const e of shown) console.error(e);
    if (errors.length > shown.length) console.error(`… and ${errors.length - shown.length} more`);
    console.error(`\nsprites: ${errors.length} error(s), nothing written`);
    return 1;
  }

  mkdirSync(OUT, { recursive: true });
  for (const m of modules) {
    const path = join(OUT, `${m.name}.ts`);
    writeFileSync(path, m.source);
    console.log(`${path.replace(/\\/g, '/')}  (${m.summary})`);
  }
  if (!files) console.log(`sprites: no PNG files in ${ART}/`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(`sprites: ${(e as Error).message}`);
  process.exitCode = 1;
}
