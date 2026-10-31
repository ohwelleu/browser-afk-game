// Sprite preview: every sprite and animation at 1× / 3× / 6× in both themes.
// Run with `npx vite demo` and open /sprites.html.
import * as S from "../src/sprites/index";
import type { Point, SpriteDef, WeaponAnchor, WeaponDef } from "../src/sprites/types";
import { validateAnchors, validateSprite, validateWeapon } from "../src/sprites/validate";

type Theme = { name: string; bg: string; fg: string; colours: Record<string, string> };

// From docs/PLAN.md "Pixel art › Colours".
const THEMES: Theme[] = [
  {
    name: "dark",
    bg: "#1f1f1f",
    fg: "#ece9e2",
    colours: {
      O: "#ff7a1a",
      P: "#9b6bff",
      G: "#22c55e",
      B: "#4f8bff",
      Y: "#facc15",
      R: "#ef4444",
      K: "#f472b6",
    },
  },
  {
    name: "light",
    bg: "#ece9e2",
    fg: "#1f1f1f",
    colours: {
      O: "#ff6b00",
      P: "#7c3aed",
      G: "#16a34a",
      B: "#2563eb",
      Y: "#eab308",
      R: "#dc2626",
      K: "#db2777",
    },
  },
];

const SCALES = [1, 3, 6];

const isSprite = (v: unknown): v is SpriteDef =>
  typeof v === "object" && v !== null && "frames" in v && "width" in v;
const isWeapon = (v: unknown): v is WeaponDef =>
  typeof v === "object" && v !== null && "poses" in v;

const exported = Object.values(S as Record<string, unknown>);
// Module namespaces are sorted by export name; show hero animations in play order instead.
const ORDER = ["hero-idle", "hero-slash", "hero-hurt", "hero-death"];
const tierOf = (s: SpriteDef) =>
  ((S as Record<string, unknown>).slashArcs as SpriteDef[] | undefined)?.indexOf(s) ?? -1;
const rank = (s: SpriteDef) =>
  ORDER.includes(s.name) ? ORDER.indexOf(s.name) : ORDER.length + Math.max(0, tierOf(s));
const sprites = exported.filter(isSprite).sort((a, b) => rank(a) - rank(b));
const weapons = exported.filter(isWeapon).sort((a, b) => a.tier - b.tier);
const anchors = ((S as Record<string, unknown>).heroWeaponAnchors ?? {}) as Record<
  string,
  WeaponAnchor[]
>;

const arcs = ((S as Record<string, unknown>).slashArcs ?? []) as SpriteDef[];
const arcOffset = ((S as Record<string, unknown>).slashArcOffset ?? { x: 0, y: 0 }) as Point;
const arcFrames = ((S as Record<string, unknown>).slashArcFrames ?? []) as (number | null)[];

// ---------- validation ----------

const errors = [
  ...sprites.flatMap(validateSprite),
  ...weapons.flatMap(validateWeapon),
  ...sprites
    .filter((s) => s.name.startsWith("hero-"))
    .flatMap((s) => validateAnchors(s, anchors[s.name.slice(5)])),
];
document.getElementById("errors")!.textContent = errors.join("\n");

// ---------- drawing ----------

function colourOf(ch: string, t: Theme): string | null {
  if (ch === ".") return null;
  if (ch === "#") return t.fg;
  if (ch === "o") return t.bg;
  return t.colours[ch] ?? "#f0f";
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: string[],
  t: Theme,
  dx: number,
  dy: number,
  scale: number,
) {
  frame.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colourOf(row[x], t);
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect((dx + x) * scale, (dy + y) * scale, scale, scale);
    }
  });
}

/** Something that can be drawn frame by frame inside a fixed box. */
type Drawable = {
  label: string;
  width: number;
  height: number;
  frameCount: number;
  fps: number;
  draw(ctx: CanvasRenderingContext2D, frame: number, t: Theme, scale: number): void;
};

function spriteDrawable(s: SpriteDef): Drawable {
  return {
    label: `${s.name} ${s.width}×${s.height}`,
    width: s.width,
    height: s.height,
    frameCount: s.frames.length,
    fps: s.fps ?? 4,
    draw: (ctx, f, t, scale) => drawFrame(ctx, s.frames[f], t, 0, 0, scale),
  };
}

