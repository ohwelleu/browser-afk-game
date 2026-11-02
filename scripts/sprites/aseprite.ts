/**
 * Aseprite "Export Sprite Sheet" (PNG + JSON data) → strips, one per tag.
 *
 * Accepts both JSON styles ("Array" and "Hash"), horizontal strip layout,
 * untrimmed frames. Pure: takes the file contents, returns strips and errors.
 */
import { PNG } from 'pngjs';
import { cutFrames, type Strip } from './convert.ts';

type Rect = { x: number; y: number; w: number; h: number };
type AseFrame = {
  filename?: string;
  frame: Rect;
  rotated?: boolean;
  trimmed?: boolean;
  duration: number;
};
type AseTag = { name: string; from: number; to: number; direction?: string };
type AseJson = {
  frames: AseFrame[] | Record<string, AseFrame>;
  meta?: { image?: string; size?: { w: number; h: number }; frameTags?: AseTag[] };
};

/** Frame indices (0-based, into the sheet) a tag plays, in order. */
function tagOrder(tag: AseTag): number[] | null {
  const fwd: number[] = [];
  for (let i = tag.from; i <= tag.to; i++) fwd.push(i);
  const rev = [...fwd].reverse();
  switch (tag.direction ?? 'forward') {
    case 'forward':
      return fwd;
    case 'reverse':
      return rev;
    // 1 2 3 → 1 2 3 2 (the end frames are not repeated, like Aseprite plays it)
    case 'pingpong':
      return [...fwd, ...rev.slice(1, -1)];
    case 'pingpong_reverse':
      return [...rev, ...fwd.slice(1, -1)];
    default:
      return null;
  }
}

/**
 * Converts one exported sheet. `name` is the sprite base (`hero`), `files`
 * the paths used in errors. Each tag becomes `<name>-<tag>`; without tags the
 * whole sheet becomes one animation called `<name>`.
 */
export function asepriteToStrips(
  png: Buffer,
  jsonText: string,
  name: string,
  files: { png: string; json: string },
): { strips: Strip[]; errors: string[] } {
  const errors: string[] = [];
  const fail = (msg: string) => ({ strips: [], errors: [...errors, msg] });

  let json: AseJson;
  try {
    json = JSON.parse(jsonText) as AseJson;
  } catch (e) {
    return fail(`${files.json}: not valid JSON (${(e as Error).message})`);
  }
  if (!json || typeof json.frames !== 'object' || json.frames === null)
    return fail(`${files.json}: no "frames", is this an Aseprite sprite sheet export?`);

  // "Array" keeps order; "Hash" keys keep insertion order (they are never integers).
  const frames = Array.isArray(json.frames) ? json.frames : Object.values(json.frames);
  if (!frames.length) return fail(`${files.json}: no frames`);
  const tags = json.meta?.frameTags ?? [];

  // Which tag(s) a sheet frame belongs to, for error messages: `hero-slash frame 2`.
  const where = (f: number) => {
    const t = tags.find((t) => f >= t.from && f <= t.to);
    return t ? `${name}-${t.name} frame ${f - t.from + 1}` : `${name} frame ${f + 1}`;
  };

  // Geometry: all frames the same size, side by side, untrimmed.
  const fw = frames[0].frame.w;
  const fh = frames[0].frame.h;
  frames.forEach((fr, f) => {
    const at = `${files.json} ${where(f)}`;
    const { x, y, w, h } = fr.frame;
    if (w !== fw || h !== fh) errors.push(`${at}: frame is ${w}x${h}, expected ${fw}x${fh}`);
    else if (x !== f * fw || y !== 0)
      errors.push(
        `${at}: frame is at (${x},${y}), expected (${f * fw},0); export with Layout: horizontal strip`,
      );
    if (fr.rotated) errors.push(`${at}: frame is rotated; untick "Rotate" in the export`);
    if (fr.trimmed) errors.push(`${at}: frame is trimmed; untick "Trim" in the export`);
    if (!(Number.isInteger(fr.duration) && fr.duration > 0))
      errors.push(`${at}: bad duration ${JSON.stringify(fr.duration)}, expected ms > 0`);
  });

  const order: { tag: string; frames: number[] }[] = [];
  if (!tags.length) order.push({ tag: '', frames: frames.map((_, i) => i) });
  const seen = new Set<string>();
  for (const tag of tags) {
    const at = `${files.json} tag "${tag.name}"`;
    if (!/^[a-z0-9_]+$/i.test(tag.name ?? ''))
      errors.push(`${at}: use letters, digits and _ only in tag names`);
    else if (seen.has(tag.name)) errors.push(`${at}: tag name used twice`);
    seen.add(tag.name);
    if (
      !Number.isInteger(tag.from) ||
      !Number.isInteger(tag.to) ||
      tag.from < 0 ||
      tag.to < tag.from ||
      tag.to >= frames.length
    ) {
      errors.push(
        `${at}: frames ${tag.from + 1}..${tag.to + 1} out of range, the sheet has ${frames.length} frames`,
      );
      continue;
    }
    const idx = tagOrder(tag);
    if (!idx)
      errors.push(
        `${at}: direction "${tag.direction}" not supported, use forward, reverse or pingpong`,
      );
    else order.push({ tag: tag.name, frames: idx });
  }
  if (errors.length) return { strips: [], errors };

  let img: PNG;
  try {
    img = PNG.sync.read(png);
  } catch (e) {
    return fail(`${files.png}: not a readable PNG (${(e as Error).message})`);
  }
  const want = { w: fw * frames.length, h: fh };
  const meta = json.meta?.size;
  if (meta && (meta.w !== want.w || meta.h !== want.h))
    errors.push(
      `${files.json}: meta.size is ${meta.w}x${meta.h}, but ${frames.length} frames of ${fw}x${fh} make ${want.w}x${want.h}`,
    );
  if (img.width !== want.w || img.height !== want.h)
    errors.push(
      `${files.png}: image is ${img.width}x${img.height}, but ${files.json} has ${frames.length} frames of ${fw}x${fh} (${want.w}x${want.h})`,
    );
  if (errors.length) return { strips: [], errors };

  const sheet = cutFrames(img, fw, fh, frames.length, where, errors);
  const strips = order.map(({ tag, frames: idx }) => ({
    label: tag ? `${name}-${tag}` : name,
    width: fw,
    height: fh,
    frames: idx.map((i) => sheet[i]),
    durations: idx.map((i) => frames[i].duration),
  }));
  return { strips, errors };
}
