/**
 * Reads every sprite source in an art folder and builds the generated modules.
 *
 * - `<name>.png` + `<name>.json`: Aseprite sprite sheet, one animation per tag.
 * - `<name>-<anim>.png` without JSON: a horizontal strip, cut by `--frame`
 *   (or one frame for the whole image).
 *
 * Files are grouped by the text before the first `-`, so `hero.json` and
 * `hero-hurt.png` both end up in `hero.ts`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { asepriteToStrips } from './aseprite.ts';
import {
  checkSameSize,
  exportName,
  pngToStrip,
  renderModule,
  type FrameSize,
  type Strip,
} from './convert.ts';

export type Built = { name: string; source: string; summary: string };

export function buildSprites(
  artDir: string,
  frame?: FrameSize,
  /** Prefix for paths in errors and the `// Source:` line. */
  shownDir = artDir,
): { modules: Built[]; errors: string[]; files: number } {
  const groups = new Map<string, { file: string; strip: Strip }[]>();
  const errors: string[] = [];
  const add = (base: string, file: string, strip: Strip) => {
    const name = base.split('-')[0];
    groups.set(name, [...(groups.get(name) ?? []), { file, strip }]);
  };

  const all = readdirSync(artDir).sort();
  const jsons = all.filter((f) => f.endsWith('.json'));
  const sheets = new Set(jsons.map((f) => f.slice(0, -5) + '.png'));
  for (const file of jsons) {
    const base = file.slice(0, -5);
    const png = `${base}.png`;
    if (!existsSync(join(artDir, png))) {
      errors.push(`${shownDir}/${file}: no ${png} next to it`);
      continue;
    }
    const res = asepriteToStrips(
      readFileSync(join(artDir, png)),
      readFileSync(join(artDir, file), 'utf8'),
      base,
      { png: `${shownDir}/${png}`, json: `${shownDir}/${file}` },
    );
    errors.push(...res.errors);
    for (const strip of res.strips) add(base, png, strip);
  }
  const strips = all.filter((f) => f.endsWith('.png') && !sheets.has(f));
  for (const file of strips) {
    const label = file.slice(0, -4);
    const res = pngToStrip(readFileSync(join(artDir, file)), label, frame);
    errors.push(...res.errors);
    add(label, file, res.strip);
  }

  for (const list of groups.values()) {
    errors.push(...checkSameSize(list.map((e) => e.strip)));
    const byExport = new Map<string, string>();
    for (const { file, strip } of list) {
      const prev = byExport.get(exportName(strip.label));
      if (prev)
        errors.push(`${shownDir}/${file}: ${strip.label} is defined twice (also in ${prev})`);
      else byExport.set(exportName(strip.label), `${shownDir}/${file}`);
    }
  }

  const modules = [...groups].map(([name, list]) => ({
    name,
    source: renderModule(
      list.map((e) => e.strip),
      [...new Set(list.map((e) => `${shownDir}/${e.file}`))],
    ),
    summary: list.map((e) => `${e.strip.label} ${e.strip.frames.length}f`).join(', '),
  }));
  return { modules, errors, files: jsons.length + strips.length };
}
