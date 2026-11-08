// Exports reference PNGs (1x, light palette) from the game's sprite data:
//   node art/pixellab/demon-woman/export-refs.mjs
import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

const OUT = 'art/pixellab/demon-woman/refs';
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const { DEFAULT_PALETTES } = await server.ssrLoadModule('/src/theme.ts');
  const { framePixels } = await server.ssrLoadModule('/src/render/sprites.ts');
  const s = await server.ssrLoadModule('/src/sprites/index.ts');
  const pal = DEFAULT_PALETTES.light;
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const save = (name, def, frame = 0) => {
    const px = framePixels(def, frame, pal);
    const png = new PNG({ width: def.width, height: def.height });
    px.forEach((c, i) => {
      const [r, g, b] = c ? hex(c) : [0, 0, 0];
      png.data.set([r, g, b, c ? 255 : 0], i * 4);
    });
    writeFileSync(`${OUT}/${name}.png`, PNG.sync.write(png));
    console.log(name, def.width, def.height);
  };
  save('sword-iron-fwd', s.ironSword.poses.fwd.sprite);
  save('sword-wooden-fwd', s.woodenSword.poses.fwd.sprite);
  save('hero-idle', s.heroIdle);
  save('mob-mushroom', s.mobs.mushroom);
  save(
    'boss-mushroom',
    s.bossMushroomWalk ?? Object.values(s).find((v) => v?.name === 'boss-mushroom-walk'),
  );
  // palette strip (one swatch per colour, 10x1)
  const cols = [
    'bg',
    'fg',
    'orange',
    'yellow',
    'red',
    'purple',
    'green',
    'blue',
    'pink',
    'brown',
  ].map((k) => pal[k]);
  const png = new PNG({ width: cols.length * 4, height: 4 });
  cols.forEach((c, i) => {
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) png.data.set([...hex(c), 255], (y * png.width + i * 4 + x) * 4);
  });
  writeFileSync(`${OUT}/palette.png`, PNG.sync.write(png));
  console.log(cols.join(' '));
} finally {
  await server.close();
}
