/**
 * `npm run colors-doc`
 *
 * Reads the palette (`src/theme.ts`), the sprite slot map (`src/render/sprites.ts`)
 * and every sprite exported from `src/sprites/index.ts`, then writes:
 *
 * - `docs/images/colors/*.png`: swatch sheets, per-colour swatches and sample
 *   sprites, in both themes;
 * - the generated block of `docs/COLORS.md` (between the `colors-doc` markers):
 *   the slot table and which sprites use each slot.
 *
 * Nothing is hard-coded here except labels: a new colour or slot added to the
 * game shows up the next time this runs.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

type Palette = Record<string, string>;
type Theme = 'light' | 'dark';
type SpriteDef = { name: string; width: number; height: number; frames: string[][] };
type Point = { x: number; y: number };
type WeaponDef = {
  name: string;
  poses: Record<string, { sprite: SpriteDef; grip: Point }>;
};

const THEMES: Theme[] = ['light', 'dark'];
const OUT_DIR = join('docs', 'images', 'colors');
const DOC = join('docs', 'COLORS.md');
const IMG = 'images/colors';
const START = '<!-- colors-doc:start -->';
const END = '<!-- colors-doc:end -->';

/** Human notes per palette key. A key missing here still gets a row, marked as undocumented. */
const USED_FOR: Record<string, string> = {
  fg: 'Ink: bodies, coats, outlines. UI text, borders, HP bar frame, damage numbers on the mob.',
  bg: 'Cut-outs inside a silhouette (eyes, hand, folds), outlines that separate ink from ink. Canvas and UI background.',
  orange: 'Accents. Coin pick-up numbers (`+12`).',
  yellow: 'Gold, buttons, buckles. Prices in the shop, S-tier item frame and sparkle.',
  red: 'Eyes, scarf, blood. Hit flash (whole sprite), damage taken by the hero, low HP bar, error text.',
  purple: 'Accents. Stage label (canvas and HUD) on boss stages.',
  green: 'Leaves, stems. HP bar, B-tier item frame, "on" tags, debug OK text.',
  blue: 'Accents. Crow damage numbers, A-tier item frame.',
  pink: 'Accents.',
};

// ---------------------------------------------------------------- loading

async function loadGame() {
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  });
  try {
    const theme = await server.ssrLoadModule('/src/theme.ts');
    const render = await server.ssrLoadModule('/src/render/sprites.ts');
    const sprites = await server.ssrLoadModule('/src/sprites/index.ts');
    return { theme, render, sprites };
  } finally {
    await server.close();
  }
}

type Game = Awaited<ReturnType<typeof loadGame>>;

type Slot = { letter: string; key: string | null };

/**
 * Letter → palette key, read through the game's own `framePixels`: a 1×1 sprite
 * per slot letter, resolved against a palette whose values are its own keys.
 */
function readSlots(game: Game): Slot[] {
  const letters: readonly string[] = game.sprites.PALETTE_SLOTS;
  const keys = Object.keys(game.theme.DEFAULT_PALETTES.light);
  const echo = Object.fromEntries(keys.map((k) => [k, k]));
  return letters.map((letter) => {
    const def = { name: `slot-${letter}`, width: 1, height: 1, frames: [[letter]] };
    game.render.validateSprite(def);
    const [key] = game.render.framePixels(def, 0, echo) as (string | null)[];
    return { letter, key };
  });
}

function isSprite(v: unknown): v is SpriteDef {
  const o = v as SpriteDef;
  return (
    !!o && typeof o.name === 'string' && typeof o.width === 'number' && Array.isArray(o.frames)
  );
}

/** Every distinct sprite reachable from the module's exports. */
function collectSprites(mod: Record<string, unknown>): SpriteDef[] {
  const found = new Set<SpriteDef>();
  const seen = new Set<unknown>();
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (isSprite(v)) {
      found.add(v);
      return;
    }
    for (const child of Object.values(v)) walk(child);
  };
  walk(mod);
  return [...found].sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- drawing

type RGBA = [number, number, number, number];

