// Runs the sprite converter's own checks on a folder without writing anything:
//   node --experimental-strip-types --no-warnings=ExperimentalWarning art/pixellab/demon-woman/convert-check.mts <dir> 64x64
import { buildSprites } from '../../../scripts/sprites/build.ts';
import { parseFrameSize } from '../../../scripts/sprites/convert.ts';
const [dir, size] = process.argv.slice(2);
const { modules, errors, files } = buildSprites(
  dir,
  parseFrameSize(size),
  'art/pixellab/demon-woman',
);
console.log(`files=${files} modules=${modules.map((m) => `${m.name}: ${m.summary}`).join('; ')}`);
for (const e of errors) console.log(e);
console.log(errors.length ? `${errors.length} error(s)` : 'palette check OK');
