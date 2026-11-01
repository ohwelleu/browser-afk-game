/**
 * `npm run sprites [-- --frame 32x64]`
 *
 * Reads `art/<name>.png` and `art/<name>-<anim>.png` (horizontal strips),
 * checks every pixel against the palette and writes
 * `src/sprites/generated/<name>.ts`. Any error fails the run and nothing is written.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  checkSameSize,
  parseFrameSize,
  pngToStrip,
  renderModule,
  type FrameSize,
  type Strip,
} from './convert.ts';

const ART = 'art';
const OUT = join('src', 'sprites', 'generated');

function main(args: string[]): number {
  let frame: FrameSize | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--frame') frame = parseFrameSize(args[++i] ?? '');
    else if (args[i].startsWith('--frame=')) frame = parseFrameSize(args[i].slice(8));
    else throw new Error(`unknown argument "${args[i]}"`);
  }

  // Group files by character: `hero-idle.png` and `hero-slash.png` → `hero`.
  const groups = new Map<string, { file: string; strip: Strip }[]>();
  const errors: string[] = [];
  const files = readdirSync(ART)
    .filter((f) => f.endsWith('.png'))
    .sort();
  for (const file of files) {
    const label = file.slice(0, -4);
    const name = label.split('-')[0];
    const res = pngToStrip(readFileSync(join(ART, file)), label, frame);
    errors.push(...res.errors);
    groups.set(name, [...(groups.get(name) ?? []), { file, strip: res.strip }]);
  }
  for (const list of groups.values()) errors.push(...checkSameSize(list.map((e) => e.strip)));

  if (errors.length) {
    const shown = errors.slice(0, 50);
    for (const e of shown) console.error(e);
    if (errors.length > shown.length) console.error(`… and ${errors.length - shown.length} more`);
    console.error(`\nsprites: ${errors.length} error(s), nothing written`);
    return 1;
  }

  mkdirSync(OUT, { recursive: true });
  for (const [name, list] of groups) {
    const path = join(OUT, `${name}.ts`);
    const src = renderModule(
      list.map((e) => e.strip),
      list.map((e) => `${ART}/${e.file}`),
    );
    writeFileSync(path, src);
    const summary = list.map((e) => `${e.strip.label} ${e.strip.frames.length}f`).join(', ');
    console.log(`${path.replace(/\\/g, '/')}  (${summary})`);
  }
  if (!files.length) console.log(`sprites: no PNG files in ${ART}/`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(`sprites: ${(e as Error).message}`);
  process.exitCode = 1;
}