function hexToRgba(hex: string): RGBA {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

class Image {
  png: PNG;
  constructor(width: number, height: number, fill?: string) {
    this.png = new PNG({ width, height });
    if (fill) this.rect(0, 0, width, height, fill);
  }
  px(x: number, y: number, c: RGBA): void {
    x = Math.floor(x);
    y = Math.floor(y);
    const { width, height, data } = this.png;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = c[0];
    data[i + 1] = c[1];
    data[i + 2] = c[2];
    data[i + 3] = c[3];
  }
  rect(x: number, y: number, w: number, h: number, color: string | RGBA): void {
    const c = typeof color === 'string' ? hexToRgba(color) : color;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  frame(x: number, y: number, w: number, h: number, color: string, t = 2): void {
    this.rect(x, y, w, t, color);
    this.rect(x, y + h - t, w, t, color);
    this.rect(x, y, t, h, color);
    this.rect(x + w - t, y, t, h, color);
  }
  checker(x: number, y: number, w: number, h: number, a: string, b: string, cell = 5): void {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++)
        this.px(x + i, y + j, hexToRgba((Math.floor(i / cell) + Math.floor(j / cell)) % 2 ? a : b));
  }
  save(file: string): void {
    writeFileSync(join(OUT_DIR, file), PNG.sync.write(this.png));
    console.log(`${OUT_DIR.replace(/\\/g, '/')}/${file}`);
  }
}

// 3×5 pixel font for labels (uppercase, digits, a few symbols); rows separated by spaces.
const GLYPHS: Record<string, string> = {
  A: '.#. #.# ### #.# #.#',
  B: '##. #.# ##. #.# ##.',
  C: '.## #.. #.. #.. .##',
  D: '##. #.# #.# #.# ##.',
  E: '### #.. ##. #.. ###',
  F: '### #.. ##. #.. #..',
  G: '.## #.. #.# #.# .##',
  H: '#.# #.# ### #.# #.#',
  I: '### .#. .#. .#. ###',
  J: '..# ..# ..# #.# .#.',
  K: '#.# #.# ##. #.# #.#',
  L: '#.. #.. #.. #.. ###',
  M: '#.# ### ### #.# #.#',
  N: '##. #.# #.# #.# #.#',
  O: '.#. #.# #.# #.# .#.',
  P: '##. #.# ##. #.. #..',
  Q: '.#. #.# #.# ##. .##',
  R: '##. #.# ##. #.# #.#',
  S: '.## #.. .#. ..# ##.',
  T: '### .#. .#. .#. .#.',
  U: '#.# #.# #.# #.# ###',
  V: '#.# #.# #.# #.# .#.',
  W: '#.# #.# ### ### #.#',
  X: '#.# #.# .#. #.# #.#',
  Y: '#.# #.# .#. .#. .#.',
  Z: '### ..# .#. #.. ###',
  '0': '### #.# #.# #.# ###',
  '1': '.#. ##. .#. .#. ###',
  '2': '##. ..# .#. #.. ###',
  '3': '##. ..# .#. ..# ##.',
  '4': '#.# #.# ### ..# ..#',
  '5': '### #.. ##. ..# ##.',
  '6': '.## #.. ### #.# ###',
  '7': '### ..# .#. .#. .#.',
  '8': '### #.# ### #.# ###',
  '9': '### #.# ### ..# ##.',
  '#': '.#.#. ##### .#.#. ##### .#.#.',
  o: '... ### #.# #.# ###',
  '.': '... ... ... ... .#.',
  '-': '... ... ### ... ...',
  '(': '.#. #.. #.. #.. .#.',
  ')': '.#. ..# ..# ..# .#.',
  '/': '..# ..# .#. #.. #..',
  ':': '... .#. ... .#. ...',
  ' ': '... ... ... ... ...',
  '?': '##. ..# .#. ... .#.',
};

/** Glyph rows for `ch`: own glyph if there is one (so `o` ≠ `O`), else its uppercase. */
function glyph(ch: string): string[] {
  return (GLYPHS[ch] ?? GLYPHS[ch.toUpperCase()] ?? GLYPHS['?']).split(' ');
}

const FONT_SCALE = 3;
const LINE_H = 7 * FONT_SCALE;

function textWidth(s: string): number {
  return [...s].reduce((w, ch) => w + (glyph(ch)[0].length + 1) * FONT_SCALE, 0) - FONT_SCALE;
}

function drawText(img: Image, s: string, x: number, y: number, color: string): void {
  const c = hexToRgba(color);
  for (const ch of s) {
    const rows = glyph(ch);
    rows.forEach((row, j) => {
      [...row].forEach((bit, i) => {
        if (bit === '#')
          img.rect(x + i * FONT_SCALE, y + j * FONT_SCALE, FONT_SCALE, FONT_SCALE, c);
      });
    });
    x += (rows[0].length + 1) * FONT_SCALE;
  }
}

// ---------------------------------------------------------------- images

function swatchSheet(theme: Theme, slots: Slot[], palette: Palette): void {
  const pad = 24;
  const sw = 48;
  const rowH = sw + 12;
  const title = `${theme} theme`;
  const rows = slots.map((s) => ({
    letter: s.letter,
    name: s.key ?? 'transparent',
    hex: s.key ? palette[s.key] : '-',
    color: s.key ? palette[s.key] : null,
  }));
  const colLetter = pad;
  const colSwatch = colLetter + textWidth('#') + 16;
  const colName = colSwatch + sw + 20;
  const colHex = colName + Math.max(...rows.map((r) => textWidth(r.name.toUpperCase()))) + 32;
  const width = colHex + textWidth('#000000') + pad;
  const top = pad + LINE_H + 16;
  const height = top + rows.length * rowH + pad - 12;

  const img = new Image(width, height, palette.bg);
  drawText(img, title.toUpperCase(), pad, pad, palette.fg);
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    const ty = y + (sw - 5 * FONT_SCALE) / 2;
    drawText(img, r.letter, colLetter, ty, palette.fg);
    if (r.color) img.rect(colSwatch, y, sw, sw, r.color);
    else img.checker(colSwatch, y, sw, sw, '#ffffff', '#c8c8c8', 8);
    img.frame(colSwatch, y, sw, sw, palette.fg);
    drawText(img, r.name.toUpperCase(), colName, ty, palette.fg);
    drawText(img, r.hex, colHex, ty, palette.fg);
  });
  img.save(`swatches-${theme}.png`);
}

