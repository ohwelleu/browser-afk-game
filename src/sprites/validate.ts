import { PALETTE_SLOTS, type SpriteDef, type WeaponAnchor, type WeaponDef } from './types';

const ALLOWED = new Set<string>(PALETTE_SLOTS);

/** Returns a list of problems with one sprite (empty = valid). */
export function validateSprite(s: SpriteDef): string[] {
  const errors: string[] = [];
  const at = (msg: string) => errors.push(`${s.name}: ${msg}`);
  if (!s.name) at('missing name');
  if (!Number.isInteger(s.width) || s.width <= 0) at(`bad width ${s.width}`);
  if (!Number.isInteger(s.height) || s.height <= 0) at(`bad height ${s.height}`);
  if (s.fps !== undefined && !(s.fps > 0)) at(`bad fps ${s.fps}`);
  if (s.frames.length === 0) at('no frames');
  s.frames.forEach((frame, f) => {
    if (frame.length !== s.height) at(`frame ${f}: ${frame.length} rows, expected ${s.height}`);
    frame.forEach((row, y) => {
      if (row.length !== s.width)
        at(`frame ${f} row ${y}: ${row.length} chars, expected ${s.width}`);
      for (const [x, ch] of [...row].entries()) {
        if (!ALLOWED.has(ch)) at(`frame ${f} row ${y} col ${x}: bad char ${JSON.stringify(ch)}`);
      }
    });
    if (frame.every((row) => /^\.*$/.test(row))) at(`frame ${f}: empty`);
  });
  return errors;
}

/** Every pose must be valid and its grip must be a drawn pixel inside the sprite. */
export function validateWeapon(w: WeaponDef): string[] {
  const errors: string[] = [];
  for (const [pose, { sprite, grip }] of Object.entries(w.poses)) {
    errors.push(...validateSprite(sprite));
    const row = sprite.frames[0]?.[grip.y];
    const ch = row?.[grip.x];
    if (ch === undefined)
      errors.push(`${w.name} ${pose}: grip (${grip.x},${grip.y}) outside sprite`);
    else if (ch === '.')
      errors.push(`${w.name} ${pose}: grip (${grip.x},${grip.y}) is transparent`);
  }
  return errors;
}

/** One anchor per frame, inside the hero frame. */
export function validateAnchors(anim: SpriteDef, anchors: WeaponAnchor[] | undefined): string[] {
  if (!anchors) return [`${anim.name}: no weapon anchors`];
  const errors: string[] = [];
  if (anchors.length !== anim.frames.length) {
    errors.push(`${anim.name}: ${anchors.length} weapon anchors for ${anim.frames.length} frames`);
  }
  anchors.forEach((a, i) => {
    if (a && (a.x < 0 || a.y < 0 || a.x >= anim.width || a.y >= anim.height)) {
      errors.push(`${anim.name}: anchor ${i} (${a.x},${a.y}) outside frame`);
    }
  });
  return errors;
}
