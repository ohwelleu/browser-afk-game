// Lists off-palette colours of PNGs: node check-palette.mjs a.png b.png ...
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const PAL = [
  '#1f1f1f',
  '#ece9e2',
  '#ff6b00',
  '#eab308',
  '#dc2626',
  '#7c3aed',
  '#16a34a',
  '#2563eb',
  '#db2777',
  '#8b5a2b',
];
for (const f of process.argv.slice(2)) {
  const p = PNG.sync.read(readFileSync(f));
  const bad = new Map();
  const used = new Map();
  let opaque = 0,
    semi = 0;
  for (let i = 0; i < p.width * p.height; i++) {
    const [r, g, b, a] = p.data.slice(i * 4, i * 4 + 4);
    if (a === 0) continue;
    if (a < 255) semi++;
    opaque++;
    const h = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    (PAL.includes(h) ? used : bad).set(h, (bad.get(h) ?? used.get(h) ?? 0) + 1);
  }
  const offN = [...bad.values()].reduce((a, b) => a + b, 0);
  console.log(
    `${f}: ${p.width}x${p.height} opaque=${opaque} semi=${semi} offPalettePx=${offN} offColours=${bad.size} used=${[...used.keys()].join(',')}`,
  );
}