/** Hero animation with the weapon overlaid at each frame's anchor (and the slash arc on hero-slash). */
function heroDrawable(s: SpriteDef, weapon: WeaponDef | undefined): Drawable {
  const arc = s.name === "hero-slash" && weapon ? arcs[weapon.tier] : undefined;
  const list = anchors[s.name.slice(5)] ?? [];
  // Bounding box of hero + weapon over all frames.
  let minX = 0;
  let minY = 0;
  let maxX = s.width;
  let maxY = s.height;
  const placed = list.map((a) => {
    if (!a || !weapon) return null;
    const p = weapon.poses[a.pose];
    const x = a.x - p.grip.x;
    const y = a.y - p.grip.y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + p.sprite.width);
    maxY = Math.max(maxY, y + p.sprite.height);
    return { x, y, frame: p.sprite.frames[0], behind: !!a.behind };
  });
  if (arc) {
    minX = Math.min(minX, arcOffset.x);
    minY = Math.min(minY, arcOffset.y);
    maxX = Math.max(maxX, arcOffset.x + arc.width);
    maxY = Math.max(maxY, arcOffset.y + arc.height);
  }
  return {
    label: `${s.name} ${s.width}×${s.height}${weapon ? ` + ${weapon.name}` : ""}${arc ? " + slash arc" : ""}`,
    width: maxX - minX,
    height: maxY - minY,
    frameCount: s.frames.length,
    fps: s.fps ?? 4,
    draw(ctx, f, t, scale) {
      const w = placed[f];
      if (w?.behind) drawFrame(ctx, w.frame, t, w.x - minX, w.y - minY, scale);
      drawFrame(ctx, s.frames[f], t, -minX, -minY, scale);
      if (w && !w.behind) drawFrame(ctx, w.frame, t, w.x - minX, w.y - minY, scale);
      const af = arcFrames[f];
      if (arc && af !== null && af !== undefined)
        drawFrame(ctx, arc.frames[af], t, arcOffset.x - minX, arcOffset.y - minY, scale);
    },
  };
}

function weaponDrawable(w: WeaponDef): Drawable {
  const poses = Object.entries(w.poses);
  const gap = 2;
  const width = poses.reduce((n, [, p]) => n + p.sprite.width + gap, -gap);
  const height = Math.max(...poses.map(([, p]) => p.sprite.height));
  return {
    label: `${w.name} (tier ${w.tier}): ${poses.map(([k]) => k).join(" / ")}`,
    width,
    height,
    frameCount: 1,
    fps: 1,
    draw(ctx, _f, t, scale) {
      let x = 0;
      for (const [, p] of poses) {
        drawFrame(ctx, p.sprite.frames[0], t, x, height - p.sprite.height, scale);
        x += p.sprite.width + gap;
      }
    },
  };
}

const animated: { ctx: CanvasRenderingContext2D; d: Drawable; t: Theme; scale: number }[] = [];
const gridBox = document.getElementById("grid") as HTMLInputElement;
const slowBox = document.getElementById("slow") as HTMLInputElement;

function canvasFor(d: Drawable, scale: number) {
  const c = document.createElement("canvas");
  c.width = d.width * scale;
  c.height = d.height * scale;
  return c;
}

function gridOverlay(ctx: CanvasRenderingContext2D, d: Drawable, t: Theme, scale: number) {
  if (scale < 3 || !gridBox.checked) return;
  ctx.fillStyle = t.name === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
  for (let x = 1; x < d.width; x++) ctx.fillRect(x * scale, 0, 1, d.height * scale);
  for (let y = 1; y < d.height; y++) ctx.fillRect(0, y * scale, d.width * scale, 1);
}

function figure(caption: string, el: HTMLElement) {
  const fig = document.createElement("figure");
  const cap = document.createElement("figcaption");
  cap.textContent = caption;
  fig.append(el, cap);
  return fig;
}