/** Small square per palette key and theme, for the Markdown table. */
function chip(theme: Theme, key: string, palette: Palette): void {
  const img = new Image(20, 20, theme === 'light' ? '#1f1f1f' : '#ece9e2');
  img.rect(2, 2, 16, 16, palette[key]);
  img.save(`chip-${theme}-${key}.png`);
}

type Layer = { def: SpriteDef; frame: number; x: number; y: number };
type Sample = { label: string; layers: Layer[] };

function samples(game: Game): Sample[] {
  const s = game.sprites;
  const one = (label: string, def: SpriteDef): Sample => ({
    label,
    layers: [{ def, frame: 0, x: 0, y: 0 }],
  });
  const weapons: WeaponDef[] = s.weapons;
  const best = weapons[weapons.length - 1];
  const anchor = s.heroWeaponAnchors.idle[0] as {
    x: number;
    y: number;
    pose: string;
    behind?: boolean;
  };
  const pose = best.poses[anchor.pose];
  const weaponLayer = {
    def: pose.sprite,
    frame: 0,
    x: anchor.x - pose.grip.x,
    y: anchor.y - pose.grip.y,
  };
  const heroLayer = { def: s.heroIdle as SpriteDef, frame: 0, x: 0, y: 0 };
  return [
    { label: 'hero', layers: anchor.behind ? [weaponLayer, heroLayer] : [heroLayer, weaponLayer] },
    ...weapons.map((w) => one(w.name, w.poses.up.sprite)),
    ...Object.entries(s.mobs as Record<string, SpriteDef>).map(([k, d]) => one(k, d)),
    one('crow', s.crowIdle),
    one('coin', s.coinSpin),
    one('ring', s.itemRing),
    one('pendant', s.itemPendant),
    one('earring', s.itemEarring),
    one('belt', s.itemBelt),
  ];
}

function spriteSheet(game: Game, theme: Theme, palette: Palette, list: Sample[]): void {
  const scale = 4;
  const pad = 24;
  const gap = 28;
  const cells = list.map((s) => {
    const sample = { ...s, label: s.label.toUpperCase() };
    const minX = Math.min(...sample.layers.map((l) => l.x));
    const minY = Math.min(...sample.layers.map((l) => l.y));
    const maxX = Math.max(...sample.layers.map((l) => l.x + l.def.width));
    const maxY = Math.max(...sample.layers.map((l) => l.y + l.def.height));
    const w = Math.max((maxX - minX) * scale, textWidth(sample.label));
    return { sample, minX, minY, w, h: (maxY - minY) * scale };
  });
  const spriteH = Math.max(...cells.map((c) => c.h));
  const width = pad * 2 + cells.reduce((n, c) => n + c.w, 0) + gap * (cells.length - 1);
  const height = pad * 3 + LINE_H + spriteH + LINE_H;

  const img = new Image(width, height, palette.bg);
  drawText(img, `${theme} theme`.toUpperCase(), pad, pad, palette.fg);
  let x = pad;
  const baseline = pad * 2 + LINE_H + spriteH;
  for (const c of cells) {
    const spriteW = (Math.max(...c.sample.layers.map((l) => l.x + l.def.width)) - c.minX) * scale;
    const left = x + Math.floor((c.w - spriteW) / 2);
    const topY = baseline - c.h;
    for (const l of c.sample.layers) {
      const pixels = game.render.framePixels(l.def, l.frame, palette) as (string | null)[];
      pixels.forEach((color, i) => {
        if (!color) return;
        const px = (l.x - c.minX + (i % l.def.width)) * scale;
        const py = (l.y - c.minY + Math.floor(i / l.def.width)) * scale;
        img.rect(left + px, topY + py, scale, scale, color);
      });
    }
    drawText(
      img,
      c.sample.label,
      x + Math.floor((c.w - textWidth(c.sample.label)) / 2),
      baseline + 12,
      palette.fg,
    );
    x += c.w + gap;
  }
  img.save(`sprites-${theme}.png`);
}

