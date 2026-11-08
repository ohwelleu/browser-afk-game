// node zoom.mjs out.png scale bgHex in1.png in2.png ... -> contact sheet, nearest-neighbour
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
const [out, sc, bg, ...ins] = process.argv.slice(2);
const S = +sc;
const imgs = ins.map((f) => PNG.sync.read(readFileSync(f)));
const pad = 2,
  H = Math.max(...imgs.map((i) => i.height));
const W = imgs.reduce((a, i) => a + i.width + pad, pad);
const o = new PNG({ width: W * S, height: (H + 2 * pad) * S });
const b = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
for (let i = 0; i < o.width * o.height; i++) o.data.set([...b, 255], i * 4);
let x0 = pad;
for (const im of imgs) {
  const y0 = pad + H - im.height;
  for (let y = 0; y < im.height; y++)
    for (let x = 0; x < im.width; x++) {
      const p = im.data.slice((y * im.width + x) * 4, (y * im.width + x) * 4 + 4);
      if (!p[3]) continue;
      for (let dy = 0; dy < S; dy++)
        for (let dx = 0; dx < S; dx++)
          o.data.set(
            [p[0], p[1], p[2], 255],
            (((y0 + y) * S + dy) * o.width + (x0 + x) * S + dx) * 4,
          );
    }
  x0 += im.width + pad;
}
writeFileSync(out, PNG.sync.write(o));