function addDrawable(parent: HTMLElement, d: Drawable, t: Theme) {
  const sec = document.createElement("section");
  const h = document.createElement("h3");
  h.textContent =
    `${d.label} · ${d.frameCount} frame${d.frameCount > 1 ? "s" : ""}` +
    (d.frameCount > 1 ? ` @ ${d.fps} fps` : "");
  const row = document.createElement("div");
  row.className = "row";
  for (const scale of SCALES) {
    const c = canvasFor(d, scale);
    animated.push({ ctx: c.getContext("2d")!, d, t, scale });
    row.append(figure(`${scale}×`, c));
  }
  if (d.frameCount > 1) {
    const strip = document.createElement("div");
    strip.className = "frames";
    for (let f = 0; f < d.frameCount; f++) {
      const c = canvasFor(d, stripScale);
      const ctx = c.getContext("2d")!;
      d.draw(ctx, f, t, stripScale);
      gridOverlay(ctx, d, t, stripScale);
      strip.append(figure(`#${f}`, c));
    }
    row.append(strip);
  }
  sec.append(h, row);
  parent.append(sec);
}

const GROUPS: [string, (s: SpriteDef) => boolean][] = [
  ["Hero", (s) => s.name.startsWith("hero-")],
  ["Mobs", (s) => s.name.startsWith("mob-")],
  ["Boss", (s) => s.name.startsWith("boss-")],
  ["Slash by tier", (s) => s.name === "hero-slash"],
  ["Effects", (s) => s.name.startsWith("effect-")],
  ["Items", (s) => !/^(hero|mob|boss|weapon|effect)-/.test(s.name)],
];

// URL params for screenshots: ?tier=2&grid&slow&only=Hero&theme=dark&name=hero-death&strip=6
const params = new URLSearchParams(location.search);
const stripScale = Number(params.get("strip") ?? 3);
const nameFilter = params.get("name");
const tierSelect = document.getElementById("tier") as HTMLSelectElement;
for (const w of weapons) tierSelect.add(new Option(w.name, String(w.tier)));
if (params.has("tier")) tierSelect.value = params.get("tier")!;
if (params.has("grid")) gridBox.checked = true;
if (params.has("slow")) slowBox.checked = true;
const only = params.get("only")?.split(",");
const themes = params.has("theme") ? THEMES.filter((t) => t.name === params.get("theme")) : THEMES;

function build() {
  const root = document.getElementById("themes")!;
  root.innerHTML = "";
  animated.length = 0;
  const weapon = weapons.find((w) => String(w.tier) === tierSelect.value) ?? weapons[0];
  for (const t of themes) {
    const col = document.createElement("div");
    col.className = "theme";
    col.style.background = t.bg;
    col.style.color = t.fg;
    const h = document.createElement("h2");
    h.textContent = `${t.name} theme (bg ${t.bg}, fg ${t.fg})`;
    col.append(h);
    for (const [title, test] of GROUPS) {
      if (only && !only.includes(title)) continue;
      const list = sprites.filter((s) => test(s) && (!nameFilter || s.name.startsWith(nameFilter)));
      const isHero = title === "Hero";
      if (!list.length && !(isHero && weapons.length && !nameFilter)) continue;
      const h3 = document.createElement("h2");
      h3.textContent = title;
      col.append(h3);
      if (title === "Slash by tier") {
        for (const s of list) for (const w of weapons) addDrawable(col, heroDrawable(s, w), t);
        continue;
      }
      for (const s of list)
        addDrawable(col, isHero ? heroDrawable(s, weapon) : spriteDrawable(s), t);
      if (isHero && !nameFilter) for (const w of weapons) addDrawable(col, weaponDrawable(w), t);
    }
    root.append(col);
  }
  render(performance.now());
}

function render(now: number) {
  for (const { ctx, d, t, scale } of animated) {
    const fps = slowBox.checked ? d.fps / 4 : d.fps;
    const f = Math.floor((now / 1000) * fps) % d.frameCount;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    d.draw(ctx, f, t, scale);
    gridOverlay(ctx, d, t, scale);
  }
}

function loop(now: number) {
  render(now);
  requestAnimationFrame(loop);
}

tierSelect.addEventListener("change", build);
gridBox.addEventListener("change", build);
build();
requestAnimationFrame(loop);