// ---------------------------------------------------------------- markdown

function usage(sprites: SpriteDef[], letter: string): string[] {
  return [
    ...new Set(
      sprites
        .filter((d) => d.frames.some((f) => f.some((r) => r.includes(letter))))
        .map((d) => d.name),
    ),
  ];
}

function markdown(game: Game, slots: Slot[], sprites: SpriteDef[]): string {
  const pal = game.theme.DEFAULT_PALETTES as Record<Theme, Palette>;
  const lines: string[] = [];
  lines.push(
    `_Generated by \`npm run colors-doc\` from \`src/theme.ts\`, \`src/render/sprites.ts\` and the ${sprites.length} sprites exported by \`src/sprites/index.ts\`. Don't edit by hand._`,
    '',
    '| Slot | Name | Light | Dark | Used for | Sprites |',
    '| ---- | ---- | ----- | ---- | -------- | ------- |',
  );
  for (const s of slots) {
    const n = usage(sprites, s.letter).length;
    if (!s.key) {
      lines.push(
        `| \`${s.letter}\` | transparent | - | - | Background around the sprite. | ${n} |`,
      );
      continue;
    }
    const key = s.key;
    const cell = (t: Theme) => `![${t} ${key}](${IMG}/chip-${t}-${key}.png) \`${pal[t][key]}\``;
    const note =
      USED_FOR[s.key] ?? '_Not described yet: add it to `USED_FOR` in `scripts/colors-doc.ts`._';
    lines.push(
      `| \`${s.letter}\` | ${s.key} | ${cell('light')} | ${cell('dark')} | ${note} | ${n} |`,
    );
  }
  const unused = Object.keys(pal.light).filter((k) => !slots.some((s) => s.key === k));
  if (unused.length) {
    lines.push(
      '',
      `Palette colours with no sprite slot (UI only): ${unused.map((k) => `\`${k}\``).join(', ')}.`,
    );
  }
  lines.push('', '### Which sprites use each slot', '');
  for (const s of slots) {
    if (!s.key) continue;
    const names = usage(sprites, s.letter);
    lines.push(
      `- **\`${s.letter}\` ${s.key}** (${names.length}): ${names.length ? names.map((n) => `\`${n}\``).join(', ') : '_none_'}`,
    );
  }
  return lines.join('\n');
}

function writeDoc(block: string): void {
  const doc = readFileSync(DOC, 'utf8');
  const a = doc.indexOf(START);
  const b = doc.indexOf(END);
  if (a < 0 || b < a) throw new Error(`${DOC}: missing ${START} / ${END} markers`);
  writeFileSync(DOC, `${doc.slice(0, a + START.length)}\n\n${block}\n\n${doc.slice(b)}`);
  console.log(`${DOC.replace(/\\/g, '/')} (generated block)`);
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  const game = await loadGame();
  const slots = readSlots(game);
  const sprites = collectSprites(game.sprites);
  const list = samples(game);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const theme of THEMES) {
    const palette = game.theme.DEFAULT_PALETTES[theme] as Palette;
    swatchSheet(theme, slots, palette);
    for (const key of Object.keys(palette)) chip(theme, key, palette);
    spriteSheet(game, theme, palette, list);
  }
  writeDoc(markdown(game, slots, sprites));
  if (readdirSync(OUT_DIR).length === 0) throw new Error('no images written');
}

main().catch((e) => {
  console.error(`colors-doc: ${(e as Error).message}`);
  process.exitCode = 1;
});
